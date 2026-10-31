import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  notFoundOutputPath,
  notFoundPagePath,
  schoolNotFoundPath,
  staticNotFoundDocument,
} from "@/lib/static/notfound";

const THEME =
  "(function () { document.documentElement.dataset.theme = 'light'; })();";

/** A prerendered page as TanStack writes it: stylesheets, the theme script, module preloads and the app's scripts. */
const PRERENDERED = Arr.join(
  [
    "<!doctype html><html><head>",
    '<link rel="stylesheet" href="/assets/globals.css"/>',
    '<link rel="modulepreload" href="/assets/react.js" crossorigin=""/>',
    `<script>${THEME}</script>`,
    '<script data-tsr-stream-part="">self.$_TSR={};</script>',
    "</head><body><main><h1>We can't find this page</h1></main>",
    '<script type="module" async="" src="/assets/index.js"></script>',
    "<script>document.currentScript.remove();</script>",
    "</body></html>",
  ],
  ""
);

describe("lib/static/notfound", () => {
  it("names the page and the output of one locale", () => {
    expect(notFoundPagePath("id")).toBe("/_notfound/id");
    expect(notFoundOutputPath("id")).toBe("/id/404");
    expect(schoolNotFoundPath("id")).toBe("/_notfound/school/id");
  });

  it("keeps the markup, the stylesheets and the named script, and drops every other script and module preload", () => {
    expect(staticNotFoundDocument(PRERENDERED, THEME)).toBe(
      Arr.join(
        [
          "<!doctype html><html><head>",
          '<link rel="stylesheet" href="/assets/globals.css"/>',
          `<script>${THEME}</script>`,
          "</head><body><main><h1>We can't find this page</h1></main>",
          "</body></html>",
        ],
        ""
      )
    );
  });

  it("moves each streamed segment into its boundary, nested elements and all, so the figure shows with no script", () => {
    const streamed = Arr.join(
      [
        "<body><main>",
        '<div data-slot="empty-icon"><!--$?--><template id="B:0"></template><!--/$--></div>',
        "<h1>We can't find this page</h1>",
        '<p><!--$?--><template id="B:1"></template>…<!--/$--></p></main>',
        '<div hidden id="S:0"><div><div><svg></svg></div><svg></svg></div><svg></svg></div>',
        '<script>$RC("B:0","S:0")</script>',
        '<div hidden id="S:1">ready</div>',
        '<div hidden id="S:9"><b>no boundary</b></div>',
        '<script>$RC("B:1","S:1")</script>',
        "</body>",
      ],
      ""
    );

    expect(staticNotFoundDocument(streamed, THEME)).toBe(
      Arr.join(
        [
          "<body><main>",
          '<div data-slot="empty-icon"><!--$--><div><div><svg></svg></div><svg></svg></div><svg></svg><!--/$--></div>',
          "<h1>We can't find this page</h1>",
          "<p><!--$-->ready<!--/$--></p></main>",
          "</body>",
        ],
        ""
      )
    );
  });

  it("drops a segment that never closes, and keeps the page before it", () => {
    expect(
      staticNotFoundDocument(
        '<main><h1>Missing</h1></main><div hidden id="S:2"><svg>',
        THEME
      )
    ).toBe("<main><h1>Missing</h1></main>");
  });
});
