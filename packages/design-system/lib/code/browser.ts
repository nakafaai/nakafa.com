import { makeCodeHighlighter } from "@repo/design-system/lib/code/highlight";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

/** The browser's highlighter: every grammar and theme Shiki bundles, each loaded on its first use. */
export const { highlightCode } = makeCodeHighlighter(
  bundledLanguages,
  bundledThemes
);
