import type { Page } from "@playwright/test";
import { Array as Arr, Effect, Schema } from "effect";

/** The link elements that ask the browser to preload a font file. */
export const PRELOADED_FONT_SELECTOR = 'link[rel="preload"][as="font"]';

const katexFile = /\/KaTeX_([^./]+)\.[^/]+\.woff2$/;

const LoadedFontFaceSchema = Schema.Struct({
  family: Schema.String,
  style: Schema.String,
  weight: Schema.String,
});

type LoadedFontFace = typeof LoadedFontFaceSchema.Type;

/** Names a KaTeX file the way KaTeX does, such as `Main-Regular`. */
function fileFace(url: string) {
  return katexFile.exec(new URL(url).pathname)?.[1];
}

/** Names a loaded KaTeX face the way its file is named. */
function loadedFace({ family, style, weight }: LoadedFontFace) {
  if (!family.startsWith("KaTeX_")) {
    return;
  }
  const bold = weight === "bold" || weight === "700" ? "Bold" : "";
  const italic = style === "italic" ? "Italic" : "";
  return `${family.slice("KaTeX_".length)}-${bold + italic || "Regular"}`;
}

/** Reads which KaTeX faces the page preloads, fetches, and draws with. */
export const readMathFonts = Effect.fn("NakafaE2E.readMathFonts")(function* (
  page: Page
) {
  const state = yield* Effect.promise(() =>
    page.evaluate(
      (preloadedSelector) => ({
        fetched: performance
          .getEntriesByType("resource")
          .filter((entry) => entry instanceof PerformanceResourceTiming)
          .map((entry) => ({
            initiator: entry.initiatorType,
            url: entry.name,
          })),
        loaded: [...document.fonts]
          .filter((font) => font.status === "loaded")
          .map(({ family, style, weight }) => ({ family, style, weight })),
        preloaded: [
          ...document.querySelectorAll<HTMLLinkElement>(preloadedSelector),
        ].map((link) => link.href),
      }),
      PRELOADED_FONT_SELECTOR
    )
  );
  return {
    fetched: Arr.flatMap(state.fetched, ({ initiator, url }) => {
      const face = fileFace(url);
      return face ? [`${face} ${initiator}`] : [];
    }),
    loaded: Arr.flatMap(state.loaded, (font) => {
      const face = loadedFace(font);
      return face === undefined ? [] : [face];
    }),
    preloaded: Arr.flatMap(state.preloaded, (url) => {
      const face = fileFace(url);
      return face === undefined ? [] : [face];
    }),
  };
});

/**
 * Loads the KaTeX faces the page declares. A formula's face loads the first
 * time layout finds it, so a page that shows math for the first time reflows
 * its text once the face arrives. A check that measures a navigation loads the
 * faces first, so that reflow is not counted as the navigation's.
 */
export const loadMathFonts = Effect.fn("NakafaE2E.loadMathFonts")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.evaluate(() =>
      Promise.all(
        [...document.fonts]
          .filter((face) => face.family.startsWith("KaTeX"))
          .map((face) => face.load())
      ).then(() => undefined)
    )
  );
});

/** Reads the Quran typeface's font files from the page's stylesheets. */
export const readTypefaceFiles = Effect.fn("NakafaE2E.readTypefaceFiles")(
  function* (page: Page) {
    return yield* Effect.promise(() =>
      page.evaluate(() =>
        [...document.styleSheets].flatMap((sheet) =>
          [...sheet.cssRules].flatMap((rule) => {
            if (
              !(rule instanceof CSSFontFaceRule) ||
              rule.style.getPropertyValue("font-family").replaceAll('"', "") !==
                "Amiri"
            ) {
              return [];
            }
            const source = rule.style.getPropertyValue("src");
            const start = source.indexOf("url(") + "url(".length;
            return [
              new URL(
                source
                  .slice(start, source.indexOf(")", start))
                  .replaceAll('"', ""),
                sheet.href ?? location.href
              ).pathname,
            ];
          })
        )
      )
    );
  }
);
