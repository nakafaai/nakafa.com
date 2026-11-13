import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Result, Schema } from "effect";
import { deferStaticScripts } from "@/lib/static/scripts";

/** A prerendered page as TanStack writes it: module preloads in the head, the hydration scripts and the entry in the body. */
const PRERENDERED = Arr.join(
  [
    "<!doctype html><html><head>",
    '<link rel="stylesheet" href="/assets/globals.css"/>',
    '<link rel="modulepreload" href="/assets/react-a1.js" crossorigin=""/>',
    '<link rel="modulepreload" href="/assets/shared~route-b2.js" crossorigin="" fetchPriority="low"/>',
    '<link rel="modulepreload" href="/assets/react-a1.js" crossorigin="" fetchPriority="low"/>',
    "<script>document.documentElement.classList.add('light');</script>",
    "</head><body><main><h1>Pecahan</h1></main>",
    '<script data-tsr-stream-part="">self.$_TSR={manifest:$R[1]={routes:$R[2]={__root__:$R[3]={preloads:$R[4]=["/assets/index-c3.js","/assets/react-a1.js"]}}}};</script>',
    '<script type="module" async="" src="/assets/index-c3.js"></script>',
    "<script>document.currentScript.remove();</script>",
    "</body></html>",
  ],
  ""
);

/** The client build of that page: the entry, React, and a route chunk that the entry imports. */
const CHUNKS = [
  {
    href: "/assets/index-c3.js",
    imports: ["/assets/react-a1.js"],
    parts: [],
  },
  { href: "/assets/react-a1.js", imports: [], parts: [] },
  {
    href: "/assets/shared~route-b2.js",
    imports: ["/assets/react-a1.js"],
    parts: ["component"],
  },
];

/** The data that the loader at the end of the body is called with. */
const LOADER_DATA = /\}\)\((?<data>\{.*\})\);<\/script><\/body>/u;

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
    const deferred = Result.getOrThrow(deferStaticScripts(PRERENDERED, CHUNKS));

    expect(deferred).not.toContain('rel="modulepreload"');
    expect(deferred).not.toContain('src="/assets/index-c3.js"');
    expect(deferred).toContain(
      Arr.join(
        [
          "<head>",
          '<link rel="stylesheet" href="/assets/globals.css"/>',
          "<script>document.documentElement.classList.add('light');</script>",
          "</head><body><main><h1>Pecahan</h1></main>",
          '<script data-tsr-stream-part="">self.$_TSR={manifest:$R[1]={routes:$R[2]={__root__:$R[3]={preloads:$R[4]=[]}}}};</script>',
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
        { fetchPriority: "low", href: "/assets/shared~route-b2.js" },
      ],
    });
  });

  it("leaves the chunk of a route's not-found component to the router", () => {
    const notFound = PRERENDERED.replace(
      "</head>",
      '<link rel="modulepreload" href="/assets/missing-d4.js" crossorigin=""/></head>'
    );
    const deferred = Result.getOrThrow(
      deferStaticScripts(notFound, [
        ...CHUNKS,
        {
          href: "/assets/missing-d4.js",
          imports: [],
          parts: ["notFoundComponent"],
        },
      ])
    );

    expect(
      Arr.map(
        Option.getOrThrow(readLoaderData(deferred)).preloads,
        (preload) => preload.href
      )
    ).toEqual(["/assets/react-a1.js", "/assets/shared~route-b2.js"]);
  });

  it("refuses a page without exactly one entry script", () => {
    const entry =
      '<script type="module" async="" src="/assets/index-c3.js"></script>';
    const withoutEntry = PRERENDERED.replace(entry, "");
    const withTwoEntries = PRERENDERED.replace(entry, `${entry}${entry}`);

    expect(Result.isFailure(deferStaticScripts(withoutEntry, CHUNKS))).toBe(
      true
    );
    expect(Result.isFailure(deferStaticScripts(withTwoEntries, CHUNKS))).toBe(
      true
    );
  });

  it("refuses a page without a single body", () => {
    expect(
      Result.isFailure(
        deferStaticScripts(PRERENDERED.replace("</body>", ""), CHUNKS)
      )
    ).toBe(true);
  });

  it("refuses a script outside the built assets", () => {
    const foreign = PRERENDERED.replace(
      "/assets/shared~route-b2.js",
      "https://example.com/route.js"
    );

    expect(Result.isFailure(deferStaticScripts(foreign, CHUNKS))).toBe(true);
  });
});
