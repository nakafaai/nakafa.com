import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { DocumentAccess } from "@repo/backend/confect/editor/access";
import {
  BatchTooLarge,
  ClientIdSchema,
  VersionSchema,
} from "@repo/backend/confect/editor/batch";
import { BatchInvalid, ClientTaken } from "@repo/backend/confect/editor/errors";
import { SinceReply, SubmitReply } from "@repo/backend/confect/editor/view";
import { ExamFrozen } from "@repo/backend/confect/exams/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The steps of one document. A client reads the steps after its version, and sends
 * a batch made on the head it has seen. A submit answers every outcome that the sync
 * decides for itself with `SubmitReply`, so a concurrent edit or a fold is never a failed
 * call. It fails only with a refusal that a correct client does not meet: a denied access,
 * a batch the editor would never send, another person's session id, or a frozen exam.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "since",
      args: () => ({
        clientId: ClientIdSchema,
        documentId: Id("editorDocuments"),
        slug: TenantSlug,
        version: VersionSchema,
      }),
      returns: () => SinceReply,
      error: () => AccessDenied,
    }).middleware(DocumentAccess, {
      action: "document.view",
      arg: "documentId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "submit",
      args: () => ({
        batch: Schema.String,
        documentId: Id("editorDocuments"),
        slug: TenantSlug,
      }),
      returns: () => SubmitReply,
      error: () =>
        Schema.Union([
          AccessDenied,
          BatchInvalid,
          BatchTooLarge,
          ClientTaken,
          ExamFrozen,
        ]),
    }).middleware(DocumentAccess, {
      action: "document.edit",
      arg: "documentId",
    })
  );
