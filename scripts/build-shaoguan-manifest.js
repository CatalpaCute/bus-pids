#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const CITY_ID = '241';
const OUTPUT_PATH = path.resolve(__dirname, '..', 'assets', 'data', 'shaoguan-routes.json');

const DEFAULTS = {
  host: 'https://web.chelaile.net.cn',
  src: 'wechat_shaoguan',
  version: '9.1.2',
  vc: '1',
  sign: '1'
};

function randomBrowserId() {
  return `browser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function stripMarkers(raw) {
  return raw.trim().replace(/^\*\*YGKJ/, '').replace(/YGKJ##$/, '');
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, String(value));
  });
  return search.toString();
}

function request(url, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 240)}`));
            return;
          }
          resolve(data);
        });
      })
      .on('error', reject);
  });
}

function defaultHeaders(ctx) {
  return {
    referer: `${DEFAULTS.host}/customer_ch5/?1=1&randomTime=${Date.now()}&src=${encodeURIComponent(ctx.src)}`,
    'user-agent':
      'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
    accept: '*/*'
  };
}

function sharedParams(ctx) {
  return {
    cityId: ctx.cityId,
    s: 'h5',
    v: ctx.version,
    vc: ctx.vc,
    src: ctx.src,
    userId: ctx.userId,
    h5Id: ctx.h5Id,
    sign: ctx.sign
  };
}

async function action(ctx, handler, params) {
  const query = buildQuery({ ...params, ...sharedParams(ctx) });
  const url = `${ctx.host}/api/${handler}?${query}`;
  const raw = await request(url, defaultHeaders(ctx));
  const json = JSON.parse(stripMarkers(raw));
  const status = json.jsonr && json.jsonr.status;
  if (status !== '00') {
    throw new Error(json.jsonr && (json.jsonr.errmsg || json.jsonr.status) || 'Unknown API error');
  }
  return json.jsonr.data;
}

async function getCityLineList(ctx) {
  const data = await action(ctx, 'bus/cityLineList', {});
  const lines = [];
  Object.values(data.allLines || {}).forEach((group) => {
    (group || []).forEach((item) => lines.push(item));
  });
  return dedupeBy(lines, (item) => item.lineId);
}

async function getLineRoute(ctx, lineId) {
  return action(ctx, 'bus/line!lineRoute.action', { lineId });
}

function dedupeBy(items, keyFn) {
  const seen = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });
  return [...seen.values()];
}

function normalizeLineNo(value) {
  return String(value || '').trim().toUpperCase();
}

function extractLineCode(value) {
  const text = normalizeLineNo(value);
  const matched = text.match(/^[0-9A-Z]+/);
  return matched ? matched[0] : '';
}

function isBusLineNo(value) {
  const lineNo = extractLineCode(value);
  return /[0-9]/.test(lineNo) && /^[0-9A-Z]+$/.test(lineNo);
}

function sortLineNumbers(left, right) {
  const l = normalizeLineNo(left);
  const r = normalizeLineNo(right);
  const ln = Number.parseInt(l, 10);
  const rn = Number.parseInt(r, 10);
  if (!Number.isNaN(ln) && !Number.isNaN(rn) && ln !== rn) {
    return ln - rn;
  }
  return l.localeCompare(r, 'zh-Hans-CN');
}

function stableColor(lineNo) {
  let hash = 0;
  for (const char of String(lineNo)) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  const hue = (hash + 180) % 360;
  return `hsl(${hue} 72% 42%)`;
}

function directionBadge(index, count) {
  if (count <= 1) {
    return '往';
  }
  return index === 0 ? '上' : '下';
}

function withRetry(task, retries) {
  return task().catch((error) => {
    if (retries <= 0) {
      throw error;
    }
    return new Promise((resolve) => setTimeout(resolve, 800)).then(() => withRetry(task, retries - 1));
  });
}

async function run() {
  const userId = randomBrowserId();
  const ctx = {
    host: DEFAULTS.host,
    src: DEFAULTS.src,
    version: DEFAULTS.version,
    vc: DEFAULTS.vc,
    sign: DEFAULTS.sign,
    cityId: CITY_ID,
    userId,
    h5Id: userId
  };

  const lineList = (await withRetry(() => getCityLineList(ctx), 2)).filter((item) =>
    isBusLineNo(item.lineName || item.lineNo || item.name)
  );

  lineList.sort((left, right) =>
    sortLineNumbers(
      extractLineCode(left.lineName || left.lineNo || left.name),
      extractLineCode(right.lineName || right.lineNo || right.name)
    )
  );

  const grouped = new Map();
  for (const item of lineList) {
    const lineNo = extractLineCode(item.lineName || item.lineNo || item.name);
    if (!grouped.has(lineNo)) {
      grouped.set(lineNo, []);
    }
    grouped.get(lineNo).push(item);
  }

  const lines = [];
  for (const [lineNo, variants] of grouped.entries()) {
    const directions = [];
    for (const variant of variants) {
      const route = await withRetry(() => getLineRoute(ctx, variant.lineId), 2);
      const stations = (route.stations || []).map((station) => ({
        order: station.order,
        sId: station.sId,
        sn: station.sn,
        lat: station.lat,
        lng: station.lng
      }));

      if (stations.length < 2) {
        continue;
      }

      directions.push({
        id: variant.lineId,
        lineId: variant.lineId,
        lineNo,
        lineName: variant.lineName,
        direction: variant.direction,
        directionLabel: `${stations[0].sn} -> ${stations[stations.length - 1].sn}`,
        startStation: stations[0].sn,
        endStation: stations[stations.length - 1].sn,
        stations
      });
    }

    directions.sort((left, right) => left.directionLabel.localeCompare(right.directionLabel, 'zh-Hans-CN'));

    if (directions.length === 0) {
      continue;
    }

    const stationOrderMap = new Map();
    directions.forEach((direction, index) => {
      direction.badge = directionBadge(index, directions.length);
      direction.stations.forEach((station) => {
        const prev = stationOrderMap.get(station.sn);
        if (!prev || station.order < prev.order) {
          stationOrderMap.set(station.sn, { sn: station.sn, order: station.order });
        }
      });
    });

    const stations = [...stationOrderMap.values()]
      .sort((left, right) => left.order - right.order || left.sn.localeCompare(right.sn, 'zh-Hans-CN'))
      .map((item) => item.sn);

    lines.push({
      lineNo,
      displayName: `${lineNo}路`,
      color: stableColor(lineNo),
      directions,
      stations
    });
  }

  lines.sort((left, right) => sortLineNumbers(left.lineNo, right.lineNo));

  const manifest = {
    generatedAt: new Date().toISOString(),
    cityId: CITY_ID,
    cityName: '韶关市',
    lineCount: lines.length,
    defaultLineNo: lines[0] ? lines[0].lineNo : '',
    lines
  };

  ensureDir(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Manifest written to ${OUTPUT_PATH}`);
  console.log(`Lines: ${lines.length}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
