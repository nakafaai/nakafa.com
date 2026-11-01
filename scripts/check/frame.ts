import { Array as Arr } from "effect";
import { TEST_PATTERN } from "#scripts/check/kinds";

/** The one module that names a page's widths. */
const WIDTH_MODULE = "apps/www/src/components/shared/content/width.ts";
/** The app's pages, whose header, tab row and body share one frame. */
const APP_SOURCE = /^apps\/www\/src\//u;
/** The marketing pages draw no page header, so each section keeps its own width. */
const MARKETING_SOURCE =
  /^apps\/www\/src\/(?:components\/marketing|routes\/\$locale\/_marketing)\//u;
/** A page's width as a bare class. A width behind a breakpoint sizes a sheet, not a page. */
const PAGE_WIDTH = /(?<![\w:-])max-w-(?:3xl|7xl)(?![\w-])/gu;

/**
 * Reports a page width written by hand. Header and body disagreed the moment each named its own, so a row reads the
 * page's frame through `pageRowVariants` or `pageBoxVariants`, and a text inside a wider page takes
 * `readingMeasureVariants`. Tailwind reads classes from raw text, so this policy scans the same text.
 */
export function inspectFrameSource(file: string, sourceText: string) {
  if (
    file === WIDTH_MODULE ||
    TEST_PATTERN.test(file) ||
    !APP_SOURCE.test(file) ||
    MARKETING_SOURCE.test(file)
  ) {
    return [];
  }
  return Arr.map([...sourceText.matchAll(PAGE_WIDTH)], (match) => {
    const line = sourceText.slice(0, match.index).split("\n").length;
    return `${file}:${line}: read the page's frame from shared/content/width.ts instead of ${match[0]}.`;
  });
}
