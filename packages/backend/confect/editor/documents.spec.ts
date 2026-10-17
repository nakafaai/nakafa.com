import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { DocumentAccess } from "@repo/backend/confect/editor/access";
import { ClientIdSchema } from "@repo/backend/confect/editor/batch";
import {
  DocumentInvalid,
  DocumentTooLarge,
} from "@repo/backend/confect/editor/document";
import { OpenedDocument } from "@repo/backend/confect/editor/view";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The collaborative documents of one school. A Teacher, an Admin, or the Owner
 * creates a document in a scope they may edit, and opens a document they may view.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        content: Schema.String,
        scope: GrantScope,
        slug: TenantSlug,
      }),
      returns: () => Schema.Struct({ id: Id("editorDocuments") }),
      error: () =>
        Schema.Union([AccessDenied, DocumentInvalid, DocumentTooLarge]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "open",
      args: () => ({
        clientId: ClientIdSchema,
        documentId: Id("editorDocuments"),
        slug: TenantSlug,
      }),
      returns: () => OpenedDocument,
      error: () => AccessDenied,
    }).middleware(DocumentAccess, {
      action: "document.view",
      arg: "documentId",
    })
  );
