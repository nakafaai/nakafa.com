import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { Document, DocumentAccess } from "@repo/backend/confect/editor/access";
import { documentKind } from "@repo/backend/confect/editor/kinds";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Effect } from "effect";

/** Reads the unit a document names; a document always names an existing unit, so a missing one is a defect. */
const readUnit = Effect.fnUntraced(function* (
  unitId: GenericId.GenericId<"tenantUnits">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
});

/**
 * A unit document sits in its unit, so an archived unit locks its edits. A
 * tenant-wide document sits in no unit, so nothing locks it but the school's
 * suspension, which the decision already reads.
 */
const documentAuthority = Authority.make(
  documentKind,
  Authority.load(documentKind),
  {
    place: (row) =>
      GrantScope.match(row.scope, {
        tenant: () => Effect.succeed({ locked: false, units: [] }),
        unit: ({ unitId }) =>
          readUnit(unitId).pipe(
            Effect.map((unit) => ({
              locked: unit.status === "archived",
              units: [unitId],
            }))
          ),
      }),
    relations: {},
    tenantOf: (row) => row.tenantId,
  }
);

/**
 * Decides `document.edit` on the scope a new document covers, as an integration
 * client decides its own: the member's tenant for a tenant-wide document, and the
 * unit for a unit document, which the unit's own rules then decide.
 */
export const authorizeScope = Effect.fn("editor.authority.scope")(function* (
  scope: GrantScope
) {
  const { tenant } = yield* Member;
  yield* GrantScope.match(scope, {
    tenant: () => tenantAuthority.check("document.edit", tenant),
    unit: ({ unitId }) =>
      Effect.asVoid(unitAuthority.authorize("document.edit", unitId)),
  });
});

/**
 * Implements the `DocumentAccess` check: it authorizes the action on the document
 * whose ID the named argument holds, and provides that document to the function.
 */
export const documentAccess = MiddlewareImpl.make(
  databaseSchema,
  DocumentAccess,
  documentAuthority.middleware(Document)
);
