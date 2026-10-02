import { describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { decide } from "@repo/backend/confect/access/decision";
import type { Rule, RuleRole } from "@repo/backend/confect/access/schema";
import {
  defectOf,
  principal,
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
const tenantLevel = { locked: false, units: [] };
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
          return [
            yield* decide(read([]), tenantLevel, owner, related(false)),
            yield* decide(
              read(["auditor"]),
              tenantLevel,
              auditor,
              related(false)
            ),
            yield* decide(
              read(["admin"]),
              tenantLevel,
              auditor,
              related(false)
            ),
            yield* decide(read(["admin"]), tenantLevel, auditor, related(true)),
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
                read(["principal"]),
                { locked: false, units },
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
            const locked = { locked: true, units: [] };
            const onLocked = [
              yield* decide(
                write,
                locked,
                yield* principal(ownerId),
                related(true)
              ),
              yield* decide(
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
            return [
              ...onLocked,
              yield* decide(write, tenantLevel, suspended, related(true)),
              yield* decide(read([]), tenantLevel, suspended, related(false)),
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
                decide(guardianOnly, tenantLevel, owner, related(holds))
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
            decide(guardianOnly, tenantLevel, owner, HashMap.empty())
          ),
          Effect.exit,
          Effect.map(defectOf)
        )
      );
      expect(defect).toContain("undeclared relation guardian");
    })
  );
});
