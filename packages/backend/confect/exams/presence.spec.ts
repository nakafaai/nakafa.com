import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import {
  ExamEditor,
  PresenceSession,
  PresenceToken,
} from "@repo/backend/confect/exams/presence";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Who is in an exam's editor, through the `@convex-dev/presence` component (ADR 0028). Only a
 * member who may edit the exam joins its room or reads it, so each heartbeat checks
 * `exam.edit` again. Leaving takes the session's token alone, because the token proves the
 * session, and a teacher whose access ended still leaves.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "join",
      args: () => ({
        examId: Id("exams"),
        session: PresenceSession,
        slug: TenantSlug,
      }),
      returns: () => Schema.Struct({ token: PresenceToken }),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => Schema.Array(ExamEditor),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "leave",
      args: () => ({ token: PresenceToken }),
      returns: () => Schema.Null,
    })
  );
