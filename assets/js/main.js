'use strict';

import ETA_CONTROLLER from './eta_controller.js';
import SETTINGS from './static/settings.js';
import UI from './ui.js';
import { ensureValidSettings, getCityConfig, loadCityRegistry, loadManifest } from './static/data.js';

let etaData = [];
let isFetching = false;
let nextRefreshAt = 0;

function parseQuery() {
  const params = new URL(document.location).searchParams;

  if (params.has('debug')) {
    SETTINGS.debugMode = true;
  }

  if (params.has('proxy')) {
    SETTINGS.proxyBaseUrl = params.get('proxy') || '';
  }

  if (params.has('city')) {
    SETTINGS.city = params.get('city') || SETTINGS.city;
  }
}

async function updateETA(force = false) {
  if (isFetching) {
    return;
  }

  if (!force && Date.now() < nextRefreshAt) {
    return;
  }

  isFetching = true;
  try {
    ensureValidSettings(SETTINGS);
    etaData = await ETA_CONTROLLER.getETA(SETTINGS.route, SETTINGS.station, SETTINGS.direction);
  } catch (error) {
    console.error('Failed to refresh ETA', error);
    etaData = [];
  } finally {
    nextRefreshAt = Date.now() + (SETTINGS.dataSource === 'ONLINE' ? 15 * 1000 : 2 * 1000);
    isFetching = false;
  }
}

$(document).ready(async function ready() {
  parseQuery();
  await loadCityRegistry();
  if (!getCityConfig(SETTINGS.city)) {
    SETTINGS.city = 'shaoguan';
  }
  await loadManifest(SETTINGS.city);
  ensureValidSettings(SETTINGS);
  UI.setup();
  UI.draw([]);
  await updateETA(true);
  UI.draw(etaData);

  setInterval(() => {
    updateETA(false);
    UI.draw(etaData);
  }, 1000);
});
