import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Order } from "effect";
import { readFirstLoad, readParts } from "@/lib/static/chunks";

const ROUTE = "/app/src/routes/$locale.tsx";

/** A build as TanStack splits one route: its component, its error and not-found components, and their imports. */
const CHUNKS = [
  { href: "/assets/index.js", imports: ["/assets/react.js"], parts: [] },
  { href: "/assets/react.js", imports: [], parts: [] },
  {
    href: "/assets/locale.js",
    imports: ["/assets/react.js", "/assets/toaster.js"],
    parts: ["component"],
  },
  { href: "/assets/toaster.js", imports: [], parts: [] },
  {
    href: "/assets/failed.js",
    imports: ["/assets/react.js", "/assets/stage.js"],
    parts: ["errorComponent"],
  },
  {
    href: "/assets/missing.js",
    imports: ["/assets/app.js", "/assets/toaster.js"],
    parts: ["notFoundComponent"],
  },
  { href: "/assets/stage.js", imports: [], parts: [] },
  { href: "/assets/app.js", imports: [], parts: [] },
];

/** Every chunk the manifest lists for the page, as TanStack writes them. */
const PRELOADS = [
  "/assets/index.js",
  "/assets/react.js",
  "/assets/locale.js",
  "/assets/toaster.js",
  "/assets/failed.js",
  "/assets/stage.js",
  "/assets/missing.js",
  "/assets/app.js",
];

describe("lib/static/chunks", () => {
  it("reads the route parts of a chunk from its split modules", () => {
    expect(
      readParts([
        `${ROUTE}?tsr-split=component`,
        `${ROUTE}?tsr-split=errorComponent---notFoundComponent`,
        "/app/src/components/state/app.tsx",
        `${ROUTE}?tsr-split=component`,
      ])
    ).toEqual(["component", "errorComponent", "notFoundComponent"]);
  });

  it("starts what the entry and the route components import, and leaves the error and not-found parts to the router", () => {
    const firstLoad = readFirstLoad("/assets/index.js", PRELOADS, CHUNKS);

    expect(Arr.sort(Arr.fromIterable(firstLoad), Order.String)).toEqual([
      "/assets/index.js",
      "/assets/locale.js",
      "/assets/react.js",
      "/assets/toaster.js",
    ]);
  });

  it("keeps a component that shares its chunk with an error part, and a preload the build did not record", () => {
    const shared = [
      ...CHUNKS,
      {
        href: "/assets/page.js",
        imports: ["/assets/stage.js"],
        parts: ["component", "errorComponent"],
      },
    ];
    const firstLoad = readFirstLoad(
      "/assets/index.js",
      [...PRELOADS, "/assets/page.js", "/assets/unknown.js"],
      shared
    );

    expect(HashSet.has(firstLoad, "/assets/page.js")).toBe(true);
    expect(HashSet.has(firstLoad, "/assets/stage.js")).toBe(true);
    expect(HashSet.has(firstLoad, "/assets/unknown.js")).toBe(true);
  });
});
