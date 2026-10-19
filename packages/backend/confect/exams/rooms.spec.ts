import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import { ExamSummary } from "@repo/backend/confect/exams/exam";
import { RoomRow } from "@repo/backend/confect/exams/rooms";
import { SittingState } from "@repo/backend/confect/exams/sittings/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The rooms of a school exam. The exam's gate is `exam.rooms`, which the editors of the exam
 * and the Principal and the Deputy hold. Each room of the list is then shown only when the
 * caller's `sitting.view` allows it, so no room reaches a caller who may not see it.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({
        examId: Id("exams"),
        slug: TenantSlug,
        state: Schema.optionalKey(SittingState),
      }),
      item: () => RoomRow,
      error: () => AccessDenied,
    }).middleware(ExamAccess, { action: "exam.rooms", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "exam",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => ExamSummary,
      error: () => AccessDenied,
    }).middleware(ExamAccess, { action: "exam.rooms", arg: "examId" })
  );
