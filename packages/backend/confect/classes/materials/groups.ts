import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { MaterialGroupError } from "@repo/backend/confect/classes/materials/spec";
import type { SchoolClassMaterialStatus } from "@repo/backend/confect/classes/schema";
import { getUserMap } from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Clock, Effect } from "effect";
/** Requires a future publication time for scheduled groups. */
export const validateScheduledStatus = Effect.fn(
  "classes.materials.groups.validateScheduledStatus"
)(function* (
  status: SchoolClassMaterialStatus,
  scheduledAt: number | undefined
) {
  if (status !== "scheduled") {
    return;
  }
  if (scheduledAt === undefined) {
    return yield* new MaterialGroupError({
      code: "INVALID_ARGUMENT",
      message: "scheduledAt is required when status is scheduled.",
    });
  }
  if (scheduledAt <= (yield* Clock.currentTimeMillis)) {
    return yield* new MaterialGroupError({
      code: "INVALID_ARGUMENT",
      message: "scheduledAt must be in the future.",
    });
  }
});

/** Loads the decoded group or reports a typed missing-group failure. */
export const loadMaterialGroup = Effect.fn(
  "classes.materials.groups.loadMaterialGroup"
)(function* (groupId: Id<"schoolClassMaterialGroups">) {
  return yield* (yield* DatabaseReader)
    .table("schoolClassMaterialGroups")
    .get(groupId)
    .pipe(
      Effect.catchTag("DocumentDecodeError", Effect.die),
      Effect.mapError(
        () =>
          new MaterialGroupError({
            code: "GROUP_NOT_FOUND",
            message: "Material group not found.",
          })
      )
    );
});

/** Joins creators and publishers while retaining groups whose authors are gone. */
export const enrichMaterialGroups = Effect.fn(
  "classes.materials.groups.enrichMaterialGroups"
)(function* (groups: Docs["schoolClassMaterialGroups"][]) {
  if (groups.length === 0) {
    return [];
  }
  const userIds = Arr.flatMap(groups, (g) =>
    g.publishedBy ? [g.createdBy, g.publishedBy] : [g.createdBy]
  );
  const userMap = yield* getUserMap(userIds);
  return Arr.map(groups, (group) => ({
    ...group,
    user: userMap.get(group.createdBy) ?? null,
    publishedByUser: group.publishedBy
      ? (userMap.get(group.publishedBy) ?? null)
      : null,
  }));
});
