import { Id } from "@repo/backend/confect/_generated/id";
import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { GrantScope, Rule } from "@repo/backend/confect/access/schema";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, HashMap, Option, Schema } from "effect";

/** Where a subject sits and whether its state refuses writes. */
export const Placement = Schema.Struct({
  /** The subject or its container is ended, archived, or closed. */
  locked: Schema.Boolean,
  /** Units whose grants cover the subject; empty for tenant-level subjects. */
  units: Schema.Array(Id("tenantUnits")),
});

/** One action on one subject: allowed, or refused by role or by condition. */
export const Decision = Schema.Literals(["allow", "role", "condition"]);

/**
 * Decides one rule for one principal on one placed subject. Conditions come
 * first, so no role or relation overrides a suspended tenant or a locked
 * subject. Relations decide only what roles leave open, so their checks, the
 * only reads a decision may make, run last. No rule reads the clock.
 */
export const decide = Effect.fn("access.decide")(function* (
  rule: Rule,
  placement: typeof Placement.Type,
  member: Member["Service"],
  relations: HashMap.HashMap<
    string,
    Effect.Effect<boolean, never, DatabaseReader>
  >
): Effect.fn.Return<typeof Decision.Type, never, DatabaseReader> {
  if (
    rule.access === "write" &&
    (member.tenant.status === "suspended" || placement.locked)
  ) {
    return "condition";
  }
  const byRole = Rule.match(rule, {
    relations: () => false,
    roles: ({ roles }) =>
      Arr.some(
        member.grants,
        (grant) =>
          GrantScope.match(grant.scope, {
            tenant: () => true,
            unit: ({ unitId }) => Arr.contains(placement.units, unitId),
          }) &&
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
