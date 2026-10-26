import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import { SittingAccess } from "@repo/backend/confect/exams/sittings/access";
import { ScreenView } from "@repo/backend/confect/exams/sittings/contract";
import { SITTING_REFUSALS } from "@repo/backend/confect/exams/sittings/refusal";
import { DeviceId } from "@repo/backend/confect/exams/sittings/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * A student's screen in a proctored sitting (K25). The student's device names the question its screen
 * shows when the student moves, and a proctor who may view the sitting reads that screen, drawn from
 * the exam's data rather than a picture of it.
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
  );
