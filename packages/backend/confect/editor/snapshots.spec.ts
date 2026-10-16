import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { DocumentAccess } from "@repo/backend/confect/editor/access";
import { VersionSchema } from "@repo/backend/confect/editor/batch";
import {
  DocumentInvalid,
  DocumentTooLarge,
} from "@repo/backend/confect/editor/document";
import { SnapshotRefused } from "@repo/backend/confect/editor/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The snapshots of one school's documents: a client saves the document at a version it has confirmed. */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "save",
      args: () => ({
        content: Schema.String,
        documentId: Id("editorDocuments"),
        slug: TenantSlug,
        version: VersionSchema,
      }),
      returns: () => Schema.Struct({ version: VersionSchema }),
      error: () =>
        Schema.Union([
          AccessDenied,
          DocumentInvalid,
          DocumentTooLarge,
          SnapshotRefused,
        ]),
    }).middleware(DocumentAccess, {
      action: "document.edit",
      arg: "documentId",
    })
  );
