import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  classOf,
  cohort,
  nf,
  openPeriod,
  period,
} from "@repo/backend/test/classroom";
import { examBy } from "@repo/backend/test/exams";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { finish, state } = refs.public.tenancy.setup;
const viewer = refs.public.tenancy.viewer.get;

describe("tenancy/setup state", () => {
  it.effect("reads each step from the school's own data", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");

      const before = yield* owner.query(state, { slug: nf });
      expect(before).toMatchObject({
        classroom: false,
        exam: false,
        parent: false,
        period: false,
      });

      const term = yield* period(fixture, fixture.units.smp);
      yield* openPeriod(fixture, term.id);
      const group = yield* cohort(fixture, term.id, "VII-A");
      yield* classOf(fixture, group.id, "Fisika");
      yield* examBy(fixture, "admin", "Ulangan Harian");
      yield* fixture.as("admin").mutation(refs.public.guardians.links.start, {
        email: Schema.decodeSync(Email)("ibu@example.com"),
        guardianName: "Ibu Siti",
        slug: nf,
        studentId: fixture.people.student.personId,
      });

      expect(yield* owner.query(state, { slug: nf })).toEqual({
        classroom: true,
        cohort: true,
        exam: true,
        parent: true,
        period: true,
        student: true,
        teacher: true,
      });
    })
  );

  it.effect("refuses a member who may not manage the school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;

      const refused = yield* fixture
        .as("teacher")
        .query(state, { slug: nf })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});

describe("tenancy/setup finish", () => {
  it.effect("marks the school's setup finished once and journals it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      expect((yield* owner.query(viewer, { slug: nf })).tenant.setupDone).toBe(
        false
      );

      yield* owner.mutation(finish, { slug: nf });
      yield* owner.mutation(finish, { slug: nf });

      expect((yield* owner.query(viewer, { slug: nf })).tenant.setupDone).toBe(
        true
      );
      const entries = yield* fixture.run(journal);
      expect(
        Arr.filter(
          entries,
          (entry) => entry.change.type === "tenant.setup.finished"
        )
      ).toHaveLength(1);
    })
  );
});
