import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { DocumentAccess } from "@repo/backend/confect/editor/access";
import {
  BatchTooLarge,
  ClientIdSchema,
  VersionSchema,
  VersionStale,
} from "@repo/backend/confect/editor/batch";
import { BatchInvalid, ClientTaken } from "@repo/backend/confect/editor/errors";
import { SinceReply } from "@repo/backend/confect/editor/view";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The steps of one document. A client reads the steps after its version, and sends
 * a batch made on the head it has seen.
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
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AccessDenied,
          BatchInvalid,
          BatchTooLarge,
          ClientTaken,
          VersionStale,
        ]),
    }).middleware(DocumentAccess, {
      action: "document.edit",
      arg: "documentId",
    })
  );
