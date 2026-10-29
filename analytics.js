// Website analytics: PostHog (the same project as the app) plus ad attribution.
//
// Give each ad its own link with utm tags, for example:
//   https://runstride.org/for-coaches.html?utm_source=instagram&utm_campaign=coach1
// The tags are remembered for 30 days, so a visitor who browses to another page
// still counts for that ad. They are attached to every event as ad_* properties
// and passed on to the App Store links, so App Store Connect can count installs
// per ad.
(function () {
  var POSTHOG_KEY = 'phc_LgimMgRlWJSbQRYNm526ROJGPsWpndAS3LK4aVAHcz9';
  var POSTHOG_HOST = 'https://us.i.posthog.com';
  // The pt=... in a link from App Store Connect > Analytics > Acquisition >
  // Campaigns > "Generate a Campaign Link". Installs then show up there per ad.
  var APP_STORE_PROVIDER_TOKEN = '127850192';
  // App Store Connect shows campaign names up to 30 characters.
  var CAMPAIGN_MAX = 30;

  var AD_KEY = 'stride_ad';
  var AD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  // The ad this visitor came from: tags in this URL, else the ones saved from
  // an earlier visit within the last 30 days.
  function findAd() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = null;
    ['source', 'medium', 'campaign', 'content'].forEach(function (key) {
      var value = params.get('utm_' + key);
      if (value) {
        fromUrl = fromUrl || {};
        fromUrl[key] = value.slice(0, 100);
      }
    });
    try {
      if (fromUrl) {
        fromUrl.at = Date.now();
        localStorage.setItem(AD_KEY, JSON.stringify(fromUrl));
        return fromUrl;
      }
      var saved = JSON.parse(localStorage.getItem(AD_KEY) || 'null');
      if (saved && Date.now() - saved.at < AD_TTL_MS) return saved;
    } catch (e) {}
    return fromUrl;
  }

  var ad = findAd();

  // PostHog's loader: calls made before array.js arrives are queued here and
  // replayed by it, after which window.posthog is the real client.
  var stub = window.posthog = window.posthog || [];
  if (!stub.__SV) {
    stub._i = [];
    stub.people = [];
    ['capture', 'register', 'identify', 'reset', 'opt_in_capturing', 'opt_out_capturing'].forEach(function (method) {
      stub[method] = function () {
        stub.push([method].concat(Array.prototype.slice.call(arguments)));
      };
    });
    stub.init = function (key, config) {
      stub._i.push([key, config, 'posthog']);
    };
    stub.__SV = 1;
    var script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
    document.head.appendChild(script);
  }

  stub.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    disable_session_recording: true,
    // Runs before the first pageview is sent, so it carries the ad too.
    loaded: function (posthog) {
      posthog.register({ site: 'runstride.org' });
      if (ad) {
        posthog.register({
          ad_source: ad.source || null,
          ad_medium: ad.medium || null,
          ad_campaign: ad.campaign || null,
          ad_content: ad.content || null,
        });
      }
    },
  });

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    var links = document.querySelectorAll('a[href*="apps.apple.com"]');
    Array.prototype.forEach.call(links, function (link) {
      if (ad && APP_STORE_PROVIDER_TOKEN) {
        var url = new URL(link.href);
        url.searchParams.set('pt', APP_STORE_PROVIDER_TOKEN);
        url.searchParams.set('ct', (ad.campaign || ad.source || 'web').slice(0, CAMPAIGN_MAX));
        url.searchParams.set('mt', '8');
        link.href = url.toString();
      }
      link.addEventListener('click', function () {
        // window.posthog, not the stub: after loading it is the real client.
        window.posthog.capture('download_clicked', {
          page: window.location.pathname,
          link_text: (link.textContent || '').trim().slice(0, 60),
        }, { transport: 'sendBeacon' });
      });
    });
  });
})();
