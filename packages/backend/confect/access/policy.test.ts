import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { grantAuthority } from "@repo/backend/confect/access/authority";
import type { AccessDenied } from "@repo/backend/confect/access/errors";
import { Authority } from "@repo/backend/confect/access/policy";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Person } from "@repo/backend/confect/tenancy/access";
import {
  personAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { person } from "@repo/backend/confect/tenancy/kinds";
import {
  defectOf,
  principal,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit, Order, Schema } from "effect";

const system = { kind: "system" } as const;
const Named = Schema.Struct({ name: Schema.String });
/** A check's outcome: the checked row's name, or the reason it was denied. */
const outcome = Effect.match({
  onFailure: (error: AccessDenied) => error.reason,
  onSuccess: (row: typeof Named.Type) => row.name,
});
/** A check's verdict on a row the test already holds. */
const verdict = Effect.match({
  onFailure: (error: AccessDenied) => error.reason,
  onSuccess: () => "allow",
});

describe("access/policy authority", () => {
  it.effect(
    "returns the checked row and denies foreign, missing, and unpermitted subjects",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { otherOwner, owner, teacher } = fixture.people;
        const outcomes = yield* fixture.run(
          Effect.gen(function* () {
            yield* (yield* DatabaseWriter)
              .table("tenantPeople")
              .delete(fixture.invited);
            const asOwner = Effect.provideService(
              Member,
              yield* principal(owner.personId)
            );
            return [
              yield* personAuthority
                .authorize("person.view", teacher.personId)
                .pipe(outcome, asOwner),
              yield* personAuthority
                .authorize("person.view", otherOwner.personId)
                .pipe(outcome, asOwner),
              yield* personAuthority
                .authorize("person.view", fixture.invited)
                .pipe(outcome, asOwner),
              yield* tenantAuthority
                .authorize("grant.manage", fixture.tenants.nf)
                .pipe(
                  outcome,
                  Effect.provideService(
                    Member,
                    yield* principal(teacher.personId)
                  )
                ),
            ];
          })
        );
        expect(outcomes).toEqual(["Teacher", "resource", "resource", "role"]);
      })
  );

  it.effect(
    "denies another tenant's loaded row in check and allows nothing on it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const results = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const foreign = yield* reader
              .table("tenantPeople")
              .get(fixture.people.otherOwner.personId);
            const own = yield* reader
              .table("tenantPeople")
              .get(fixture.people.teacher.personId);
            const asAdmin = Effect.provideService(
              Member,
              yield* principal(fixture.people.admin.personId)
            );
            return {
              checks: [
                yield* personAuthority
                  .check("person.view", foreign)
                  .pipe(verdict, asAdmin),
                yield* tenantAuthority
                  .check(
                    "tenant.view",
                    yield* reader.table("tenants").get(fixture.tenants.other)
                  )
                  .pipe(verdict, asAdmin),
              ],
              foreign: yield* personAuthority.allowed(foreign).pipe(asAdmin),
              own: yield* personAuthority.allowed(own).pipe(asAdmin),
            };
          }).pipe(Effect.orDie)
        );
        expect(results).toEqual({
          checks: ["resource", "resource"],
          foreign: [],
          own: ["person.view"],
        });
      })
  );

  it.effect("dies on an action no rule of the kind names", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const defect = yield* fixture.run(
        principal(fixture.people.owner.personId).pipe(
          Effect.flatMap((owner) =>
            personAuthority
              // @ts-expect-error an action of another kind does not compile
              .check("grant.view", owner.person)
              .pipe(Effect.provideService(Member, owner))
          ),
          Effect.exit,
          Effect.map(defectOf)
        )
      );
      expect(defect).toContain("grant.view has no rule on kind person");
    })
  );

  it.effect(
    "lists every action the caller may perform on a loaded subject",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const lists = yield* fixture.run(
          Effect.gen(function* () {
            const owner = yield* principal(fixture.people.owner.personId);
            const teacher = yield* principal(fixture.people.teacher.personId);
            const teacherGrant = yield* (yield* DatabaseReader)
              .table("tenantGrants")
              .get(fixture.people.teacher.grantId);
            const asOwner = Effect.provideService(Member, owner);
            return [
              Arr.sort(
                yield* tenantAuthority.allowed(owner.tenant).pipe(asOwner),
                Order.String
              ),
              Arr.sort(
                yield* grantAuthority.allowed(teacherGrant).pipe(asOwner),
                Order.String
              ),
              yield* grantAuthority
                .allowed(teacherGrant)
                .pipe(Effect.provideService(Member, teacher)),
            ];
          }).pipe(Effect.orDie)
        );
        expect(lists).toEqual([
          [
            "audit.view",
            "grant.manage",
            "owner.manage",
            "tenant.manage",
            "tenant.view",
          ],
          ["grant.revoke", "grant.view"],
          ["grant.view"],
        ]);
      })
  );
});

