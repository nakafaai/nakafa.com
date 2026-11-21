import { Array as Arr, Schema } from "effect";

/**
 * The most bytes of the boot chunk, the one script every page evaluates before it
 * hydrates (ADR 0039 D16). A slow phone evaluates it in one task, so each byte it
 * holds is blocking time on every page. Measured at 1,041,544 bytes on 21 November
 * 2026, the limit keeps the budget's margin: the measurement plus 6%, rounded up
 * to the next thousand.
 */
export const BOOT_CHUNK_BYTES = 1_105_000;

/**
 * The modules that only a signed-in reader's island runs: the Convex client's
 * sync engine and its React bindings. A visitor's page holds no Convex client
 * (`ConvexIsland`), so the boot chunk never holds them; one that does was pulled
 * in by a route option that imports a module of an island.
 */
const ISLAND_MODULES = [
  /\/convex\/dist\/esm\/browser\/sync\//u,
  /\/@confect\/react\//u,
];

/** What the build reads of the boot chunk: its code and the modules it holds. */
const BootChunk = Schema.Struct({
  code: Schema.String,
  moduleIds: Schema.Array(Schema.String),
});

/**
 * Why the boot chunk breaks the first-load contract: too many bytes, a module
 * that only an island runs, or a phase of the browser entry (`src/client.tsx`)
 * that the chunk does not hold, which the browser would fetch before it hydrates.
 * None when it keeps all three.
 */
export function readBootProblems(
  chunk: typeof BootChunk.Type,
  phases: readonly string[]
): readonly string[] {
  const islandModules = Arr.filter(chunk.moduleIds, (id) =>
    Arr.some(ISLAND_MODULES, (pattern) => pattern.test(id))
  );
  const bytes = new TextEncoder().encode(chunk.code).byteLength;
  return [
    ...(bytes > BOOT_CHUNK_BYTES
      ? [
          `The boot chunk holds ${bytes} bytes, over the limit of ${BOOT_CHUNK_BYTES}. A route option (a search schema, a guard, a head) imports a module that only its page needs: import that page's code from its component or its loader instead.`,
        ]
      : []),
    ...Arr.map(
      islandModules,
      (id) =>
        `The boot chunk holds ${id}, which only a signed-in island runs. A route option imports a module of an island.`
    ),
    ...Arr.map(
      Arr.filter(phases, (id) => !Arr.contains(chunk.moduleIds, id)),
      (id) =>
        `The browser entry starts ${id} as a phase, but the boot chunk does not hold it, so the page fetches it before it hydrates. Start a module that the boot already imports.`
    ),
  ];
}
