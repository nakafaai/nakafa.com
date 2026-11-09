import { MAIN_DOMAIN } from "@repo/site/domains";
import { Array as Arr, Effect, Schema } from "effect";
import { AD_CLIENT } from "@/lib/ads/account";
import { followConsentMessage } from "@/lib/ads/consent";

/** Google's ad script for the account, which also starts the consent message where a region needs one. */
export const AD_SCRIPT_SOURCE = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

/** The id of the one ad script of a document. */
const SCRIPT_ID = "adsbygoogle-script";

/** The attribute where the script records how its load ended, so a later frame reads it at once. */
const OUTCOME_ATTRIBUTE = "data-outcome";

/** The attribute a unit carries once it has asked for its ad, so it never asks twice. */
const ASKED_ATTRIBUTE = "data-ad-asked";

/** The attribute that asks AdSense for a test ad, which counts no impression and no click. */
const TEST_ATTRIBUTE = "data-adtest";

/** The attribute where AdSense answers whether a unit got an ad: `filled` or `unfilled`. */
const STATUS_ATTRIBUTE = "data-ad-status";

/** The ad script did not load: an ad blocker, the network, or the content policy stopped it. */
export class AdScriptFailed extends Schema.TaggedError<
  AdScriptFailed,
  { readonly brand: unique symbol }
>()("AdScriptFailed", {}) {}

/** The ad queue of the page, started as an array until the ad script takes it over. */
function adQueue(): GoogleQueue {
  const queue = window.adsbygoogle ?? Arr.empty<object>();
  window.adsbygoogle = queue;
  return queue;
}

/**
 * Adds the ad script to the document, asks for non-personalized ads, records how
 * its load ends, and starts following the consent message.
 */
function appendAdScript() {
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.id = SCRIPT_ID;
  script.src = AD_SCRIPT_SOURCE;
  script.addEventListener(
    "load",
    () => script.setAttribute(OUTCOME_ATTRIBUTE, "loaded"),
    { once: true }
  );
  script.addEventListener(
    "error",
    () => script.setAttribute(OUTCOME_ATTRIBUTE, "failed"),
    { once: true }
  );
  // Every ad is non-personalized: Nakafa uses no one's data for targeted
  // advertising, as its privacy policy commits, and many readers are under 18.
  adQueue().requestNonPersonalizedAds = 1;
  document.head.append(script);
  followConsentMessage();
  return script;
}

/**
 * Loads the ad script once per document and completes once it has loaded. Every
 * frame of every page waits here: the first adds the script, a later one finds it
 * and reads how its load ended, or waits with the first. A load that fails fails
 * every waiter. A wait removes its listeners when it completes or is interrupted.
 */
export const loadAdScript = Effect.callback<void, AdScriptFailed>((resume) => {
  const script =
    document.querySelector<HTMLScriptElement>(`#${SCRIPT_ID}`) ??
    appendAdScript();
  const outcome = script.getAttribute(OUTCOME_ATTRIBUTE);
  if (outcome === "loaded") {
    resume(Effect.void);
    return;
  }
  if (outcome === "failed") {
    resume(Effect.fail(new AdScriptFailed()));
    return;
  }
  const stop = () => {
    script.removeEventListener("load", loaded);
    script.removeEventListener("error", failed);
  };
  const loaded = () => {
    stop();
    resume(Effect.void);
  };
  const failed = () => {
    stop();
    resume(Effect.fail(new AdScriptFailed()));
  };
  script.addEventListener("load", loaded);
  script.addEventListener("error", failed);
  return Effect.sync(stop);
});

/**
 * Asks AdSense for one unit's ad. AdSense fills the next unit in the document that
 * it has not filled, so each unit asks once: a unit marks itself as it asks, and
 * a render that runs twice finds the mark. A unit on any host but production
 * asks for a test ad, so a local build, a preview and staging never count an
 * impression or a click.
 */
export const requestAd = (unit: HTMLElement, hostname: string) =>
  Effect.sync(() => {
    if (unit.hasAttribute(ASKED_ATTRIBUTE)) {
      return;
    }
    unit.setAttribute(ASKED_ATTRIBUTE, "");
    if (hostname !== MAIN_DOMAIN) {
      unit.setAttribute(TEST_ATTRIBUTE, "on");
    }
    adQueue().push({});
  });

/**
 * Completes once AdSense has put an ad in the unit. A unit AdSense leaves
 * unfilled, as it does while the site waits for review, or one the script never
 * reached, keeps waiting until its frame leaves. The watcher stops when the wait
 * completes or is interrupted.
 */
export const untilFilled = (unit: HTMLElement) =>
  Effect.callback<void>((resume) => {
    const check = () => {
      if (unit.getAttribute(STATUS_ATTRIBUTE) === "filled") {
        watcher.disconnect();
        resume(Effect.void);
      }
    };
    const watcher = new MutationObserver(check);
    watcher.observe(unit, { attributeFilter: [STATUS_ATTRIBUTE] });
    check();
    return Effect.sync(() => watcher.disconnect());
  });
