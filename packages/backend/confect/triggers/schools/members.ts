import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Clock, Effect, Match, Struct } from "effect";

/** Records membership lifecycle changes after invite usage is updated. */
export const schoolMembersHandler = Effect.fn(
  "triggers.schools.recordMembership"
)(function* (change: Change<DataModel, "schoolMembers">) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
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
    yield* Match.value(member.status).pipe(
      Match.when("active", () =>
        writer
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
          .pipe(Effect.orDie)
      ),
      Match.when("invited", () =>
        writer
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
          .pipe(Effect.orDie)
      ),
      Match.orElse(() => Effect.void)
    );
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
    yield* Match.value(statusTransition).pipe(
      Match.when("invited-active", () =>
        writer
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
          .pipe(Effect.orDie)
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
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
        })
      )
    );
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
