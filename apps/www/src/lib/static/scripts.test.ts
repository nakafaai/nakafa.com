import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Result, Schema } from "effect";
import { deferStaticScripts } from "@/lib/static/scripts";

/** A prerendered page as TanStack writes it: module preloads in the head, the hydration scripts and the entry in the body. */
const PRERENDERED = Arr.join(
  [
    "<!doctype html><html><head>",
    '<link rel="stylesheet" href="/assets/globals.css"/>',
    '<link rel="modulepreload" href="/assets/react-a1.js" crossorigin=""/>',
    '<link rel="modulepreload" href="/assets/route-b2.js" crossorigin="" fetchPriority="low"/>',
    '<link rel="modulepreload" href="/assets/react-a1.js" crossorigin="" fetchPriority="low"/>',
    "<script>document.documentElement.classList.add('light');</script>",
    "</head><body><main><h1>Pecahan</h1></main>",
    '<script data-tsr-stream-part="">self.$_TSR={};</script>',
    '<script type="module" async="" src="/assets/index-c3.js"></script>',
    "<script>document.currentScript.remove();</script>",
    "</body></html>",
  ],
  ""
);

/** The data that the loader at the end of the body is called with. */
const LOADER_DATA = /\}\)\((\{.*\})\);<\/script><\/body>/;

const LoaderData = Schema.fromJsonString(
  Schema.Struct({
    entry: Schema.String,
    preloads: Schema.Array(
      Schema.Struct({
        fetchPriority: Schema.optionalKey(Schema.String),
        href: Schema.String,
      })
    ),
  })
);

/** The scripts that the loader at the end of the body starts. */
function readLoaderData(html: string) {
  return Option.flatMap(
    Option.fromNullishOr(LOADER_DATA.exec(html)?.[1]),
    Schema.decodeOption(LoaderData)
  );
}

describe("lib/static/scripts", () => {
  it("moves the module preloads and the entry into one loader at the end of the body", () => {
    const deferred = Result.getOrThrow(deferStaticScripts(PRERENDERED));

    expect(deferred).not.toContain('rel="modulepreload"');
    expect(deferred).not.toContain('src="/assets/index-c3.js"');
    expect(deferred).toContain(
      Arr.join(
        [
          "<head>",
          '<link rel="stylesheet" href="/assets/globals.css"/>',
          "<script>document.documentElement.classList.add('light');</script>",
          "</head><body><main><h1>Pecahan</h1></main>",
          '<script data-tsr-stream-part="">self.$_TSR={};</script>',
          "<script>document.currentScript.remove();</script>",
          "<script>(function (scripts) {",
        ],
        ""
      )
    );
    expect(Option.getOrThrow(readLoaderData(deferred))).toEqual({
      entry: "/assets/index-c3.js",
      preloads: [
        { href: "/assets/react-a1.js" },
        { fetchPriority: "low", href: "/assets/route-b2.js" },
      ],
    });
  });

  it("refuses a page without exactly one entry script", () => {
    const entry =
      '<script type="module" async="" src="/assets/index-c3.js"></script>';
    const withoutEntry = PRERENDERED.replace(entry, "");
    const withTwoEntries = PRERENDERED.replace(entry, `${entry}${entry}`);

    expect(Result.isFailure(deferStaticScripts(withoutEntry))).toBe(true);
    expect(Result.isFailure(deferStaticScripts(withTwoEntries))).toBe(true);
  });

  it("refuses a page without a single body", () => {
    expect(
      Result.isFailure(deferStaticScripts(PRERENDERED.replace("</body>", "")))
    ).toBe(true);
  });

  it("refuses a script outside the built assets", () => {
    const foreign = PRERENDERED.replace(
      "/assets/route-b2.js",
      "https://example.com/route.js"
    );

    expect(Result.isFailure(deferStaticScripts(foreign))).toBe(true);
  });
});
