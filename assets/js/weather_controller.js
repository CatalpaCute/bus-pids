'use strict';

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=24.8017&longitude=113.5970&current=temperature_2m,weather_code&timezone=Asia%2FShanghai';

const WEATHER_LABELS = new Map([
  [0, '晴'],
  [1, '晴间多云'],
  [2, '多云'],
  [3, '阴'],
  [45, '雾'],
  [48, '雾'],
  [51, '毛毛雨'],
  [53, '小雨'],
  [55, '中雨'],
  [56, '冻雨'],
  [57, '冻雨'],
  [61, '小雨'],
  [63, '中雨'],
  [65, '大雨'],
  [66, '冻雨'],
  [67, '冻雨'],
  [71, '小雪'],
  [73, '中雪'],
  [75, '大雪'],
  [77, '雪粒'],
  [80, '阵雨'],
  [81, '阵雨'],
  [82, '暴雨'],
  [85, '阵雪'],
  [86, '阵雪'],
  [95, '雷阵雨'],
  [96, '雷暴'],
  [99, '雷暴']
]);

export async function fetchWeatherData() {
  try {
    const response = await fetch(WEATHER_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const current = data.current || {};
    return {
      temperature: Math.round(current.temperature_2m || 0),
      iconText: WEATHER_LABELS.get(current.weather_code) || '天气'
    };
  } catch (error) {
    return null;
  }
}
