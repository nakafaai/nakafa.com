import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  classOf,
  cohort,
  nf,
  period,
  sdUnit,
} from "@repo/backend/test/classroom";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { changeSubject, rename } = refs.public.classroom.classes;

describe("classroom/classes changeSubject", () => {
  it.effect(
    "corrects a subject, and a name that reads as the old subject follows it while the address stays",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisikaa");
        const admin = fixture.as("admin");
        const args = { classId: made.id, slug: nf };
        const changed = yield* admin.mutation(changeSubject, {
          ...args,
          subject: "Fisika",
        });
        expect(changed).toEqual({
          ...made,
          name: "Fisika X-1",
          subject: "Fisika",
        });
        const again = yield* admin.mutation(changeSubject, {
          ...args,
          subject: "Fisika",
        });
        expect(again).toEqual(changed);
      })
  );

  it.effect("keeps a name someone chose", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const made = yield* classOf(fixture, x1.id, "Fisika");
      const admin = fixture.as("admin");
      const args = { classId: made.id, slug: nf };
      yield* admin.mutation(rename, { ...args, name: "Fisika Lanjut" });
      const changed = yield* admin.mutation(changeSubject, {
        ...args,
        subject: "IPA",
      });
      expect(changed).toMatchObject({ name: "Fisika Lanjut", subject: "IPA" });
    })
  );

  it.effect(
    "refuses a subject or a name another active class of the cohort has",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        const admin = fixture.as("admin");
        yield* admin.mutation(rename, {
          classId: kimia.id,
          name: "Biologi X-1",
          slug: nf,
        });
        const failures = yield* Effect.all([
          admin
            .mutation(changeSubject, {
              classId: fisika.id,
              slug: nf,
              subject: "kimia",
            })
            .pipe(Effect.flip),
          admin
            .mutation(changeSubject, {
              classId: fisika.id,
              slug: nf,
              subject: "Biologi",
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "ClassSubjectTaken" },
          { _tag: "ClassNameTaken" },
        ]);
      })
  );

  it.effect("refuses the homeroom class, which holds no subject", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, yield* sdUnit(fixture));
      const first = yield* cohort(fixture, term.id, "1A");
      const homeroom = yield* classOf(fixture, first.id);
      const refused = yield* fixture
        .as("admin")
        .mutation(changeSubject, {
          classId: homeroom.id,
          slug: nf,
          subject: "IPA",
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "ClassSubjectNotAllowed" });
    })
  );

  it.effect("refuses a student, who cannot manage the class", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const made = yield* classOf(fixture, x1.id, "Fisika");
      const refused = yield* fixture
        .as("student")
        .mutation(changeSubject, {
          classId: made.id,
          slug: nf,
          subject: "IPA",
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});
