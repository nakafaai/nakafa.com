import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import {
  PresenceSession,
  PresenceToken,
} from "@repo/backend/confect/exams/presence";
import { SittingAccess } from "@repo/backend/confect/exams/sittings/access";
import {
  OfflineSeat,
  RoomSeats,
  ScreenView,
} from "@repo/backend/confect/exams/sittings/contract";
import { SITTING_REFUSALS } from "@repo/backend/confect/exams/sittings/refusal";
import { DeviceId } from "@repo/backend/confect/exams/sittings/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * A student's screen in a proctored sitting (K25). The student's device names the question its screen
 * shows when the student moves, and a proctor who may view the sitting reads that screen, drawn from
 * the exam's data rather than a picture of it. The device also beats while its tab shows, so a proctor reads
 * a lost connection while it lasts, and each room's seats add up for the exam's rooms.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "look",
      args: () => ({
        attemptId: Id("examAttempts"),
        deviceId: DeviceId,
        questionId: Id("examQuestions"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([...SITTING_REFUSALS]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "screen",
      args: () => ({
        attemptId: Id("examAttempts"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => Schema.NullOr(ScreenView),
      error: () => Schema.Union([AccessDenied, FoldPending]),
    }).middleware(SittingAccess, { action: "sitting.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "beat",
      args: () => ({
        attemptId: Id("examAttempts"),
        deviceId: DeviceId,
        session: PresenceSession,
        slug: TenantSlug,
      }),
      returns: () => Schema.Struct({ token: PresenceToken }),
      error: () => Schema.Union([...SITTING_REFUSALS]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "offline",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => Schema.Array(OfflineSeat),
      error: () => AccessDenied,
    }).middleware(SittingAccess, { action: "sitting.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "seats",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => RoomSeats,
      error: () => AccessDenied,
    }).middleware(SittingAccess, { action: "sitting.view", arg: "sittingId" })
  );
