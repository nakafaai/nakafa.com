import type { Page } from "@playwright/test";
import { Effect } from "effect";

/** The link elements that ask the browser to preload a font file. */
export const PRELOADED_FONT_SELECTOR = 'link[rel="preload"][as="font"]';

const katexFile = /\/KaTeX_([^./]+)\.[^/]+\.woff2$/;

interface LoadedFontFace {
  readonly family: string;
  readonly style: string;
  readonly weight: string;
}

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
    fetched: state.fetched.flatMap(({ initiator, url }) => {
      const face = fileFace(url);
      return face ? [`${face} ${initiator}`] : [];
    }),
    loaded: state.loaded.flatMap((font) => loadedFace(font) ?? []),
    preloaded: state.preloaded.flatMap((url) => fileFace(url) ?? []),
  };
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
