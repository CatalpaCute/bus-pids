#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = Number.parseInt(process.env.PORT || '8788', 10);

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Content-Type'
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...corsHeaders()
  });
  response.end(JSON.stringify(payload));
}

function stripMarkers(raw) {
  return raw.trim().replace(/^\*\*YGKJ/, '').replace(/YGKJ##$/, '');
}

function fetchText(url, headers) {
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

function decryptAes(base64Text) {
  const key = Buffer.from('422556651C7F7B2B5C266EED06068230', 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(base64Text, 'base64'), decipher.final()]).toString('utf8');
}

function serialize(payload) {
  return Object.entries(payload)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function randomBrowserId() {
  return `browser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function callEncryptedHandler(pathname, payload, query) {
  const cryptoSign = crypto.createHash('md5').update(`${serialize(payload)}qwihrnbtmj`).digest('hex');
  const upstream = new URL(`https://web.chelaile.net.cn/api/${pathname}`);
  const userId = query.get('userId') || randomBrowserId();
  const shared = {
    cityId: query.get('cityId') || '241',
    s: 'h5',
    v: '9.1.2',
    vc: '1',
    src: query.get('src') || 'wechat_shaoguan',
    userId,
    h5Id: query.get('h5Id') || userId,
    sign: '1',
    cryptoSign
  };

  [...Object.entries(payload), ...Object.entries(shared)].forEach(([key, value]) => {
    upstream.searchParams.set(key, value);
  });

  const raw = await fetchText(upstream.toString(), {
    referer: `https://web.chelaile.net.cn/customer_ch5/?1=1&randomTime=${Date.now()}&src=${shared.src}`,
    'user-agent':
      'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
    accept: '*/*'
  });

  const json = JSON.parse(stripMarkers(raw));
  if (json?.jsonr?.status !== '00') {
    throw new Error(json?.jsonr?.errmsg || json?.jsonr?.status || 'Upstream error');
  }

  const encryptResult = json?.jsonr?.data?.encryptResult;
  if (!encryptResult) {
    throw new Error('Missing encryptResult');
  }

  return JSON.parse(decryptAes(encryptResult));
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Bad request' });
    return;
  }

  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, now: new Date().toISOString() });
    return;
  }

  if (url.pathname !== '/api/line-detail' && url.pathname !== '/api/station-detail') {
    sendJson(response, 404, { error: 'Not Found' });
    return;
  }

  try {
    if (url.pathname === '/api/station-detail') {
      const stationId = url.searchParams.get('stationId');
      if (!stationId) {
        sendJson(response, 400, { error: 'Missing query parameter: stationId' });
        return;
      }
      const detail = await callEncryptedHandler(
        'bus/stop!encryptedStnDetail.action',
        { stationId, destSId: url.searchParams.get('destSId') || '-1' },
        url.searchParams
      );
      sendJson(response, 200, detail);
      return;
    }

    const required = [
      'lineId',
      'lineName',
      'direction',
      'stationName',
      'nextStationName',
      'lineNo',
      'targetOrder'
    ];

    for (const key of required) {
      if (!url.searchParams.get(key)) {
        sendJson(response, 400, { error: `Missing query parameter: ${key}` });
        return;
      }
    }

    const payload = Object.fromEntries(required.map((key) => [key, url.searchParams.get(key)]));
    const detail = await callEncryptedHandler(
      'bus/line!encryptedLineDetail.action',
      payload,
      url.searchParams
    );
    sendJson(response, 200, detail);
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Unhandled error' });
  }
});

server.listen(PORT, () => {
  console.log(`Local proxy listening on http://127.0.0.1:${PORT}`);
});
