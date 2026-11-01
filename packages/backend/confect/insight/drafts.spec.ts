import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { DraftSource } from "@repo/backend/confect/insight/drafts";
import { DraftRefused } from "@repo/backend/confect/insight/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Nina's drafts of a narrative (ADR 0035): a subject teacher asks, which holds the school's credits and schedules the
 * draft, the model writes it outside any transaction, and the teacher edits it before anything is saved or shared.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "ask",
      args: () => ({
        classId: Id("classes"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, DraftRefused]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "insight.teach", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "source",
      args: () => ({ draftId: Id("insightDrafts") }),
      returns: () => DraftSource,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "finish",
      args: () => ({
        draftId: Id("insightDrafts"),
        text: Schema.NullOr(Schema.String),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "write",
      args: () => ({ draftId: Id("insightDrafts") }),
      returns: () => Schema.Null,
    })
  );
