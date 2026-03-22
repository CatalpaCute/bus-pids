#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const CITY_REGISTRY_PATH = path.resolve(ROOT, 'assets', 'data', 'cities.json');
const OUTPUT_DIR = path.resolve(ROOT, 'assets', 'data', 'manifests');

const DEFAULTS = {
  host: 'https://web.chelaile.net.cn',
  version: '9.1.2',
  vc: '1',
  sign: '1'
};

function parseArgs(argv) {
  const args = { city: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--city') {
      args.city = argv[index + 1] || null;
      index += 1;
    }
  }
  return args;
}

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
    throw new Error((json.jsonr && (json.jsonr.errmsg || json.jsonr.status)) || 'Unknown API error');
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

function normalizeDisplayLineName(value) {
  const raw = String(value || '').replace(/\s+/g, '').trim();
  const cleaned = raw.replace(/[（(][^）)]*[）)]$/u, '').trim();
  const normalized = cleaned || raw;
  const patterns = [
    /^([A-Za-z]+\d+(?:快线|支线|区间|[A-Za-z])?)/,
    /^(\d+(?:快线|支线|区间|[A-Za-z])?)/,
    /^(夜\d+(?:快线|支线)?)/u,
    /^(大学城专线\d+)/u,
    /^(旅游公交\d+线)/u,
    /^(专\d+[A-Za-z]?)/u,
    /^(快线\d+[A-Za-z]?)/u
  ];

  for (const pattern of patterns) {
    const matched = normalized.match(pattern);
    if (matched) {
      return matched[1];
    }
  }

  return normalized;
}

function isBusLineName(value) {
  const lineName = normalizeDisplayLineName(value);
  return /[0-9]/.test(lineName) || /^(夜|大学城专线|旅游公交|专|快线)/u.test(lineName);
}

function sortLineNumbers(left, right) {
  return String(left || '').localeCompare(String(right || ''), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
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
  const badges = ['上', '下', 'A', 'B'];
  return badges[index] || String(index + 1);
}

function createDisplayName(lineNo) {
  if (/^\d+[A-Za-z]?$/.test(lineNo)) {
    return `${lineNo}路`;
  }
  return lineNo;
}

function withRetry(task, retries) {
  return task().catch((error) => {
    if (retries <= 0) {
      throw error;
    }
    return new Promise((resolve) => setTimeout(resolve, 800)).then(() => withRetry(task, retries - 1));
  });
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runOne() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const jobs = Array.from({ length: Math.min(limit, items.length) }, () => runOne());
  await Promise.all(jobs);
  return results;
}

function loadCityRegistry() {
  return JSON.parse(fs.readFileSync(CITY_REGISTRY_PATH, 'utf8'));
}

async function buildCityManifest(city) {
  const userId = randomBrowserId();
  const ctx = {
    host: DEFAULTS.host,
    src: city.src,
    version: DEFAULTS.version,
    vc: DEFAULTS.vc,
    sign: DEFAULTS.sign,
    cityId: city.cityId,
    userId,
    h5Id: userId
  };

  const lineList = (await withRetry(() => getCityLineList(ctx), 2)).filter((item) =>
    isBusLineName(item.lineName || item.lineNo || item.name)
  );

  const grouped = new Map();
  lineList.forEach((item) => {
    const lineNo = normalizeDisplayLineName(item.lineName || item.lineNo || item.name);
    if (!grouped.has(lineNo)) {
      grouped.set(lineNo, []);
    }
    grouped.get(lineNo).push(item);
  });

  const lines = [];
  const groupedEntries = [...grouped.entries()].sort((left, right) => sortLineNumbers(left[0], right[0]));

  for (const [lineNo, variants] of groupedEntries) {
    const directionResults = await mapWithConcurrency(variants, 4, async (variant) => {
      const route = await withRetry(() => getLineRoute(ctx, variant.lineId), 2);
      const stations = (route.stations || []).map((station) => ({
        order: station.order,
        sId: station.sId,
        sn: station.sn,
        lat: station.lat,
        lng: station.lng
      }));

      if (stations.length < 2) {
        return null;
      }

      return {
        id: variant.lineId,
        lineId: variant.lineId,
        lineNo,
        lineName: variant.lineName,
        direction: variant.direction,
        directionLabel: `${stations[0].sn} -> ${stations[stations.length - 1].sn}`,
        startStation: stations[0].sn,
        endStation: stations[stations.length - 1].sn,
        stations
      };
    });

    const directions = directionResults.filter(Boolean);
    directions.sort((left, right) => sortLineNumbers(left.directionLabel, right.directionLabel));

    if (directions.length === 0) {
      continue;
    }

    directions.forEach((direction, index) => {
      direction.badge = directionBadge(index, directions.length);
    });

    lines.push({
      lineNo,
      displayName: createDisplayName(lineNo),
      color: stableColor(lineNo),
      directions,
      stations: directions[0].stations.map((station) => station.sn)
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    citySlug: city.slug,
    cityId: city.cityId,
    cityName: city.name,
    lineCount: lines.length,
    defaultLineNo: lines[0] ? lines[0].lineNo : '',
    lines
  };

  const outputPath = path.resolve(OUTPUT_DIR, `${city.slug}.json`);
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[${city.name}] manifest written: ${outputPath}`);
  console.log(`[${city.name}] lines: ${lines.length}`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const cityRegistry = loadCityRegistry();
  const cities = (cityRegistry.cities || []).filter((city) => !args.city || city.slug === args.city);

  if (cities.length === 0) {
    throw new Error(`No city matched --city ${args.city}`);
  }

  for (const city of cities) {
    await buildCityManifest(city);
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
