import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Grant } from "@repo/backend/confect/access/access";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import {
  assignRole,
  authorizeAssign,
  revokeGrant,
} from "@repo/backend/confect/access/grant";
import spec from "@repo/backend/confect/access/grants.spec";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect } from "effect";

/**
 * Changes the role of an active grant in one step, over the same scope: the old role ends and the
 * new one starts in one transaction, so a refusal leaves the person's grant as it was, and no moment
 * leaves the person without a role. Each half passes the rules of its own path. A grant that has
 * ended is refused as a missing object.
 */
export const change = FunctionImpl.make(
  databaseSchema,
  spec,
  "change",
  Effect.fn("access.grants.change")(function* ({ role }) {
    const grant = yield* Grant;
    if (grant.status !== "active") {
      return yield* new AccessDenied({
        action: "grant.manage",
        reason: "resource",
      });
    }
    yield* authorizeAssign(grant.scope, role);
    const actor = { id: (yield* Member).person._id, kind: "person" } as const;
    const holder = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(grant.personId)
      .pipe(Effect.orDie);
    yield* revokeGrant(actor, grant, holder);
    return yield* assignRole(actor, holder, role, grant.scope);
  })
);
