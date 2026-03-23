'use strict';

import { getResolvedProxyBaseUrl } from './settings.js';
import {
  ArrivalEntry,
  buildRouteVisual,
  getSelectedDirections
} from './data.js';

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function fetchProxyJson(pathname, params) {
  const proxyBaseUrl = normalizeBaseUrl(getResolvedProxyBaseUrl());
  if (!proxyBaseUrl) {
    throw new Error('未配置实时代理地址，GitHub Pages 版本无法直接跨域调用车来了接口。');
  }

  const url = new URL(`${proxyBaseUrl}${pathname}`);
  url.searchParams.set('cityId', '241');
  url.searchParams.set('src', 'wechat_shaoguan');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`代理请求失败：${response.status}`);
  }

  return response.json();
}

async function fetchStationDetail(stationId) {
  return fetchProxyJson('/api/station-detail', {
    stationId,
    destSId: '-1'
  });
}

async function fetchDirectionDetail(direction) {
  return fetchProxyJson('/api/line-detail', {
    lineId: direction.lineId,
    lineName: direction.lineName,
    direction: direction.direction ?? 0,
    stationName: direction.stationName,
    nextStationName: direction.nextStationName,
    lineNo: direction.lineNo,
    targetOrder: direction.targetOrder
  });
}

function createArrivalEntry(direction, state) {
  const route = buildRouteVisual(direction.lineNo);
  const travelSeconds = Number.parseInt(state.travelTime, 10);
  const ttnt = Number.parseInt(state.value, 10);
  const absTime = Number.isNaN(Number.parseInt(state.arrivalTime, 10))
    ? (Number.isNaN(travelSeconds) ? null : new Date(Date.now() + travelSeconds * 1000))
    : new Date(Number.parseInt(state.arrivalTime, 10));

  return new ArrivalEntry(
    `${direction.endStation}|${direction.endStation}`,
    Number.isNaN(ttnt) ? 99 : ttnt,
    absTime,
    route,
    direction.badge,
    direction.targetOrder === 1 && (Number.isNaN(ttnt) ? 99 : ttnt) <= 1,
    {
      busId: state.busId || '',
      directionLabel: direction.directionLabel,
      stationName: direction.stationName,
      nextStationName: direction.nextStationName,
      targetOrder: direction.targetOrder,
      license: state.licence || '',
      travelTime: travelSeconds,
      lineTip: ''
    }
  );
}

function toStationArrivalEntries(direction, stationLine, limit) {
  const states = (stationLine?.stnStates || [])
    .filter((state) => state)
    .slice(0, limit);

  return states.map((state) => createArrivalEntry(direction, state));
}

function toLineDetailFallbackEntries(direction, detail, limit) {
  const buses = [...(detail?.buses || [])]
    .filter((bus) => bus)
    .sort((left, right) => {
      const leftOrder = Number.parseInt(left.specialOrder ?? left.order, 10);
      const rightOrder = Number.parseInt(right.specialOrder ?? right.order, 10);
      const leftDiff = Math.abs((Number.isNaN(leftOrder) ? Number.MAX_SAFE_INTEGER : leftOrder) - direction.targetOrder);
      const rightDiff = Math.abs((Number.isNaN(rightOrder) ? Number.MAX_SAFE_INTEGER : rightOrder) - direction.targetOrder);
      return leftDiff - rightDiff;
    })
    .slice(0, limit);

  return buses.map((bus) =>
    createArrivalEntry(direction, {
      busId: bus.busId,
      licence: bus.licence,
      value: Number.isNaN(Number.parseInt(bus.travelTime, 10))
        ? 99
        : Math.max(1, Math.ceil(Number.parseInt(bus.travelTime, 10) / 60)),
      travelTime: Number.parseInt(bus.travelTime, 10),
      arrivalTime: Number.isNaN(Number.parseInt(bus.travelTime, 10))
        ? null
        : Date.now() + Number.parseInt(bus.travelTime, 10) * 1000
    })
  );
}

function sortArrivalEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.absTime && right.absTime) {
      return left.absTime.getTime() - right.absTime.getTime();
    }
    return left.ttnt - right.ttnt;
  });
}

async function fetchRealtimeEntries(lineNo, stationName, directionSelection) {
  const directions = getSelectedDirections(lineNo, stationName, directionSelection);
  if (directions.length === 0) {
    return [];
  }

  const stationDetail = await fetchStationDetail(directions[0].stationId);
  const details = await Promise.all(
    directions.map(async (direction) => {
      const stationLine = (stationDetail?.lines || []).find(
        (item) => item?.line?.lineId === direction.lineId
      );

      const desiredLimit = directionSelection === 'BOTH_SPLIT' || directionSelection === 'BOTH' ? 2 : 4;
      let entries = toStationArrivalEntries(direction, stationLine, desiredLimit);

      // Some stations occasionally omit stnStates. Fall back to line detail rather than rendering empty rows.
      if (entries.length === 0) {
        const lineDetail = await fetchDirectionDetail(direction);
        entries = toLineDetailFallbackEntries(direction, lineDetail, desiredLimit);
      }

      return { direction, entries };
    })
  );

  if (directionSelection === 'BOTH_SPLIT') {
    return details.flatMap(({ entries }) => entries.slice(0, 2)).slice(0, 4);
  }

  const merged = details.flatMap(({ entries }) => entries);
  return sortArrivalEntries(merged).slice(0, 4);
}

export { fetchRealtimeEntries };
