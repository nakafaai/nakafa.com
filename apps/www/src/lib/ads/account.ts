import { Schema } from "effect";

/**
 * The AdSense account that serves Nakafa's ads, as the client id its ad tags and
 * its site verification name. The site's `ads.txt` names the same account by its
 * publisher id, which is this id without the `ca-` prefix.
 */
export const AD_CLIENT = "ca-pub-2770627429499889";

/**
 * The head entry that tells AdSense this site belongs to the account. Every
 * document carries it, and it loads no ad script.
 */
export const AD_ACCOUNT_META = {
  content: AD_CLIENT,
  name: "google-adsense-account",
} as const;

/** The pages that show ads, each with its own unit so the reports tell them apart. */
export const AdUnit = Schema.Literals(["article", "material"]);

export type AdUnit = typeof AdUnit.Type;

/**
 * The slot of each responsive display unit, as AdSense created it: "Artikel" for
 * article pages and "Materi" for lessons.
 */
export const AD_SLOTS = {
  article: "6615143608",
  material: "2302308168",
} as const satisfies Record<AdUnit, string>;

/**
 * The Google origins that the ad script reaches, by policy directive: its own
 * scripts and the consent message's, the frames each ad and the traffic check
 * draw in, and the requests they send. AdSense publishes no list and supports
 * only a nonce policy, which a prerendered page cannot carry, so these are the
 * origins a page with ads was measured to load, each family under one wildcard.
 * Images need nothing here: the policy allows every https image.
 */
export const AD_POLICY_SOURCES = {
  connect: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://*.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
    "https://csi.gstatic.com",
  ],
  frame: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://*.adtrafficquality.google",
    "https://www.google.com",
  ],
  script: [
    "https://*.googlesyndication.com",
    "https://*.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
} as const;