describe("access/policy journal record", () => {
  it.effect(
    "files each entry under its subject's tenant with the subject's reference",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { otherOwner, owner, teacher } = fixture.people;
        const filed = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const people = reader.table("tenantPeople");
            const recorded = [
              yield* personAuthority.record(
                { id: owner.personId, kind: "person" },
                yield* people.get(teacher.personId),
                { type: "person.created" }
              ),
              yield* personAuthority.record(
                system,
                yield* people.get(otherOwner.personId),
                { type: "person.removed" }
              ),
            ];
            return yield* Effect.forEach(recorded, (id) =>
              reader.table("journalEntries").get(id)
            );
          }).pipe(Effect.orDie)
        );
        expect(filed).toMatchObject([
          {
            actor: { id: owner.personId, kind: "person" },
            change: { type: "person.created" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: teacher.personId, kind: "person" },
          },
          {
            actor: system,
            change: { type: "person.removed" },
            owner: { kind: "tenant", tenantId: fixture.tenants.other },
            subject: { id: otherOwner.personId, kind: "person" },
          },
        ]);
      })
  );

  it.effect("leaves no entry when the mutation that recorded it fails", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exit = yield* fixture
        .run(
          Effect.gen(function* () {
            yield* personAuthority.record(
              system,
              yield* (yield* DatabaseReader)
                .table("tenantPeople")
                .get(fixture.people.teacher.personId),
              { type: "person.created" }
            );
            return yield* Effect.die("the mutation fails after recording");
          })
        )
        .pipe(Effect.exit);
      const entries = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("journalEntries").index("by_creation_time").take(10)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(entries).toEqual([]);
    })
  );

  it("records only the subject kind's changes by a tenant actor, never with an owner", () => {
    const recordAbout = (
      holder: TenantPeopleDoc,
      account: GenericId.GenericId<"users">
    ) => [
      // @ts-expect-error a unit change cannot describe a person
      personAuthority.record(system, holder, { type: "unit.created" }),
      personAuthority.record(
        // @ts-expect-error an account never acts inside a tenant
        { id: account, kind: "user" },
        holder,
        { type: "person.created" }
      ),
      personAuthority.record(
        system,
        holder,
        { type: "person.created" },
        // @ts-expect-error the owner comes from the subject, never from the caller
        { kind: "tenant", tenantId: holder.tenantId }
      ),
    ];
    expect(recordAbout).toBeTypeOf("function");
  });
});

describe("access/policy kind middleware", () => {
  const run = (arg: string, provided: boolean) =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      return yield* fixture.run(
        Effect.gen(function* () {
          const owner = yield* principal(fixture.people.owner.personId);
          const strategy = personAuthority
            .middleware(Person)(Effect.die("the handler ran"), {
              invocation: {
                args: { personId: owner.person._id },
                functionType: "query",
                functionVisibility: "public",
                name: "probe",
              },
              options: { action: "person.view", arg },
            })
            .pipe(Effect.provideService(Member, owner));
          return defectOf(
            yield* Effect.exit(
              provided
                ? strategy.pipe(Effect.provideService(Person, owner.person))
                : strategy
            )
          );
        })
      );
    });

  it.effect("dies when the same kind's subject is already provided", () =>
    Effect.gen(function* () {
      expect(yield* run("personId", true)).toContain(
        "person access middleware is attached twice"
      );
    })
  );

  it.effect("dies when `arg` names no ID argument", () =>
    Effect.gen(function* () {
      const defect = yield* run("unknown", false);
      expect(defect).not.toBe("no defect");
      expect(defect).not.toContain("the handler ran");
    })
  );

  it.effect("runs the handler once the subject passes its check", () =>
    Effect.gen(function* () {
      expect(yield* run("personId", false)).toContain("the handler ran");
    })
  );
});

describe("access/policy authority contract", () => {
  it("requires exactly the relations its kind declares", () => {
    const place = () => Effect.succeed({ locked: false, units: [] });
    const tenantOf = (row: TenantPeopleDoc) => row.tenantId;
    const missing = Authority.make(person, Authority.load(person), {
      place,
      // @ts-expect-error a declared relation without a check does not compile
      relations: {},
      tenantOf,
    });
    const extra = Authority.make(person, Authority.load(person), {
      place,
      relations: {
        // @ts-expect-error a relation the kind does not declare does not compile
        holder: () => Effect.succeed(true),
        self: () => Effect.succeed(true),
      },
      tenantOf,
    });
    expect([missing.authorize, extra.authorize]).toHaveLength(2);
  });
});
