import {
  CapabilityArtifactSchema,
  CapabilityOutputSchema,
} from "@repo/backend/client/nina/capability";
import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import {
  Array as Arr,
  Match,
  Predicate,
  Record as Rec,
  Schema,
  SchemaAST,
} from "effect";

/*
 * What Convex does with the nesting of a document. The installed `convex`
 * package ships only the client, so none of this is in `node_modules`. It was
 * read in the open source of the backend, get-convex/convex-backend, at
 * commit 5a633b42800113d393f0db162f8fc67f5bf01e14 (12 October 2026):
 *
 * - `crates/value/src/array.rs` and `object.rs` count an array or an object as
 *   one level more than its deepest member, and an empty one as one level.
 *   `crates/value/src/size.rs` counts a scalar as none.
 * - `crates/common/src/document.rs` refuses a document above
 *   `MAX_DOCUMENT_NESTING`, which is 16.
 * - `approaching_limit_warning` in `crates/udf/src/warnings.rs` warns for a
 *   value above `FUNCTION_LIMIT_WARNING_RATIO` times its limit, cut to a whole
 *   number, up to the limit. `add_warnings_to_log_lines` in
 *   `crates/isolate/src/environment/udf/mod.rs` calls it with the nesting of
 *   the deepest document a function wrote and `MAX_DOCUMENT_NESTING`, and
 *   that is the log line "Deeply nested document written with ID ... (actual:
 *   N levels, limit: 16 levels)".
 * - `crates/common/src/knobs.rs` sets the ratio to 0.8 unless a deployment
 *   overrides it.
 *
 * The ratio of the hosted deployment cannot be read from here. Production
 * logged the warning at 13 levels, which agrees with the default. That 12
 * levels stay silent follows from the source, not from a production log.
 */

/** The most levels Convex accepts in a document (`MAX_DOCUMENT_NESTING`). */
const DOCUMENT_LEVELS = 16;

/** The share of the limit above which Convex warns by default. */
const WARNING_RATIO = 0.8;

/**
 * The most levels a stored capability result may reach in its message row, so
 * that Convex's warning for a deeply nested document never fires (it fired on
 * a real math turn, at 13 levels) and four levels stay free below the 16 that
 * Convex accepts. It is the warning limit of the default ratio, 12.8 cut to a
 * whole number as Convex cuts it.
 */
export const STORED_LEVELS = Math.trunc(DOCUMENT_LEVELS * WARNING_RATIO);

/**
 * How many levels Convex counts in a value: a scalar has none, and an array or
 * an object has one more than its deepest member, so an empty one has one. A
 * stored document is such an object, with `_id` and `_creationTime` among its
 * fields.
 */
export function levels(value: unknown): number {
  if (Arr.isArray(value)) {
    return 1 + deepestMember(value);
  }
  if (Predicate.isObject(value)) {
    return 1 + deepestMember(Rec.values(value));
  }
  return 0;
}

/** The most levels any of the members has. */
function deepestMember(members: readonly unknown[]) {
  return Arr.reduce(members, 0, (most, member) =>
    Math.max(most, levels(member))
  );
}

/** What a schema that admits any depth stands for: a value deeper than Convex accepts. */
const UNBOUNDED = Arr.reduce<number, readonly unknown[]>(
  Arr.range(1, 64),
  [],
  (inner) => [inner]
);

/** The deeper of two values. */
function deeper(a: unknown, b: unknown) {
  return levels(b) > levels(a) ? b : a;
}

/**
 * The deepest value a schema admits, on the side of its type: every field
 * present, one element in every array, and the deepest member of every union.
 * Only containers count in Convex's levels, so a scalar is a placeholder that
 * need not pass the checks of its schema. A schema that admits any depth gets
 * a value deeper than any limit.
 */
export function deepest(ast: SchemaAST.AST): unknown {
  return Match.value(ast).pipe(
    Match.tag("Objects", (node) =>
      Rec.fromEntries(
        Arr.appendAll(
          Arr.map(
            node.propertySignatures,
            (signature) =>
              [String(signature.name), deepest(signature.type)] as const
          ),
          Arr.map(
            node.indexSignatures,
            (signature) => ["key", deepest(signature.type)] as const
          )
        )
      )
    ),
    Match.tag("Arrays", (node) =>
      Arr.appendAll(
        Arr.map(node.elements, deepest),
        Arr.map(node.rest, deepest)
      )
    ),
    Match.tag("Union", (node) => {
      const [first, ...others] = Arr.map(node.types, deepest);
      return Arr.reduce<unknown, unknown>(others, first, deeper);
    }),
    Match.tag("Literal", (node) => node.literal),
    Match.tags({
      Any: () => UNBOUNDED,
      Unknown: () => UNBOUNDED,
      ObjectKeyword: () => UNBOUNDED,
      Suspend: () => UNBOUNDED,
      Number: () => 1,
      Boolean: () => true,
      Null: () => null,
    }),
    Match.orElse(() => "text")
  );
}

/**
 * The artifact types each capability publishes, from the `publish` calls of its
 * tools in `math/tools`, `nakafa/tools` and `research/tools`. Memory publishes
 * none.
 */
const published = {
  deepResearch: ["data-scrape-url", "data-web-search"],
  math: ["data-math"],
  memory: [],
  nakafa: ["data-nakafa"],
} satisfies Record<
  LearningCapabilityName,
  readonly (typeof CapabilityArtifactSchema.Type)["type"][]
>;

/**
 * The deepest result a capability can store, which is its output schema with
 * the artifacts that capability publishes.
 */
export function deepestResult(capability: LearningCapabilityName) {
  const members = Arr.filter(CapabilityArtifactSchema.members, (member) =>
    Arr.contains(published[capability], member.fields.type.literal)
  );
  const artifacts = Arr.isReadonlyArrayNonEmpty(members)
    ? Schema.Array(Schema.Union(members))
    : Schema.Tuple([]);
  return deepest(
    SchemaAST.toType(
      CapabilityOutputSchema.mapFields((fields) => ({ ...fields, artifacts }))
        .ast
    )
  );
}
