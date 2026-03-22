import { createDecipheriv, createHash } from 'node:crypto';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, now: new Date().toISOString() });
    }

    if (url.pathname !== '/api/line-detail' && url.pathname !== '/api/station-detail') {
      return json({ error: 'Not Found' }, 404);
    }

    try {
      if (url.pathname === '/api/station-detail') {
        const stationId = url.searchParams.get('stationId');
        if (!stationId) {
          return json({ error: 'Missing query parameter: stationId' }, 400);
        }
        const detail = await callEncryptedHandler(
          'bus/stop!encryptedStnDetail.action',
          { stationId, destSId: url.searchParams.get('destSId') || '-1' },
          url.searchParams
        );
        return json(detail);
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
          return json({ error: `Missing query parameter: ${key}` }, 400);
        }
      }

      const payload = Object.fromEntries(required.map((key) => [key, url.searchParams.get(key)]));
      const detail = await callEncryptedHandler(
        'bus/line!encryptedLineDetail.action',
        payload,
        url.searchParams
      );
      return json(detail);
    } catch (error) {
      return json({ error: error.message || 'Unhandled worker error' }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Content-Type'
  };
}

function stripMarkers(raw) {
  return raw.trim().replace(/^\*\*YGKJ/, '').replace(/YGKJ##$/, '');
}

function serialize(payload) {
  return Object.entries(payload)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function randomBrowserId() {
  return `browser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function md5(value) {
  return createHash('md5').update(value).digest('hex');
}

async function decryptAes(base64Text) {
  const key = Buffer.from('422556651C7F7B2B5C266EED06068230', 'utf8');
  const decipher = createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(base64Text, 'base64'), decipher.final()]).toString('utf8');
}

async function callEncryptedHandler(pathname, payload, query) {
  const cryptoSign = await md5(`${serialize(payload)}qwihrnbtmj`);
  const upstreamUrl = new URL(`https://web.chelaile.net.cn/api/${pathname}`);
  const userId = query.get('userId') || randomBrowserId();
  const shared = {
    cityId: query.get('cityId') || '241',
    s: 'h5',
    v: '9.1.2',
    vc: '1',
    src: query.get('src') || 'wechat_shaoguan',
    userId,
    h5Id: query.get('h5Id') || userId,
    sign: '1'
  };

  [...Object.entries(payload), ...Object.entries(shared), ['cryptoSign', cryptoSign]].forEach(([key, value]) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      referer: `https://web.chelaile.net.cn/customer_ch5/?1=1&randomTime=${Date.now()}&src=${shared.src}`,
      'user-agent':
        'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
      accept: '*/*'
    }
  });

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Upstream error ${upstream.status}: ${raw.slice(0, 300)}`);
  }

  const wrapped = JSON.parse(stripMarkers(raw));
  if (wrapped?.jsonr?.status !== '00') {
    throw new Error(wrapped?.jsonr?.errmsg || wrapped?.jsonr?.status || 'Unknown upstream status');
  }

  const encryptResult = wrapped?.jsonr?.data?.encryptResult;
  if (!encryptResult) {
    throw new Error('Missing encryptResult');
  }

  return JSON.parse(await decryptAes(encryptResult));
}
