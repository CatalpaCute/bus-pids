'use strict';

class ArrivalEntry {
  constructor(dest, ttnt, absTime, route, platformNumber, isDeparture, meta = {}) {
    this.dest = dest;
    this.ttnt = ttnt;
    this.absTime = absTime;
    this.plat = platformNumber;
    this.isDeparture = isDeparture;
    this.route = route;
    this.meta = meta;
  }
}

const DisplayMode = {
  NORMAL: 'NORMAL',
  AD: 'AD',
  ADNT1: 'ADNT1',
  NT4: 'NT4',
  NT4_CT: 'NT4_CT'
};

const UIPreset = {
  default: {
    title: "'Source Han Sans SC', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans', sans-serif",
    arrivals: "'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', 'Noto Serif HK', serif",
    platformCircle: "'Source Han Sans SC', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans', sans-serif",
    eta: "'Source Han Sans SC', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans', sans-serif",
    chinFontSpacing: 'normal',
    fontWeight: 600,
    titleWidth: 94,
    ETAWidth: 94,
    fontRatio: 1
  }
};

const promotionData = {
  cycle: [
    {
      id: 'TIP_1',
      framesrc: './promo/bus_tip_1.html',
      duration: 10000
    },
    {
      id: 'TIP_2',
      framesrc: './promo/bus_tip_2.html',
      duration: 10000
    },
    {
      id: 'TIP_3',
      framesrc: './promo/bus_tip_3.html',
      duration: 10000
    }
  ],
  special: [
    {
      id: 'NONE',
      framesrc: null,
      queryString: null
    },
    {
      id: 'CIVILIZED',
      framesrc: './promo/custom_msg.html',
      queryString:
        '?zh=%E8%AF%B7%E6%96%87%E6%98%8E%E4%B9%98%E8%BD%A6%EF%BC%8C%E4%B8%BB%E5%8A%A8%E4%B8%BA%E8%80%81%E5%B9%BC%E7%97%85%E6%AE%8B%E5%AD%95%E8%AE%A9%E5%BA%A7&en=Please offer seats to passengers in need'
    },
    {
      id: 'QUEUE',
      framesrc: './promo/custom_msg.html',
      queryString:
        '?zh=%E8%AF%B7%E6%8E%92%E9%98%9F%E4%B8%8A%E8%BD%A6%EF%BC%8C%E5%85%88%E4%B8%8B%E5%90%8E%E4%B8%8A&en=Please queue and let passengers alight first'
    },
    {
      id: 'SAFETY',
      framesrc: './promo/custom_msg.html',
      queryString:
        '?zh=%E8%BD%A6%E8%BE%86%E8%BF%9B%E7%AB%99%E6%97%B6%E8%AF%B7%E5%8B%BF%E9%9D%A0%E8%BF%91%E8%BD%A6%E9%97%A8&en=Please stand back from the bus doors'
    },
    {
      id: 'EMERGENCY',
      framesrc: './promo/custom_msg.html',
      queryString:
        '?zh=%E7%B4%A7%E6%80%A5%E6%83%85%E5%86%B5%E8%AF%B7%E5%90%AC%E4%BB%8E%E7%8E%B0%E5%9C%BA%E5%B7%A5%E4%BD%9C%E4%BA%BA%E5%91%98%E6%8C%87%E5%BC%95&en=Follow staff instructions during emergencies',
      isFullScreen: true
    }
  ]
};

let manifestPromise = null;
let manifestData = null;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

