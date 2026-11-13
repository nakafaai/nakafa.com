/**
 * A queue that Google's scripts read. It starts as an array, and once a script
 * loads it replaces the array with its own object, whose push acts at once, so
 * the page only ever pushes to it.
 */
interface GoogleQueue {
  push: (item: object) => void;
  /** Set to 1 before the first ad, so every ad of the page is non-personalized. */
  requestNonPersonalizedAds?: 1;
}

/**
 * The globals that Google's ad script and its consent message share with the
 * page: the ad queue each unit pushes to, the queue of callbacks the consent
 * message runs once it is ready, and the IAB TCF API it then exposes.
 */
interface Window {
  __tcfapi?: (
    command: "addEventListener",
    version: number,
    callback: (data: unknown, success: boolean) => void
  ) => void;
  adsbygoogle?: GoogleQueue;
  /** Google Analytics' command queue, which reads the `arguments` of each call. */
  dataLayer?: IArguments[];
  googlefc?: { callbackQueue?: GoogleQueue };
}
