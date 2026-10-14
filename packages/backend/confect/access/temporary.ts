import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  GrantRejected,
  inactivePerson,
  integrationRole,
} from "@repo/backend/confect/access/errors";
import { writeGrant } from "@repo/backend/confect/access/grant";
import { activeGrants } from "@repo/backend/confect/access/policy";
import {
  type BuiltinRole,
  type GrantScope,
  OwnerRole,
} from "@repo/backend/confect/access/schema";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { Effect, Option, Schema } from "effect";

/**
 * The first invariant a new temporary grant breaks. Temporary grants are the
 * visit grants of operators: only operator Persons hold them, only active ones,
 * and never the Owner or Admin role, whose grants stand until someone ends them.
 */
const temporaryRefusal = (
  person: TenantPeopleDoc,
  role: BuiltinRole
): Option.Option<GrantRejected> => {
  if (person.kind !== "operator") {
    return Option.some(
      new GrantRejected({
        code: "PERSON_KIND",
        message: "Only operators hold temporary grants.",
      })
    );
  }
  if (person.status !== "active") {
    return Option.some(inactivePerson());
  }
  if (role === "integration") {
    return Option.some(integrationRole());
  }
  if (Schema.is(OwnerRole)(role)) {
    return Option.some(
      new GrantRejected({
        code: "TEMPORARY_ROLE",
        message: "An Owner or Admin role is never temporary.",
      })
    );
  }
  return Option.none();
};

/**
 * Gives an operator Person a temporary role that ends at `expiresAt`, under the
 * invariants of temporary grants, and records it under the Person. A visit is
 * its only use, and a visit grant is always the Auditor role, so approving one
 * never mints an Admin. The caller schedules the end of the grant.
 */
export const assignTemporaryRole = Effect.fn("access.grant.assignTemporary")(
  function* (
    actor: typeof TenantActor.Type,
    person: TenantPeopleDoc,
    role: BuiltinRole,
    scope: GrantScope,
    expiresAt: number
  ) {
    yield* Option.match(temporaryRefusal(person, role), {
      onNone: () => Effect.void,
      onSome: Effect.fail,
    });
    return yield* writeGrant(
      actor,
      person,
      yield* activeGrants(person._id),
      role,
      scope,
      { expiresAt, kind: "temporary" }
    );
  }
);
