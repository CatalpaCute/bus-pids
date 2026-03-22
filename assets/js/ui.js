'use strict';

import SETTINGS from './static/settings.js';
import HEADER_BAR from './header_bar.js';
import PROMO from './promo.js';

import {
  UIPreset,
  buildRouteVisual,
  getLine,
  isSplitDirectionSelection
} from './static/data.js';

const Chinese = /\p{Script=Han}/u;

let arrivalVisibility = [true, true, true, true];
let languageCycle = 0;
let pauseUIUpdate = false;

const MARQUEE_SCROLL_TIME = 10 * 1000;

function getActiveRoute(etaData) {
  return etaData[0]?.route || buildRouteVisual(SETTINGS.route);
}

function getDisplayEta(entry) {
  if (!entry) {
    return 99;
  }
  if (entry.absTime instanceof Date) {
    return Math.max(Math.ceil((entry.absTime.getTime() - Date.now()) / 60000), 0);
  }
  return entry.ttnt;
}

function enrichEntries(etaData) {
  return etaData.map((entry) => ({
    ...entry,
    displayTtnt: getDisplayEta(entry)
  }));
}

function drawUI(rawEtaData) {
  if (pauseUIUpdate) {
    return;
  }

  const etaData = enrichEntries(rawEtaData);

  PROMO.draw(
    etaData,
    cycleLanguage,
    () => {
      marquee.startScroll = Date.now();
    },
    (newVisibility) => {
      arrivalVisibility = newVisibility;
    }
  );

  HEADER_BAR.draw();
  $('body').css('--route-color', getActiveRoute(etaData).color);

  if (isSplitDirectionSelection(SETTINGS.direction)) {
    $('.divider').show();
  } else {
    $('.divider').hide();
  }

  let entryIndex = 0;
  $('#arrivalOverlay > tbody > tr').each(function drawRow(index) {
    const rowVisible = arrivalVisibility[index];
    let entry = etaData[entryIndex];

    while (entry && !isArrivalEntryValid(entry)) {
      entryIndex += 1;
      entry = etaData[entryIndex];
    }

    if (!rowVisible || !entry) {
      $(this).replaceWith('<tr><td class="destination">&nbsp;</td><td style="width:10%">&nbsp;</td><td class="eta">&nbsp;</td></tr>');
      return;
    }

    const displayTtnt = entry.displayTtnt;
    const showArrivalRow = SETTINGS.debugMode || (etaData[0]?.displayTtnt ?? 99) <= SETTINGS.firstTrainCutoff;
    if (!showArrivalRow) {
      $(this).replaceWith('<tr><td class="destination">&nbsp;</td><td style="width:10%">&nbsp;</td><td class="eta">&nbsp;</td></tr>');
      return;
    }

    const destinationName = switchLang(entry.dest);
    const time = SETTINGS.displayMode === 'NT4_CT'
      ? getETATime(entry)
      : getETAMin(displayTtnt, entry.isDeparture);
    const timeText = SETTINGS.displayMode === 'NT4_CT'
      ? ''
      : getETAText(displayTtnt, entry.isDeparture);

    const platformElement = SETTINGS.showPlatform
      ? `<td class="plat"><span class="plat-circle" style="background-color: ${entry.route.color}">${entry.plat}</span></td>`
      : '<td class="plat"></td>';

    const tableRow = `
      <tr>
        <td class="destination scalable"><div class="destination-name">${destinationName}</div></td>
        ${platformElement}
        <td class="eta scalable">${time} <span class="etamin">${switchLang(timeText)}</span></td>
      </tr>
    `;

    $(this).replaceWith(tableRow);
    entryIndex += 1;
  });

  changeUIPreset();
  adjustLayoutSize();
}

let animFrame = null;

