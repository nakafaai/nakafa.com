import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  denied,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { archive, rename, restore } = refs.public.classroom.classes;
const cohorts = refs.public.tenancy.cohorts;
const missingClass = Schema.decodeUnknownSync(Id("classes"))(
  "000000000000000099999classes"
);

describe("classroom/classes restore", () => {
  it.effect(
    "restores an archived class once, journals it, and leaves an active class as it is",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const admin = fixture.as("admin");
        yield* admin.mutation(archive, { classId: fisika.id, slug: nf });
        const restored = yield* admin.mutation(restore, {
          classId: fisika.id,
          slug: nf,
        });
        const again = yield* admin.mutation(restore, {
          classId: fisika.id,
          slug: nf,
        });
        expect(restored).toEqual({ ...fisika, status: "active" });
        expect(again).toEqual(restored);
        expect(
          Arr.filter(
            yield* fixture.run(journal),
            (entry) => entry.change.type === "class.restored"
          )
        ).toHaveLength(1);
      })
  );

  it.effect(
    "refuses a teacher, a class whose cohort is archived, and a class whose name or subject an active class now holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const admin = fixture.as("admin");
        yield* admin.mutation(archive, { classId: fisika.id, slug: nf });
        const teacher = yield* fixture
          .as("teacher")
          .mutation(restore, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        const replacement = yield* classOf(fixture, x1.id, "Fisika");
        const nameTaken = yield* admin
          .mutation(restore, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        yield* admin.mutation(rename, {
          classId: replacement.id,
          name: "Fisika Baru",
          slug: nf,
        });
        const subjectTaken = yield* admin
          .mutation(restore, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        yield* admin.mutation(cohorts.archive, { cohortId: x1.id, slug: nf });
        const locked = yield* admin
          .mutation(restore, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        expect([teacher, nameTaken, subjectTaken, locked]).toMatchObject([
          denied("role"),
          { _tag: "ClassNameTaken" },
          { _tag: "ClassSubjectTaken" },
          denied("condition"),
        ]);
      })
  );

  it.effect(
    "gives a restored class the next free address when a class of another unit took its own",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const smpTerm = yield* period(fixture, fixture.units.smp);
        const smp = yield* cohort(fixture, smpTerm.id, "X-1");
        const fisika = yield* classOf(fixture, smp.id, "Fisika");
        const admin = fixture.as("admin");
        yield* admin.mutation(archive, { classId: fisika.id, slug: nf });
        const smaTerm = yield* period(fixture, fixture.units.sma);
        const sma = yield* cohort(fixture, smaTerm.id, "X-1");
        const other = yield* classOf(fixture, sma.id, "Fisika");
        const restored = yield* admin.mutation(restore, {
          classId: fisika.id,
          slug: nf,
        });
        expect(other.slug).toBe(fisika.slug);
        expect(restored.slug).toBe(`${fisika.slug}-2`);
      })
  );

  it.effect(
    "refuses a class that is missing or of another school as missing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const foreign = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("classes").insert({
              cohortId: x1.id,
              createdAt: 1,
              name: "Asing",
              nameKey: "asing",
              periodId: term.id,
              slug: "asing",
              status: "archived",
              subjectKey: "asing",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.smp,
              updatedAt: 1,
            })
          ).pipe(Effect.orDie)
        );
        const admin = fixture.as("admin");
        const refusals = yield* Effect.forEach(
          [missingClass, foreign],
          (classId) =>
            admin.mutation(restore, { classId, slug: nf }).pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );
});
