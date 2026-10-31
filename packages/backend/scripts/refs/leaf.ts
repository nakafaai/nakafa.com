import { GroupSpec } from "@confect/core";
import { RefsLoadError } from "@repo/backend/scripts/refs/errors";
import type { FunctionVisibility } from "convex/server";
import { Array as Arr, Effect, Predicate, Record } from "effect";

/** Returns the group that a leaf module default-exports, or fails when it exports anything else. */
export const asLeafGroup = Effect.fn("RefsLeaf.asLeafGroup")(function* (
  specifier: string,
  moduleExports: unknown
) {
  const exported = Predicate.hasProperty(moduleExports, "default")
    ? moduleExports.default
    : undefined;
  if (!GroupSpec.isGroupSpec(exported)) {
    return yield* new RefsLoadError({
      message: `${specifier} does not default-export a GroupSpec.`,
    });
  }
  return exported;
});

/**
 * Whether a leaf declares at least one function of the visibility, in the leaf itself
 * or in a group nested under it. A mixed leaf counts for both visibilities, and the
 * generator writes it whole into each domain module that reaches it.
 */
export const holdsVisibility = (
  group: GroupSpec.AnyWithProps,
  visibility: FunctionVisibility
): boolean =>
  Arr.some(
    Record.values(group.functions),
    (fn) => fn.functionVisibility === visibility
  ) ||
  Arr.some(Record.values(group.groups), (inner) =>
    holdsVisibility(inner, visibility)
  );
