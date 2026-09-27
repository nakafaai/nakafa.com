import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Clock, Effect, Struct } from "effect";

/** Records membership lifecycle changes after invite usage is updated. */
export const schoolMembersHandler = Effect.fn(
  "triggers.schools.recordMembership"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolMembers">
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (change.operation === "insert") {
    const member = change.newDoc;
    const inviteCodeId = member.inviteCodeId;
    if (inviteCodeId) {
      const inviteCode = yield* database
        .table("schoolInviteCodes")
        .get(inviteCodeId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (inviteCode) {
        const updatedAt = yield* Clock.currentTimeMillis;
        yield* writer
          .table("schoolInviteCodes")
          .patch(inviteCodeId, {
            currentUsage: inviteCode.currentUsage + 1,
            updatedAt,
          })
          .pipe(Effect.orDie);
      }
    }
    switch (member.status) {
      case "active": {
        yield* writer
          .table("schoolActivityLogs")
          .insert({
            schoolId: member.schoolId,
            userId: member.userId,
            action: "member_joined",
            entityType: "schoolMembers",
            entityId: change.id,
            metadata: {
              role: member.role,
              joinedAt: member.joinedAt,
            },
          })
          .pipe(Effect.orDie);
        break;
      }
      case "invited": {
        yield* writer
          .table("schoolActivityLogs")
          .insert({
            schoolId: member.schoolId,
            userId: member.invitedBy ?? member.userId,
            action: "member_invited",
            entityType: "schoolMembers",
            entityId: change.id,
            metadata: {
              invitedUserId: member.userId,
              role: member.role,
              ...Struct.pick(member, ["invitedAt"]),
            },
          })
          .pipe(Effect.orDie);
        break;
      }
      default: {
        break;
      }
    }
    return;
  }
  if (change.operation === "update") {
    const { newDoc: member, oldDoc: oldMember } = change;
    if (oldMember.role !== member.role) {
      yield* writer
        .table("schoolActivityLogs")
        .insert({
          schoolId: member.schoolId,
          userId: member.userId,
          action: "member_role_changed",
          entityType: "schoolMembers",
          entityId: change.id,
          metadata: {
            oldRole: oldMember.role,
            newRole: member.role,
          },
        })
        .pipe(Effect.orDie);
    }
    const statusTransition = `${oldMember.status}-${member.status}` as const;
    switch (statusTransition) {
      case "invited-active": {
        yield* writer
          .table("schoolActivityLogs")
          .insert({
            schoolId: member.schoolId,
            userId: member.userId,
            action: "member_joined",
            entityType: "schoolMembers",
            entityId: change.id,
            metadata: {
              role: member.role,
              joinedAt: member.joinedAt,
            },
          })
          .pipe(Effect.orDie);
        break;
      }
      default: {
        if (oldMember.status !== "removed" && member.status === "removed") {
          yield* writer
            .table("schoolActivityLogs")
            .insert({
              schoolId: member.schoolId,
              userId: member.removedBy ?? member.userId,
              action: "member_removed",
              entityType: "schoolMembers",
              entityId: change.id,
              metadata: {
                removedUserId: member.userId,
                role: member.role,
                ...Struct.pick(member, ["removedAt"]),
              },
            })
            .pipe(Effect.orDie);
        }
        break;
      }
    }
    return;
  }
  const oldMember = change.oldDoc;
  yield* writer
    .table("schoolActivityLogs")
    .insert({
      schoolId: oldMember.schoolId,
      userId: oldMember.userId,
      action: "member_removed",
      entityType: "schoolMembers",
      entityId: change.id,
      metadata: {
        removedUserId: oldMember.userId,
        role: oldMember.role,
      },
    })
    .pipe(Effect.orDie);
});