function adjustLayoutSize() {
  $('.destination').each(function resizeDestination() {
    const originalSize = SETTINGS.uiPreset.fontRatio * Number.parseInt($(this).css('font-size'), 10);
    const padding = 120 * (window.innerWidth / 1920);
    const availableWidth = $(this).outerWidth(true) - padding;

    $('#check-content').html($(this).html());
    $('#check-content').css('font-size', originalSize);
    $('#check-content').css('font-family', $(this).css('font-family'));
    $('#check-content').css('letter-spacing', $(this).css('letter-spacing'));
    $('#check-content').css('font-weight', $(this).css('font-weight'));

    const contentWidth = $('#check-content').outerWidth(true);
    if (contentWidth > availableWidth) {
      const ratio = availableWidth / contentWidth;
      if (ratio < 0.8) {
        $(this).find('.destination-name').addClass('marquee');
      } else {
        $(this).find('.destination-name').removeClass('marquee');
        $(this).css('font-size', `${originalSize * ratio}px`);
      }
    } else {
      $(this).find('.destination-name').removeClass('marquee');
      $(this).css('font-size', `${originalSize}px`);
    }
  });

  if (document.querySelectorAll('.marquee').length > 0) {
    if (animFrame == null) {
      animFrame = requestAnimationFrame(startMarqueeLoop);
    }
  } else if (animFrame != null) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
}

const marquee = {
  progress: 100,
  startScroll: -1
};

function startMarqueeLoop() {
  if (marquee.startScroll < 0) {
    marquee.startScroll = Date.now();
  }

  const endScroll = marquee.startScroll + MARQUEE_SCROLL_TIME;
  const scrollProgress = (Date.now() - marquee.startScroll) / (endScroll - marquee.startScroll);
  marquee.progress = scrollProgress * 105;
  const translationPercentage = (-marquee.progress * 2) + 100;

  document.querySelectorAll('.marquee').forEach((element) => {
    element.style.transform = `translateX(${translationPercentage}%)`;
  });
  animFrame = requestAnimationFrame(startMarqueeLoop);
}

function getETAMin(eta) {
  if (eta <= 1) {
    return '';
  }
  if (eta > 99) {
    return '99';
  }
  return eta;
}

function getETATime(entry) {
  const date = entry.absTime instanceof Date
    ? entry.absTime
    : new Date(Date.now() + getDisplayEta(entry) * 60 * 1000);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function getETAText(eta, departure) {
  if (eta <= 1) {
    return departure ? '即将发车|Departing' : '即将到站|Arriving';
  }
  return '分钟|min';
}

function isArrivalEntryValid(entry) {
  return (
    entry != null &&
    typeof entry.dest === 'string' &&
    entry.dest.length > 0 &&
    !Number.isNaN(Number.parseInt(entry.displayTtnt, 10))
  );
}

function switchLang(str) {
  const values = String(str || '').split('|').filter(Boolean);
  if (values.length === 0) {
    return '';
  }
  return values[languageCycle % values.length];
}

function cycleLanguage() {
  languageCycle += 1;
}

function changeUIPreset() {
  const preset = UIPreset.default;
  $('body').css('--font-weight', preset.fontWeight);
  $('body').css('--platcircle-family', preset.platformCircle);
  SETTINGS.uiPreset = preset;

  $('.destination').each(function applySpacing() {
    const isChinese = Chinese.test($(this).text());
    $(this).css('letter-spacing', isChinese ? preset.chinFontSpacing : 'normal');
  });
}

function setupDebugKeybind() {
  $(window).on('keydown', (event) => {
    if (event.which === 71 && SETTINGS.debugMode) {
      PROMO.cycle();
      PROMO.draw([], cycleLanguage, (newVisibility) => {
        arrivalVisibility = newVisibility;
      });
      cycleLanguage();
      drawUI([]);
    }

    if (event.which === 70 && SETTINGS.debugMode) {
      pauseUIUpdate = !pauseUIUpdate;
    }
  });
}

async function setup() {
  await HEADER_BAR.setup();
  PROMO.setup();
  setupDebugKeybind();
}

export default { setup, draw: drawUI, switchLang, cycleLanguage };
