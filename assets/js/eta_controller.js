'use strict';

import SETTINGS from './static/settings.js';
import { fetchRealtimeEntries } from './static/eta_api.js';
import { ArrivalEntry, buildRouteVisual } from './static/data.js';

function createCustomEntry(dest, ttnt, badge) {
  return new ArrivalEntry(
    dest,
    ttnt,
    null,
    buildRouteVisual(SETTINGS.route),
    badge,
    ttnt <= 1
  );
}

const customArrivalData = [
  createCustomEntry('请在设置中自定义终点站', 3, '上'),
  createCustomEntry('请在设置中自定义终点站', 8, '下'),
  createCustomEntry('请在设置中自定义终点站', 15, '上'),
  createCustomEntry('请在设置中自定义终点站', 21, '下')
];

let etaCache = {
  expiry: 0,
  data: null,
  lastRequestCombo: null
};

function canUseCache(requestCombo) {
  return Date.now() <= etaCache.expiry && etaCache.lastRequestCombo === requestCombo;
}

async function getETA(route, station, direction) {
  if (SETTINGS.dataSource === 'OFFLINE') {
    return customArrivalData;
  }

  const requestCombo = [route, station, direction, SETTINGS.proxyBaseUrl].join('|');
  if (etaCache.data && canUseCache(requestCombo)) {
    return etaCache.data;
  }

  const data = await fetchRealtimeEntries(route, station, direction);
  etaCache.expiry = Date.now() + 15 * 1000;
  etaCache.data = data;
  etaCache.lastRequestCombo = requestCombo;
  return data;
}

export default {
  getETA,
  customArrivalData
};
