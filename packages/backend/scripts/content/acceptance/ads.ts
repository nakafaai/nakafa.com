/**
 * Where the acceptance runtime serves its stand-in for Google's ad script, on the
 * origin of its analytics stand-in. A proof's build names this address in
 * `VITE_AD_SCRIPT_URL`, so the page runs its own loading path and no third-party
 * script reaches a test.
 */
export const AD_SCRIPT_PATH = "/ads.js";

/**
 * The stand-in for Google's ad script. It answers every unit that asks with no
 * ad, as AdSense answers a site it does not fill: it takes over the page's ad
 * queue, keeps the queue's request for non-personalized ads, and marks each unit
 * that asked as unfilled whenever the page pushes.
 */
export const AD_SCRIPT = `(() => {
  const answer = () => {
    for (const unit of document.querySelectorAll("ins.adsbygoogle[data-ad-asked]:not([data-ad-status])")) {
      unit.setAttribute("data-ad-status", "unfilled");
    }
  };
  const queue = window.adsbygoogle ?? [];
  window.adsbygoogle = { push: answer, requestNonPersonalizedAds: queue.requestNonPersonalizedAds };
  answer();
})();
`;
