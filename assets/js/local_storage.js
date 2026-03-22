'use strict';

import SETTINGS from './static/settings.js';

const STORAGE_KEY = 'shaoguan_bus_pids_config';

export function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SETTINGS));
}

function read() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const savedSettings = JSON.parse(raw);
    SETTINGS.showPlatform = savedSettings.showPlatform ?? SETTINGS.showPlatform;
    SETTINGS.rtHeader = savedSettings.rtHeader ?? SETTINGS.rtHeader;
    SETTINGS.displayMode = savedSettings.displayMode ?? SETTINGS.displayMode;
    SETTINGS.dataSource = savedSettings.dataSource ?? SETTINGS.dataSource;
    SETTINGS.adhoc = savedSettings.adhoc ?? SETTINGS.adhoc;
    SETTINGS.direction = savedSettings.direction ?? SETTINGS.direction;
    SETTINGS.station = savedSettings.station ?? SETTINGS.station;
    SETTINGS.route = savedSettings.route ?? SETTINGS.route;
    SETTINGS.firstTrainCutoff = savedSettings.firstTrainCutoff ?? SETTINGS.firstTrainCutoff;
    SETTINGS.proxyBaseUrl = savedSettings.proxyBaseUrl ?? SETTINGS.proxyBaseUrl;
  } catch (error) {
    console.warn('Ignore broken local config', error);
  }
}

read();
