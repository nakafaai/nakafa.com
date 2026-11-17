import { makeCodeHighlighter } from "@repo/design-system/lib/code/highlight";

/**
 * The server's highlighter for authored content: the grammars that lessons write
 * their code in, and the default theme pair. Every grammar a server registers is
 * a module of its Worker, so it registers no other; a block in any other language
 * stays plain text on the server, and the browser's highlighter draws it.
 */
export const { highlightCode: highlightLessonCode } = makeCodeHighlighter(
  {
    bash: () => import("@shikijs/langs/bash"),
    c: () => import("@shikijs/langs/c"),
    http: () => import("@shikijs/langs/http"),
    json: () => import("@shikijs/langs/json"),
    markdown: () => import("@shikijs/langs/markdown"),
    python: () => import("@shikijs/langs/python"),
  },
  {
    "github-dark-default": () => import("@shikijs/themes/github-dark-default"),
    "github-light-high-contrast": () =>
      import("@shikijs/themes/github-light-high-contrast"),
  }
);
