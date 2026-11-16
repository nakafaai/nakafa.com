import type { CodeOptionsMultipleThemes } from "@shikijs/core";

/**
 * The only default theme pair. The light theme is the high-contrast variant: every
 * token colour that paints text on its white background meets WCAG 2.2 AA (4.5:1),
 * where github-light does not. A code surface that the page tints can lower that
 * contrast, and this pair does not guarantee it. The carriage-return, markup.deleted,
 * markup.inserted, markup.changed, markup.ignored, and markup.untracked scopes paint
 * their own background, with their diff header and punctuation scopes, so their text
 * is judged on that background instead.
 */
export const DEFAULT_CODE_THEMES = {
  light: "github-light-high-contrast",
  dark: "github-dark-default",
} satisfies CodeOptionsMultipleThemes["themes"];
