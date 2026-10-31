import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { cohort, nf, period } from "@repo/backend/test/classroom";
import { examBy } from "@repo/backend/test/exams";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { finish, state } = refs.public.tenancy.setup;
const viewer = refs.public.tenancy.viewer.get;

describe("tenancy/setup state", () => {
  it.effect("reads each step from the school's own data", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");

      const before = yield* owner.query(state, { slug: nf });
      expect(before).toMatchObject({ exam: false, period: false });

      const term = yield* period(fixture, fixture.units.smp);
      yield* cohort(fixture, term.id, "VII-A");
      yield* examBy(fixture, "admin", "Ulangan Harian");

      expect(yield* owner.query(state, { slug: nf })).toEqual({
        cohort: true,
        exam: true,
        period: true,
        student: true,
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
