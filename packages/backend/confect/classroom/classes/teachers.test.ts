import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  classOf,
  cohort,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { teachers } = refs.public.classroom.classes;

describe("classroom/classes teachers", () => {
  it.effect(
    "names the teachers of the classes a table asks for, and nobody under another period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const other = yield* period(fixture, fixture.units.sma);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const empty = yield* classOf(fixture, x1.id, "Kimia");
        yield* teach(fixture, made.id, fixture.people.teacher.personId);
        const admin = fixture.as("admin");
        const asked = { classIds: [made.id, empty.id], slug: nf };

        expect(
          yield* admin.query(teachers, { ...asked, periodId: term.id })
        ).toEqual([
          { classId: made.id, names: [expect.any(String)] },
          { classId: empty.id, names: [] },
        ]);
        expect(
          yield* admin.query(teachers, { ...asked, periodId: other.id })
        ).toEqual([
          { classId: made.id, names: [] },
          { classId: empty.id, names: [] },
        ]);
      })
  );
});
