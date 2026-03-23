'use strict';

const DATA_SOURCE = {
  ONLINE: 'ONLINE',
  ONLINE_CZWORKS: 'ONLINE_CZWORKS',
  OFFLINE: 'OFFLINE'
};

const CZWORKS_PROXY_BASE_URL = 'https://busapi1145141919810.czzzz.work';

const settings = {
  direction: '',
  debugMode: false,
  displayMode: 'NORMAL',
  dataSource: DATA_SOURCE.ONLINE,
  route: '',
  station: '',
  adhoc: 'NONE',
  showPlatform: true,
  showingSpecialMessage: false,
  uiPreset: null,
  rtHeader: false,
  firstTrainCutoff: 20,
  proxyBaseUrl: ''
};

function isLiveDataSource(dataSource) {
  return dataSource === DATA_SOURCE.ONLINE || dataSource === DATA_SOURCE.ONLINE_CZWORKS;
}

function getResolvedProxyBaseUrl() {
  // Fixed hosted source should stay immutable in the UI so GitHub Pages users can switch to it safely.
  if (settings.dataSource === DATA_SOURCE.ONLINE_CZWORKS) {
    return CZWORKS_PROXY_BASE_URL;
  }
  return settings.proxyBaseUrl;
}

export default settings;
export { DATA_SOURCE, CZWORKS_PROXY_BASE_URL, isLiveDataSource, getResolvedProxyBaseUrl };
