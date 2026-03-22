export default {
  intro: {
    languages: 'Language',
    language: {
      zh: '中文',
      en: 'English'
    },
    welcome: 'City Bus PIDS Simulator',
    description_1: 'This project studies the HKTSS MTR PIDS Simulator and swaps its data layer to the Chelaile H5 bus API.',
    description_2: 'You can now switch city first, then choose the route, stop, and direction while keeping the same operating flow.',
    description_3: 'The Chelaile API does not expose browser CORS, so the GitHub Pages build still needs a lightweight proxy URL for live data.',
    disclaimer: 'For personal learning only. Please do not scrape aggressively or use it for any improper purpose.',
    enquiries: 'You can switch to offline mode if you only want to preview the screen or record a demo without live requests.',
    oss: 'Reference project and source notes'
  },
  settings: {
    title: 'Display Settings',
    sections: {
      data: {
        title: 'Data',
        source: {
          name: 'Source',
          online: 'Live data',
          offline: 'Offline mock'
        },
        city: 'City',
        route: 'Bus route',
        station: 'Stop',
        direction: {
          name: 'Direction'
        },
        proxy: {
          name: 'Proxy base URL',
          placeholder: 'For example https://your-worker.example.com',
          hint: 'GitHub Pages cannot call Chelaile directly. The page will primarily request /api/station-detail from this proxy.'
        },
        custom: {
          name: 'Offline demo data',
          tips_1: 'Offline mode never calls the live API, which is useful for styling, screenshots, or demos.',
          tips_2: 'The round badge usually works best with a single character such as Up or Down.',
          destination: 'Destination',
          platform: 'Badge',
          eta: 'Minutes',
          route_color: 'Route color'
        }
      },
      display: {
        title: 'Display',
        adhoc: {
          name: 'Inserted message',
          NONE: 'Off',
          CIVILIZED: 'Courtesy',
          QUEUE: 'Queueing',
          SAFETY: 'Safety',
          EMERGENCY: 'Emergency'
        },
        mode: {
          name: 'Mode',
          NORMAL: 'Ads and arrivals',
          AD: 'Ads only',
          ADNT1: 'Ads + next service',
          NT4: 'Next 4 services',
          NT4_CT: 'Next 4 services (clock time)'
        },
        first_train_cutoff: {
          name: 'Hide list when the first bus is over this many minutes'
        },
        platform_number: 'Show direction badge',
        line: 'Show route title in header'
      },
      generic: {
        fullscreen: {
          entered: 'Exit fullscreen',
          exited: 'Enter fullscreen'
        },
        start: 'Start'
      }
    }
  }
};
