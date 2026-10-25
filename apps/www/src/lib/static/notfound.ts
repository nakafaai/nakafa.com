/** Every script element, with its attributes and its body. */
const SCRIPT_ELEMENT = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

/** Every link that preloads a JavaScript module. */
const MODULE_PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*>/g;

/** The path of the not-found page that the build prerenders for one locale. */
export function notFoundPagePath(locale: string) {
  return `/_notfound/${locale}`;
}

/** Where the build writes one locale's not-found page, without its `.html` extension. */
export function notFoundOutputPath(locale: string) {
  return `/${locale}/404`;
}

/**
 * The static not-found document of one locale, made from its prerendered page. The page keeps its markup, its
 * stylesheets and the one inline script that `kept` names, such as the theme that paints before load, and loses every
 * other script and module preload. Those start the app, whose router would read the missing address and render
 * another route, so the document must not hydrate.
 */
export function staticNotFoundDocument(prerendered: string, kept: string) {
  return prerendered
    .replace(SCRIPT_ELEMENT, (element, body: string) =>
      body === kept ? element : ""
    )
    .replace(MODULE_PRELOAD, "");
}
