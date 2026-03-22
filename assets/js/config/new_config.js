'use strict';

import LANG_EN from './lang/en.js';
import LANG_ZH from './lang/zh.js';
import SETTINGS from '../static/settings.js';
import {
  DisplayMode,
  promotionData,
  ensureValidSettings,
  getCities,
  getCityConfig,
  getDirectionOptions,
  getLine,
  getLines,
  getStationOptions,
  loadCityRegistry,
  loadManifest
} from '../static/data.js';
import API from '../eta_controller.js';
import { save } from '../local_storage.js';

const { createApp, ref, computed, watch } = Vue;

await loadCityRegistry();
await loadManifest(SETTINGS.city);
ensureValidSettings(SETTINGS);

const i18n = VueI18n.createI18n({
  legacy: false,
  locale: localStorage.getItem('ui_language') ?? 'zh',
  fallbackLocale: 'zh',
  messages: {
    en: LANG_EN,
    zh: LANG_ZH
  }
});

const app = createApp({
  setup() {
    const cityReference = ref(SETTINGS.city);
    const routeReference = ref(SETTINGS.route);
    const stationReference = ref(SETTINGS.station);
    const directionReference = ref(SETTINGS.direction);
    const dataSourceReference = ref(SETTINGS.dataSource);
    const firstTrainCutoffReference = ref(SETTINGS.firstTrainCutoff);
    const proxyBaseUrlReference = ref(SETTINGS.proxyBaseUrl);
    const isFullscreen = ref(document.fullscreenElement != null);
    const manifestVersion = ref(0);
    const { locale } = VueI18n.useI18n();

    const cities = computed(() => {
      manifestVersion.value;
      return getCities();
    });
    const lines = computed(() => {
      manifestVersion.value;
      return getLines();
    });
    const selectedLine = computed(() => {
      manifestVersion.value;
      return getLine(routeReference.value);
    });
    const selectedCity = computed(() => getCityConfig(cityReference.value));
    const stationOptions = computed(() => {
      manifestVersion.value;
      return getStationOptions(routeReference.value);
    });
    const directionOptions = computed(() => {
      manifestVersion.value;
      return getDirectionOptions(routeReference.value, stationReference.value);
    });

    function syncDirection() {
      const options = directionOptions.value;
      if (!options.some((item) => item.value === directionReference.value)) {
        directionReference.value = options[0]?.value || '';
      }
      SETTINGS.direction = directionReference.value;
    }

    watch(cityReference, async (newValue) => {
      if (!getCityConfig(newValue)) {
        return;
      }
      SETTINGS.city = newValue;
      await loadManifest(newValue);
      manifestVersion.value += 1;
      ensureValidSettings(SETTINGS);
      routeReference.value = SETTINGS.route;
      stationReference.value = SETTINGS.station;
      directionReference.value = SETTINGS.direction;
    });

    watch(routeReference, (newValue) => {
      SETTINGS.route = newValue;
      const stations = getStationOptions(newValue);
      if (!stations.includes(stationReference.value)) {
        stationReference.value = stations[0] || '';
      }
      syncDirection();
    });

    watch(stationReference, (newValue) => {
      SETTINGS.station = newValue;
      syncDirection();
    });

    watch(directionReference, (newValue) => {
      SETTINGS.direction = newValue;
    });

    watch(dataSourceReference, (newValue) => {
      SETTINGS.dataSource = newValue;
    });

    watch(firstTrainCutoffReference, (newValue) => {
      SETTINGS.firstTrainCutoff = Number.parseInt(newValue, 10) || 20;
    });

    watch(proxyBaseUrlReference, (newValue) => {
      SETTINGS.proxyBaseUrl = String(newValue || '').trim();
    });

    function toggleFullscreen(event) {
      event.preventDefault();
      if (isFullscreen.value) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
      isFullscreen.value = !isFullscreen.value;
    }

    function close(event) {
      event.preventDefault();
      document.querySelector('#overlay').classList.add('hidden');
      save();
      localStorage.setItem('ui_language', locale.value);
    }

    return {
      isFullscreen,
      SETTINGS,
      promotionData,
      DisplayMode,
      API,
      cities,
      lines,
      selectedCity,
      selectedLine,
      stationOptions,
      directionOptions,
      cityReference,
      routeReference,
      stationReference,
      directionReference,
      dataSourceReference,
      firstTrainCutoffReference,
      proxyBaseUrlReference,
      toggleFullscreen,
      close
    };
  },
  mounted() {
    document.querySelector('#overlay').classList.remove('hidden');
  }
});

app.use(i18n);
app.mount('#overlay');
