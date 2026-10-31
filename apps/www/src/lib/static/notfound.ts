// The Vite config imports this module, and only package imports resolve there.
import { MODULE_PRELOAD } from "#www/src/lib/static/scripts";

/** Every script element, with its attributes and its body. */
const SCRIPT_ELEMENT = /<script\b[^>]*>(?<body>[\s\S]*?)<\/script>/gu;

/** The start of a streamed Suspense segment, which React writes hidden at the end of the body with its boundary's id. */
const SEGMENT_PREFIX = '<div hidden id="S:';

/** A streamed Suspense segment's opening tag. */
const SEGMENT_OPENING = /<div hidden id="S:[^"]+">/u;

/** The next opening or closing `div` tag. */
const DIV_TAG = /<div\b|<\/div>/u;

const DIV_OPENING = "<div";

const DIV_CLOSING = "</div>";

/** The index just past the `</div>` that closes the `div` open at `from`, counting the `div` elements nested in it. */
function closingDivEnd(html: string, from: number, depth: number): number {
  const next = html.slice(from).search(DIV_TAG);
  if (next === -1) {
    return html.length;
  }
  const at = from + next;
  if (!html.startsWith(DIV_CLOSING, at)) {
    return closingDivEnd(html, at + DIV_OPENING.length, depth + 1);
  }
  return depth === 1
    ? at + DIV_CLOSING.length
    : closingDivEnd(html, at + DIV_CLOSING.length, depth - 1);
}

/**
 * Moves each streamed Suspense segment into its boundary, as React's inline reveal script does in the browser, so the
 * static page shows it with no script. A boundary that waits for its segment holds an empty template and its fallback.
 */
function revealStreamedSegments(html: string): string {
  const opening = SEGMENT_OPENING.exec(html);
  if (opening === null) {
    return html;
  }
  const id = opening[0].slice(SEGMENT_PREFIX.length, -'">'.length);
  const contentStart = opening.index + opening[0].length;
  const end = closingDivEnd(html, contentStart, 1);
  const content = html.slice(contentStart, end - DIV_CLOSING.length);
  const rest = html.slice(0, opening.index) + html.slice(end);
  const boundary = `<!--$?--><template id="B:${id}"></template>`;
  const boundaryAt = rest.indexOf(boundary);
  if (boundaryAt === -1) {
    return revealStreamedSegments(rest);
  }
  const boundaryEnd = rest.indexOf("<!--/$-->", boundaryAt);
  return revealStreamedSegments(
    `${rest.slice(0, boundaryAt)}<!--$-->${content}${rest.slice(boundaryEnd)}`
  );
}

/** The path of the not-found page that the build prerenders for one locale. */
export function notFoundPagePath(locale: string) {
  return `/_notfound/${locale}`;
}

/**
 * The path of one locale's not-found page for a school host, which is also where the build writes it, without its
 * `.html` extension, so the assets answer it at that address.
 */
export function schoolNotFoundPath(locale: string) {
  return `/_notfound/school/${locale}`;
}

/** Where the build writes one locale's not-found page, without its `.html` extension. */
export function notFoundOutputPath(locale: string) {
  return `/${locale}/404`;
}

/**
 * The static not-found document of one locale, made from its prerendered page. The page keeps its markup, its
 * stylesheets and the one inline script that `kept` names, such as the theme that paints before load, and loses every
 * other script and module preload. Those start the app, whose router would read the missing address and render
 * another route, so the document must not hydrate. React's own reveal scripts go too, so each streamed segment, such
 * as Nina's figure, is moved into its boundary first.
 */
export function staticNotFoundDocument(prerendered: string, kept: string) {
  return revealStreamedSegments(prerendered)
    .replace(SCRIPT_ELEMENT, (element, body: string) =>
      body === kept ? element : ""
    )
    .replace(MODULE_PRELOAD, "");
}
