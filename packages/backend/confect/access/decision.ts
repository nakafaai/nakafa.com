import { Id } from "@repo/backend/confect/_generated/id";
import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  ClientPrincipal,
  Principal,
} from "@repo/backend/confect/access/principal";
import { GrantScope, Rule } from "@repo/backend/confect/access/schema";
import { Array as Arr, Effect, HashMap, Option, Schema } from "effect";

/** Where a subject sits and whether its state refuses writes. */
export const Placement = Schema.Struct({
  /** The subject or its container is ended, archived, or closed. */
  locked: Schema.Boolean,
  /** Units whose grants cover the subject; empty for tenant-level subjects. */
  units: Schema.Array(Id("tenantUnits")),
});

/** A subject as a decision reads it: the tenant it belongs to, and where it sits. */
const Subject = Schema.Struct({
  ...Placement.fields,
  tenantId: Id("tenants"),
});

/** One action on one subject: allowed, or refused by tenant, by condition, or by role. */
const Decision = Schema.Literals(["allow", "role", "condition", "resource"]);

/** Whether a scope covers a subject placed in these units. A tenant scope covers every subject. */
const covers = (
  scope: GrantScope,
  units: (typeof Placement.Type)["units"]
): boolean =>
  GrantScope.match(scope, {
    tenant: () => true,
    unit: ({ unitId }) => Arr.contains(units, unitId),
  });

/**
 * Decides one action for an integration client. The rule must open the action
 * to the Integration role, the client's action list must name it, and the
 * client's scope must cover the subject. A person's grants and relations never
 * count for a client.
 */
const decideForClient = (
  action: string,
  rule: Rule,
  subject: typeof Subject.Type,
  client: (typeof ClientPrincipal.Type)["client"]
): typeof Decision.Type => {
  if (rule.grantedBy !== "roles" || !Arr.contains(rule.roles, "integration")) {
    return "role";
  }
  if (!Arr.some(client.actions, (listed) => listed === action)) {
    return "role";
  }
  return covers(client.scope, subject.units) ? "allow" : "role";
};

/**
 * Decides one action for one principal on one subject, a Person through
 * `Member` or an integration client. The subject's tenant comes first, so a
 * principal of another tenant is refused whatever the subject's state. A
 * revoked client and a write in a suspended tenant or on a locked subject are
 * refused as `condition`, even for Owners. Then a client is decided by its
 * action list, and a Person by roles and, where roles leave it open, relations.
 * Relations are checked last, and they are the only reads a decision makes. No
 * rule reads the clock.
 */
export const decide = Effect.fn("access.decide")(function* (
  action: string,
  rule: Rule,
  subject: typeof Subject.Type,
  principal: Principal,
  relations: HashMap.HashMap<
    string,
    Effect.Effect<boolean, never, DatabaseReader>
  >
): Effect.fn.Return<typeof Decision.Type, never, DatabaseReader> {
  if (principal.tenant._id !== subject.tenantId) {
    return "resource";
  }
  const revoked =
    "client" in principal && principal.client.status === "revoked";
  if (
    revoked ||
    (rule.access === "write" &&
      (principal.tenant.status === "suspended" || subject.locked))
  ) {
    return "condition";
  }
  if ("client" in principal) {
    return decideForClient(action, rule, subject, principal.client);
  }
  const { grants } = principal;
  const byRole = Rule.match(rule, {
    relations: () => false,
    roles: ({ roles }) =>
      Arr.some(
        grants,
        (grant) =>
          covers(grant.scope, subject.units) &&
          (grant.role.key === "owner" ||
            Arr.some(roles, (role) => role === grant.role.key))
      ),
  });
  if (byRole) {
    return "allow";
  }
  const related = yield* Effect.findFirst(rule.relations, (relation) =>
    Option.getOrElse(HashMap.get(relations, relation), () =>
      Effect.die(`Access rules name an undeclared relation ${relation}.`)
    )
  );
  return Option.isSome(related) ? "allow" : "role";
});
