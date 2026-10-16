import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { decide } from "@repo/backend/confect/access/decision";
import type { Rule, RuleRole } from "@repo/backend/confect/access/schema";
import { clientPrincipal } from "@repo/backend/test/integrations";
import {
  defectOf,
  principal,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect, HashMap } from "effect";

const read = (roles: readonly (typeof RuleRole.Type)[]): Rule => ({
  access: "read",
  grantedBy: "roles",
  relations: ["member"],
  roles,
});
const write: Rule = {
  access: "write",
  grantedBy: "roles",
  relations: [],
  roles: ["admin"],
};
const guardianOnly: Rule = {
  access: "write",
  grantedBy: "relations",
  relations: ["guardian"],
};
/** A subject of one tenant that no unit covers and that no state locks. */
const tenantLevel = (tenantId: GenericId.GenericId<"tenants">) => ({
  locked: false,
  tenantId,
  units: [],
});
const related = (holds: boolean) =>
  HashMap.make(
    ["member", Effect.succeed(holds)],
    ["guardian", Effect.succeed(holds)]
  );

describe("access/decision", () => {
  it.effect("allows listed roles and every Owner, then relations", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const verdicts = yield* fixture.run(
        Effect.gen(function* () {
          const owner = yield* principal(fixture.people.owner.personId);
          const auditor = yield* principal(fixture.people.auditor.personId);
          const nf = tenantLevel(fixture.tenants.nf);
          return [
            yield* decide("tenant.view", read([]), nf, owner, related(false)),
            yield* decide(
              "tenant.view",
              read(["auditor"]),
              nf,
              auditor,
              related(false)
            ),
            yield* decide(
              "tenant.view",
              read(["admin"]),
              nf,
              auditor,
              related(false)
            ),
            yield* decide(
              "tenant.view",
              read(["admin"]),
              nf,
              auditor,
              related(true)
            ),
          ];
        })
      );
      expect(verdicts).toEqual(["allow", "allow", "role", "allow"]);
    })
  );

  it.effect("lets a unit grant cover only its own unit's subjects", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { sma, smp } = fixture.units;
      const verdicts = yield* fixture.run(
        principal(fixture.people.principal.personId).pipe(
          Effect.flatMap((smaPrincipal) =>
            Effect.forEach([[sma], [smp], []], (units) =>
              decide(
                "person.view",
                read(["principal"]),
                { locked: false, tenantId: fixture.tenants.nf, units },
                smaPrincipal,
                related(false)
              )
            )
          )
        )
      );
      expect(verdicts).toEqual(["allow", "role", "role"]);
    })
  );

  it.effect(
    "refuses writes on a locked subject or a suspended tenant first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const verdicts = yield* fixture.run(
          Effect.gen(function* () {
            const ownerId = fixture.people.owner.personId;
            const locked = {
              locked: true,
              tenantId: fixture.tenants.nf,
              units: [],
            };
            const onLocked = [
              yield* decide(
                "tenant.manage",
                write,
                locked,
                yield* principal(ownerId),
                related(true)
              ),
              yield* decide(
                "tenant.view",
                read([]),
                locked,
                yield* principal(ownerId),
                related(false)
              ),
            ];
            yield* (yield* DatabaseWriter)
              .table("tenants")
              .patch(fixture.tenants.nf, { status: "suspended" });
            const suspended = yield* principal(ownerId);
            const nf = tenantLevel(fixture.tenants.nf);
            return [
              ...onLocked,
              yield* decide(
                "tenant.manage",
                write,
                nf,
                suspended,
                related(true)
              ),
              yield* decide(
                "tenant.view",
                read([]),
                nf,
                suspended,
                related(false)
              ),
            ];
          })
        );
        expect(verdicts).toEqual(["condition", "allow", "condition", "allow"]);
      })
  );

  it.effect(
    "grants a relations rule through its relations only, never Owner",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const verdicts = yield* fixture.run(
          principal(fixture.people.owner.personId).pipe(
            Effect.flatMap((owner) =>
              Effect.forEach([false, true], (holds) =>
                decide(
                  "tenant.view",
                  guardianOnly,
                  tenantLevel(fixture.tenants.nf),
                  owner,
                  related(holds)
                )
              )
            )
          )
        );
        expect(verdicts).toEqual(["role", "allow"]);
      })
  );

  it.effect("dies on a rule that names an undeclared relation", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const defect = yield* fixture.run(
        principal(fixture.people.owner.personId).pipe(
          Effect.flatMap((owner) =>
            decide(
              "tenant.view",
              guardianOnly,
              tenantLevel(fixture.tenants.nf),
              owner,
              HashMap.empty()
            )
          ),
          Effect.exit,
          Effect.map(defectOf)
        )
      );
      expect(defect).toContain("undeclared relation guardian");
    })
  );

  it.effect("never lets a client of one tenant decide on another tenant", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const verdicts = yield* fixture.run(
        Effect.gen(function* () {
          const ours = yield* clientPrincipal(fixture.tenants.nf, {
            actions: ["person.view", "person.manage"],
            scope: { kind: "tenant" },
            status: "active",
          });
          const foreign = tenantLevel(fixture.tenants.other);
          return [
            yield* decide(
              "person.view",
              read(["integration"]),
              foreign,
              ours,
              related(false)
            ),
            yield* decide(
              "person.manage",
              write,
              { locked: true, tenantId: fixture.tenants.other, units: [] },
              ours,
              related(false)
            ),
          ];
        })
      );
      expect(verdicts).toEqual(["resource", "resource"]);
    })
  );

  it.effect("refuses a revoked client on every action, reads included", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const verdicts = yield* fixture.run(
        Effect.gen(function* () {
          const revoked = yield* clientPrincipal(fixture.tenants.nf, {
            actions: ["person.view", "person.manage"],
            scope: { kind: "tenant" },
            status: "revoked",
          });
          const nf = tenantLevel(fixture.tenants.nf);
          return [
            yield* decide(
              "person.view",
              read(["integration"]),
              nf,
              revoked,
              related(false)
            ),
            yield* decide("person.manage", write, nf, revoked, related(false)),
          ];
        })
      );
      expect(verdicts).toEqual(["condition", "condition"]);
    })
  );

  it.effect("allows a client only the actions on its own list", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const verdicts = yield* fixture.run(
        Effect.gen(function* () {
          const roster = yield* clientPrincipal(fixture.tenants.nf, {
            actions: ["person.view"],
            scope: { kind: "tenant" },
            status: "active",
          });
          const nf = tenantLevel(fixture.tenants.nf);
          return [
            yield* decide(
              "person.view",
              read(["integration"]),
              nf,
              roster,
              related(false)
            ),
            yield* decide(
              "cohort.view",
              read(["integration"]),
              nf,
              roster,
              related(false)
            ),
          ];
        })
      );
      expect(verdicts).toEqual(["allow", "role"]);
    })
  );

  it.effect("never lets a person rule admit a client", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const verdicts = yield* fixture.run(
        Effect.gen(function* () {
          const roster = yield* clientPrincipal(fixture.tenants.nf, {
            actions: ["person.view", "person.manage"],
            scope: { kind: "tenant" },
            status: "active",
          });
          const nf = tenantLevel(fixture.tenants.nf);
          return [
            yield* decide(
              "person.view",
              read(["admin", "auditor"]),
              nf,
              roster,
              related(true)
            ),
            yield* decide("person.manage", write, nf, roster, related(true)),
            yield* decide(
              "person.view",
              guardianOnly,
              nf,
              roster,
              related(true)
            ),
          ];
        })
      );
      expect(verdicts).toEqual(["role", "role", "role"]);
    })
  );

  it.effect("covers a unit client only the subjects of its unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { sma, smp } = fixture.units;
      const verdicts = yield* fixture.run(
        Effect.gen(function* () {
          const unitRoster = yield* clientPrincipal(fixture.tenants.nf, {
            actions: ["person.view"],
            scope: { kind: "unit", unitId: sma },
            status: "active",
          });
          return yield* Effect.forEach([[sma], [smp], []], (units) =>
            decide(
              "person.view",
              read(["integration"]),
              { locked: false, tenantId: fixture.tenants.nf, units },
              unitRoster,
              related(false)
            )
          );
        })
      );
      expect(verdicts).toEqual(["allow", "role", "role"]);
    })
  );

  it.effect(
    "refuses a client's write on a locked subject or in a suspended tenant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const manageRule: Rule = {
          access: "write",
          grantedBy: "roles",
          relations: [],
          roles: ["integration"],
        };
        const verdicts = yield* fixture.run(
          Effect.gen(function* () {
            const roster = yield* clientPrincipal(fixture.tenants.nf, {
              actions: ["person.manage"],
              scope: { kind: "tenant" },
              status: "active",
            });
            const nf = tenantLevel(fixture.tenants.nf);
            const onLocked = yield* decide(
              "person.manage",
              manageRule,
              { locked: true, tenantId: fixture.tenants.nf, units: [] },
              roster,
              related(false)
            );
            const open = yield* decide(
              "person.manage",
              manageRule,
              nf,
              roster,
              related(false)
            );
            yield* (yield* DatabaseWriter)
              .table("tenants")
              .patch(fixture.tenants.nf, { status: "suspended" });
            const inSuspended = yield* clientPrincipal(fixture.tenants.nf, {
              actions: ["person.manage"],
              scope: { kind: "tenant" },
              status: "active",
            });
            const suspended = yield* decide(
              "person.manage",
              manageRule,
              nf,
              inSuspended,
              related(false)
            );
            return [onLocked, open, suspended];
          })
        );
        expect(verdicts).toEqual(["condition", "allow", "condition"]);
      })
  );

  it.effect(
    "lets a transition end access in a suspended tenant, where a write is refused",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const transition: Rule = {
          access: "transition",
          grantedBy: "roles",
          relations: [],
          roles: ["admin"],
        };
        const verdicts = yield* fixture.run(
          Effect.gen(function* () {
            yield* suspend(fixture.tenants.nf);
            const owner = yield* principal(fixture.people.owner.personId);
            const nf = tenantLevel(fixture.tenants.nf);
            return [
              yield* decide("tenant.manage", write, nf, owner, related(false)),
              yield* decide(
                "tenant.manage",
                transition,
                nf,
                owner,
                related(false)
              ),
            ];
          })
        );
        expect(verdicts).toEqual(["condition", "allow"]);
      })
  );
});
