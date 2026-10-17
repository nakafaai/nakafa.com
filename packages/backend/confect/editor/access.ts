import { MiddlewareSpec } from "@confect/core";
import type { EditorDocumentsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The document that the function's `DocumentAccess` check loaded and allowed. */
export class Document extends Context.Service<Document, EditorDocumentsDoc>()(
  "@repo/backend/confect/editor/access/Document"
) {}

/** Checks a document action on the document whose ID the `arg` argument holds. */
export class DocumentAccess extends MiddlewareSpec.MiddlewareSpec<
  DocumentAccess,
  { provides: Document; requires: Member }
>()("DocumentAccess", Kind.middleware(entries, "document")) {}
