'use strict';

import LANG_EN from './lang/en.js';
import LANG_ZH from './lang/zh.js';
import SETTINGS, { DATA_SOURCE } from '../static/settings.js';
import {
  DisplayMode,
  promotionData,
  ensureValidSettings,
  getDirectionOptions,
  getLine,
  getLines,
  getStationOptions,
  loadManifest
} from '../static/data.js';
import API from '../eta_controller.js';
import { save } from '../local_storage.js';

const { createApp, ref, computed, watch } = Vue;

await loadManifest();
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
    const routeReference = ref(SETTINGS.route);
    const stationReference = ref(SETTINGS.station);
    const directionReference = ref(SETTINGS.direction);
    const dataSourceReference = ref(SETTINGS.dataSource);
    const firstTrainCutoffReference = ref(SETTINGS.firstTrainCutoff);
    const proxyBaseUrlReference = ref(SETTINGS.proxyBaseUrl);
    const isFullscreen = ref(document.fullscreenElement != null);
    const { locale } = VueI18n.useI18n();

    const lines = computed(() => getLines());
    const selectedLine = computed(() => getLine(routeReference.value));
    const stationOptions = computed(() => getStationOptions(routeReference.value));
    const directionOptions = computed(() => getDirectionOptions(routeReference.value, stationReference.value));
    const usesFixedProxySource = computed(() => dataSourceReference.value === DATA_SOURCE.ONLINE_CZWORKS);
    const isLiveSource = computed(() => dataSourceReference.value !== DATA_SOURCE.OFFLINE);

    function syncDirection() {
      const options = directionOptions.value;
      if (!options.some((item) => item.value === directionReference.value)) {
        directionReference.value = options[0]?.value || '';
      }
      SETTINGS.direction = directionReference.value;
    }

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
      lines,
      selectedLine,
      stationOptions,
      directionOptions,
      routeReference,
      stationReference,
      directionReference,
      dataSourceReference,
      usesFixedProxySource,
      isLiveSource,
      DATA_SOURCE,
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
