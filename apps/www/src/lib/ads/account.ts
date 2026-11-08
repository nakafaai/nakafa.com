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
