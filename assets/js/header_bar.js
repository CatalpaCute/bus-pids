'use strict';

import { fetchWeatherData } from './weather_controller.js';
import SETTINGS from './static/settings.js';
import UI from './ui.js';
import { getCurrentCitySlug, getLineTitle } from './static/data.js';

let lastWeatherCitySlug = '';

function updateClock() {
  const currDate = new Date();
  $('.clock').text(
    currDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    })
  );
}

async function updateWeather() {
  lastWeatherCitySlug = getCurrentCitySlug();
  const weatherData = await fetchWeatherData();
  if (!weatherData) {
    return;
  }

  const weatherIconElement = document.querySelector('#weather-icon');
  weatherIconElement.innerHTML = `<span>${weatherData.iconText}</span>`;
  document.querySelector('#temperature').textContent = `${weatherData.temperature}°C`;
}

function updateHeader() {
  if (SETTINGS.rtHeader) {
    $('.t1').hide();
    $('.t2').show();
    $('#header-bar').addClass('route-color');
    $('.rtname').text(UI.switchLang(getLineTitle(SETTINGS.route)));
    $('body').css('--title-height', '17vh');
    return;
  }

  $('.t2').hide();
  $('.t1').show();
  $('#header-bar').removeClass('route-color');
  $('body').css('--title-height', '13.7vh');
}

function draw() {
  if (lastWeatherCitySlug !== getCurrentCitySlug()) {
    updateWeather();
  }
  updateHeader();
  updateClock();
}

async function setup() {
  await updateWeather();
  setInterval(updateWeather, 10 * 60 * 1000, false);
  $('#configure-button').click(() => {
    document.querySelector('#overlay').classList.remove('hidden');
  });
}

export default { setup, draw };
