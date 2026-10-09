import type { AssembledLeaf } from "@repo/backend/scripts/refs/assembly";
import {
  RefsNestingError,
  RefsSourceError,
} from "@repo/backend/scripts/refs/errors";
import { Array as Arr, Effect, Schema } from "effect";

const PARENT_PREFIX = "../";
const SPEC_SUFFIX = ".spec";

/** A leaf spec with the group path that its file gives it, such as `nina.turns`. */
export const LeafPath = Schema.Struct({
  localName: Schema.String,
  segments: Schema.NonEmptyArray(Schema.String),
  specifier: Schema.String,
});

/**
 * Derives the group path of a leaf from its import path, which must name a spec
 * one folder above the `_generated` folder: `../nina/turns.spec` is `nina.turns`.
 */
export const groupPathOf = Effect.fn("RefsPaths.groupPathOf")(function* (
  specifier: string
): Effect.fn.Return<readonly [string, ...string[]], RefsSourceError> {
  const body = specifier.slice(PARENT_PREFIX.length);
  const [head, ...tail] = body.slice(0, -SPEC_SUFFIX.length).split("/");
  const segments: readonly [string, ...string[]] = [head, ...tail];
  if (
    !specifier.startsWith(PARENT_PREFIX) ||
    body.startsWith(PARENT_PREFIX) ||
    !body.endsWith(SPEC_SUFFIX) ||
    !Arr.every(segments, (segment) => segment.length > 0)
  ) {
    return yield* RefsSourceError.make({
      message: `Leaf import "${specifier}" must name a spec file one folder above _generated, such as "../nina/turns.spec".`,
    });
  }
  return segments;
});

/**
 * Proves that the group path each leaf file gives equals the nesting that the
 * assembled spec gives it, and returns the leaves with that path.
 */
export const leafPaths = Effect.fn("RefsPaths.leafPaths")(function* (
  leaves: readonly (typeof AssembledLeaf.Type)[]
) {
  return yield* Effect.forEach(leaves, (leaf) => leafPath(leaf));
});

const leafPath = Effect.fn("RefsPaths.leafPath")(function* (
  leaf: typeof AssembledLeaf.Type
) {
  const segments = yield* groupPathOf(leaf.specifier);
  const derivedPath = Arr.join(segments, ".");
  const nestedPath = Arr.join(leaf.nestedSegments, ".");
  if (derivedPath !== nestedPath) {
    return yield* RefsNestingError.make({
      derivedPath,
      nestedPath,
      specifier: leaf.specifier,
    });
  }
  return {
    localName: leaf.localName,
    segments,
    specifier: leaf.specifier,
  } satisfies typeof LeafPath.Type;
});
