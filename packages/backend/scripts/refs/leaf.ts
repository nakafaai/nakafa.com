import { GroupSpec } from "@confect/core";
import { RefsLoadError } from "@repo/backend/scripts/refs/errors";
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
 * Whether a leaf declares at least one public function, in the leaf itself or in
 * a group nested under it. A mixed leaf counts, and the generator writes it whole.
 */
export const isPublicLeaf = (group: GroupSpec.AnyWithProps): boolean =>
  Arr.some(
    Record.values(group.functions),
    (fn) => fn.functionVisibility === "public"
  ) || Arr.some(Record.values(group.groups), isPublicLeaf);