async function loadManifest() {
  if (manifestData) {
    return manifestData;
  }
  if (!manifestPromise) {
    manifestPromise = fetch('./assets/data/shaoguan-routes.json', { cache: 'no-cache' }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load route manifest: ${response.status}`);
      }
      return response.json();
    });
  }
  manifestData = await manifestPromise;
  return manifestData;
}

function getManifest() {
  return manifestData;
}

function getLines() {
  return manifestData?.lines || [];
}

function getLine(lineNo) {
  const lines = getLines();
  if (lines.length === 0) {
    return null;
  }
  return lines.find((line) => line.lineNo === lineNo) || lines[0];
}

function hasLine(lineNo) {
  return getLines().some((line) => line.lineNo === lineNo);
}

function getLineTitle(lineNo) {
  const line = getLine(lineNo);
  if (!line) {
    return '韶关公交 PIDS|Shaoguan Bus PIDS';
  }
  return `${line.displayName}|Shaoguan Bus ${line.lineNo}`;
}

function buildRouteVisual(lineNo) {
  const line = getLine(lineNo);
  return {
    initials: line?.lineNo || '',
    name: getLineTitle(lineNo),
    color: line?.color || '#0f5c87'
  };
}

function getStationOptions(lineNo) {
  const line = getLine(lineNo);
  if (!line) {
    return [];
  }

  const ordered = [];
  const seen = new Set();
  (line.directions[0]?.stations || []).forEach((station) => {
    if (!seen.has(station.sn)) {
      seen.add(station.sn);
      ordered.push(station.sn);
    }
  });

  line.directions.slice(1).forEach((direction) => {
    (direction.stations || []).forEach((station) => {
      if (!seen.has(station.sn)) {
        seen.add(station.sn);
        ordered.push(station.sn);
      }
    });
  });

  return ordered;
}

function getStationRecord(direction, stationName) {
  return (direction.stations || []).find((station) => normalizeText(station.sn) === normalizeText(stationName)) || null;
}

function getDirectionsForStation(lineNo, stationName) {
  const line = getLine(lineNo);
  if (!line) {
    return [];
  }

  return line.directions
    .map((direction) => {
      const targetStation = getStationRecord(direction, stationName);
      if (!targetStation) {
        return null;
      }

      const nextStation =
        direction.stations.find((station) => station.order === targetStation.order + 1) ||
        direction.stations.find((station) => station.order === targetStation.order - 1) ||
        targetStation;

      return {
        ...direction,
        stationName: targetStation.sn,
        stationId: targetStation.sId,
        targetOrder: targetStation.order,
        nextStationName: nextStation?.sn || targetStation.sn
      };
    })
    .filter(Boolean);
}

function getDirectionOptions(lineNo, stationName) {
  const directions = getDirectionsForStation(lineNo, stationName);
  const options = directions.map((direction) => ({
    value: direction.id,
    label: `开往 ${direction.endStation}`,
    hint: direction.directionLabel,
    badge: direction.badge
  }));

  if (directions.length > 1) {
    options.push({
      value: 'BOTH',
      label: '全部方向',
      hint: '按到站时间混排显示',
      badge: '全'
    });
    options.push({
      value: 'BOTH_SPLIT',
      label: '双方向分屏',
      hint: '上下半屏各显示一个方向',
      badge: '分'
    });
  }

  return options;
}

function getSelectedDirections(lineNo, stationName, selection) {
  const directions = getDirectionsForStation(lineNo, stationName);
  if (selection === 'BOTH' || selection === 'BOTH_SPLIT') {
    return directions;
  }
  return directions.filter((direction) => direction.id === selection);
}

function ensureValidSettings(settings) {
  const lines = getLines();
  if (lines.length === 0) {
    return;
  }

  if (!hasLine(settings.route)) {
    settings.route = manifestData.defaultLineNo || lines[0].lineNo;
  }

  const stationOptions = getStationOptions(settings.route);
  if (!stationOptions.includes(settings.station)) {
    settings.station = stationOptions[0] || '';
  }

  const directionOptions = getDirectionOptions(settings.route, settings.station);
  if (!directionOptions.some((item) => item.value === settings.direction)) {
    settings.direction = directionOptions[0]?.value || '';
  }
}

function isSplitDirectionSelection(selection) {
  return selection === 'BOTH_SPLIT';
}

function getDefaultDirection(lineNo, stationName) {
  return getDirectionOptions(lineNo, stationName)[0]?.value || '';
}

export {
  ArrivalEntry,
  DisplayMode,
  UIPreset,
  promotionData,
  loadManifest,
  getManifest,
  getLines,
  getLine,
  getLineTitle,
  buildRouteVisual,
  getStationOptions,
  getDirectionsForStation,
  getDirectionOptions,
  getSelectedDirections,
  getDefaultDirection,
  ensureValidSettings,
  isSplitDirectionSelection,
  normalizeText,
  hasLine
};
