import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority } from "@repo/backend/confect/access/policy";
import { Document, DocumentAccess } from "@repo/backend/confect/editor/access";
import { documentKind } from "@repo/backend/confect/editor/kinds";
import { scopePlace } from "@repo/backend/confect/tenancy/authority";

/**
 * A document sits where its scope puts it: a unit document is locked by that unit's
 * archive, and a school-wide document is locked only by the school's suspension, which
 * the decision already reads.
 */
const documentAuthority = Authority.make(
  documentKind,
  Authority.load(documentKind),
  {
    place: (row) => scopePlace(row.scope),
    relations: {},
    tenantOf: (row) => row.tenantId,
  }
);

/**
 * Implements the `DocumentAccess` check: it authorizes the action on the document
 * whose ID the named argument holds, and provides that document to the function.
 */
export const documentAccess = MiddlewareImpl.make(
  databaseSchema,
  DocumentAccess,
  documentAuthority.middleware(Document)
);
