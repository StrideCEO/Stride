// Embedded YouTube videos: send "video_played" and "video_finished" to PostHog.
// Works on any <iframe data-video-id="..." data-placement="..."> with enablejsapi=1.
// YouTube's tracking API only loads once a video is about to scroll into view.
(function () {
  var frames = document.querySelectorAll('iframe[data-video-id]');
  if (!frames.length) return;

  function track(event, frame) {
    if (!window.posthog || typeof window.posthog.capture !== 'function') return;
    window.posthog.capture(event, {
      video_id: frame.getAttribute('data-video-id'),
      placement: frame.getAttribute('data-placement') || '',
      page: window.location.pathname
    });
  }

  function attach(frame) {
    var sent = {};
    try {
      new window.YT.Player(frame, {
        events: {
          onStateChange: function (e) {
            var event = e.data === 1 ? 'video_played' : e.data === 0 ? 'video_finished' : null;
            if (!event || sent[event]) return;
            sent[event] = true;
            track(event, frame);
          }
        }
      });
    } catch (err) { /* tracking is optional; the video still plays */ }
  }

  var loading = false;
  function loadApi() {
    if (loading) return;
    loading = true;
    var previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previous === 'function') previous();
      Array.prototype.forEach.call(frames, attach);
    };
    var script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  }

  if (!('IntersectionObserver' in window)) {
    loadApi();
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        observer.disconnect();
        loadApi();
        return;
      }
    }
  }, { rootMargin: '400px 0px' });
  Array.prototype.forEach.call(frames, function (frame) { observer.observe(frame); });
})();
