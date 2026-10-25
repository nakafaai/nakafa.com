import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { classOf, cohort, nf, period } from "@repo/backend/test/classroom";
import { grantRole, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const grants = refs.public.access.grants;
const placements = refs.public.tenancy.placements;

type Fixture = Effect.Success<typeof tenancyFixture>;

/**
 * Whether the class view rule admits one Person, as the class's own authority
 * decides it. The Person's principal loads the active grants at this moment, so a
 * revoked grant is absent from it, as it is from a request.
 */
const mayView = (
  fixture: Fixture,
  classId: GenericId.GenericId<"classes">,
  personId: GenericId.GenericId<"tenantPeople">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const row = yield* reader
        .table("classes")
        .get(classId)
        .pipe(Effect.orDie);
      const person = yield* reader
        .table("tenantPeople")
        .get(personId)
        .pipe(Effect.orDie);
      const tenant = yield* reader
        .table("tenants")
        .get(fixture.tenants.nf)
        .pipe(Effect.orDie);
      const held = yield* activeGrants(personId);
      return yield* classAuthority.check("class.view", row).pipe(
        Effect.provideService(Member, { grants: held, person, tenant }),
        Effect.as(true),
        Effect.catchTag("AccessDenied", () => Effect.succeed(false))
      );
    })
  );

describe("classroom/authority class members", () => {
  it.effect(
    "admits a placed student only while a student grant over the class unit stands",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const { grantId, personId } = fixture.people.student;
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId,
          slug: nf,
        });
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const before = yield* mayView(fixture, made.id, personId);
        yield* fixture
          .as("owner")
          .mutation(grants.revoke, { grantId, slug: nf });
        const after = yield* mayView(fixture, made.id, personId);
        expect([before, after]).toEqual([true, false]);
      })
  );

  it.effect(
    "refuses a placed student whose only student grant covers another unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const { grantId, personId } = fixture.people.student;
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId,
          slug: nf,
        });
        const made = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture
          .as("owner")
          .mutation(grants.revoke, { grantId, slug: nf });
        yield* fixture.run(
          grantRole(fixture.tenants.nf, personId, "student", {
            kind: "unit",
            unitId: fixture.units.sma,
          })
        );
        expect(yield* mayView(fixture, made.id, personId)).toBe(false);
      })
  );
});
