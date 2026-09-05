import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Clock, Effect } from "effect";

/** Records membership lifecycle changes after invite usage is updated. */
const recordSchoolMembership = Effect.fn("triggers.schools.recordMembership")(
  function* (
    ctx: GenericMutationCtx<DataModel>,
    change: Change<DataModel, "schoolMembers">
  ) {
    if (change.operation === "insert") {
      const member = change.newDoc;
      const inviteCodeId = member.inviteCodeId;

      if (inviteCodeId) {
        const inviteCode = yield* Effect.promise(() =>
          ctx.db.get("schoolInviteCodes", inviteCodeId)
        );
        if (inviteCode) {
          const updatedAt = yield* Clock.currentTimeMillis;
          yield* Effect.promise(() =>
            ctx.db.patch("schoolInviteCodes", inviteCodeId, {
              currentUsage: inviteCode.currentUsage + 1,
              updatedAt,
            })
          );
        }
      }

      switch (member.status) {
        case "active": {
          yield* Effect.promise(() =>
            ctx.db.insert("schoolActivityLogs", {
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
          );
          break;
        }
        case "invited": {
          yield* Effect.promise(() =>
            ctx.db.insert("schoolActivityLogs", {
              schoolId: member.schoolId,
              userId: member.invitedBy ?? member.userId,
              action: "member_invited",
              entityType: "schoolMembers",
              entityId: change.id,
              metadata: {
                invitedUserId: member.userId,
                role: member.role,
                invitedAt: member.invitedAt,
              },
            })
          );
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
        yield* Effect.promise(() =>
          ctx.db.insert("schoolActivityLogs", {
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
        );
      }

      const statusTransition = `${oldMember.status}-${member.status}` as const;
      switch (statusTransition) {
        case "invited-active": {
          yield* Effect.promise(() =>
            ctx.db.insert("schoolActivityLogs", {
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
          );
          break;
        }
        default: {
          if (oldMember.status !== "removed" && member.status === "removed") {
            yield* Effect.promise(() =>
              ctx.db.insert("schoolActivityLogs", {
                schoolId: member.schoolId,
                userId: member.removedBy ?? member.userId,
                action: "member_removed",
                entityType: "schoolMembers",
                entityId: change.id,
                metadata: {
                  removedUserId: member.userId,
                  role: member.role,
                  removedAt: member.removedAt,
                },
              })
            );
          }
          break;
        }
      }
      return;
    }
    const oldMember = change.oldDoc;

    yield* Effect.promise(() =>
      ctx.db.insert("schoolActivityLogs", {
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
    );
  }
);

/** Runs the registered school membership trigger at its native Convex boundary. */
export function schoolMembersHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolMembers">
) {
  return runConvexProgram(recordSchoolMembership(ctx, change));
}
