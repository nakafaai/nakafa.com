import { Array as Arr, HashSet, Option, pipe, Record, Schema } from "effect";

/**
 * What the build records of one client chunk: its address, the chunks it
 * imports statically, and the route parts that TanStack's code splitting put in
 * it (`component`, `errorComponent`, `notFoundComponent`).
 */
export const BuiltChunk = Schema.Struct({
  href: Schema.String,
  imports: Schema.Array(Schema.String),
  parts: Schema.Array(Schema.String),
});

export type BuiltChunk = typeof BuiltChunk.Type;

/** The route part that a page draws at its first paint. */
const PAINTED_PART = "component";

/** The query by which TanStack names the parts of a route that one split module holds. */
const SPLIT_QUERY = /[?&]tsr-split=(?<parts>[^&]+)/u;

/** The separator of the parts in one split, as TanStack's `createIdentifier` joins them. */
const PART_SEPARATOR = "---";

/** The route parts that a chunk's modules hold, from their split queries. */
export function readParts(moduleIds: readonly string[]): readonly string[] {
  return Arr.dedupe(
    Arr.flatMap(moduleIds, (id) =>
      Option.match(Option.fromNullishOr(SPLIT_QUERY.exec(id)?.groups?.parts), {
        onNone: () => [],
        onSome: (parts) => parts.split(PART_SEPARATOR),
      })
    )
  );
}

/**
 * The preloads of a static page that its first paint runs: what the entry and the
 * page's route components import, directly or through other chunks. TanStack's
 * manifest also lists the chunks of each route's error and not-found components,
 * and of what only they import; the router loads those when it shows that part,
 * so a preload of one only spends the reader's data, and WebKit reports it unused.
 * A preload that the build recorded no chunk for stays.
 */
export function readFirstLoad(
  entry: string,
  preloads: readonly string[],
  chunks: readonly BuiltChunk[]
): HashSet.HashSet<string> {
  const byHref = Record.fromIterableBy(chunks, (chunk) => chunk.href);
  const importsOf = (href: string) =>
    Option.match(Record.get(byHref, href), {
      onNone: () => [],
      onSome: (chunk) => chunk.imports,
    });
  const painted = Arr.filter(preloads, (href) =>
    Option.match(Record.get(byHref, href), {
      onNone: () => true,
      onSome: (chunk) => Arr.contains(chunk.parts, PAINTED_PART),
    })
  );
  const reach = (
    reached: HashSet.HashSet<string>,
    waiting: readonly string[]
  ): HashSet.HashSet<string> => {
    const fresh = Arr.dedupe(
      Arr.filter(waiting, (href) => !HashSet.has(reached, href))
    );
    return Arr.isReadonlyArrayNonEmpty(fresh)
      ? reach(
          pipe(fresh, Arr.reduce(reached, HashSet.add)),
          Arr.flatMap(fresh, importsOf)
        )
      : reached;
  };
  const reached = reach(HashSet.empty(), [entry, ...painted]);
  return HashSet.fromIterable(
    Arr.filter(preloads, (href) => HashSet.has(reached, href))
  );
}
