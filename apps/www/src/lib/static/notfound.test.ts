import { describe, expect, it } from "@effect/vitest";
import {
  notFoundOutputPath,
  notFoundPagePath,
  staticNotFoundDocument,
} from "@/lib/static/notfound";

const THEME =
  "(function () { document.documentElement.dataset.theme = 'light'; })();";

/** A prerendered page as TanStack writes it: stylesheets, the theme script, module preloads and the app's scripts. */
const PRERENDERED = [
  "<!doctype html><html><head>",
  '<link rel="stylesheet" href="/assets/globals.css"/>',
  '<link rel="modulepreload" href="/assets/react.js" crossorigin=""/>',
  `<script>${THEME}</script>`,
  '<script data-tsr-stream-part="">self.$_TSR={};</script>',
  "</head><body><main><h1>We can't find this page</h1></main>",
  '<script type="module" async="" src="/assets/index.js"></script>',
  "<script>document.currentScript.remove();</script>",
  "</body></html>",
].join("");

describe("lib/static/notfound", () => {
  it("names the page and the output of one locale", () => {
    expect(notFoundPagePath("id")).toBe("/_notfound/id");
    expect(notFoundOutputPath("id")).toBe("/id/404");
  });

  it("keeps the markup, the stylesheets and the named script, and drops every other script and module preload", () => {
    expect(staticNotFoundDocument(PRERENDERED, THEME)).toBe(
      [
        "<!doctype html><html><head>",
        '<link rel="stylesheet" href="/assets/globals.css"/>',
        `<script>${THEME}</script>`,
        "</head><body><main><h1>We can't find this page</h1></main>",
        "</body></html>",
      ].join("")
    );
  });
});
