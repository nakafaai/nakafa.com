import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  scheduleSitting,
} from "@repo/backend/test/sittings";
import {
  journal,
  slugOf,
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const cancel = refs.public.exams.sittings.cancel;
const nf = slugOf("nf");

/** The rooms that one exam still holds, in the order the index reads them. */
const roomsOf = (
  fixture: Effect.Success<typeof tenancyFixture>,
  examId: GenericId.GenericId<"exams">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("examSittings")
        .index("by_examId_and_opensAt", (query) => query.eq("examId", examId))
        .take(10)
        .pipe(Effect.orDie)
    )
  );

/** Whether a sitting of one exam has frozen it, which a scheduled room does. */
const frozenOf = (
  fixture: Effect.Success<typeof tenancyFixture>,
  examId: GenericId.GenericId<"exams">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("exams")
        .get(examId)
        .pipe(
          Effect.map((exam) => exam.frozenAt !== undefined),
          Effect.orDie
        )
    )
  );

describe("exams/sittings cancel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "lets the Person who scheduled a room cancel it, unfreezes the exam, and records the cancel",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        expect(yield* frozenOf(fixture, examId)).toBe(true);
        expect(
          yield* fixture
            .as("teacher")
            .mutation(cancel, { sittingId: made.id, slug: nf })
        ).toBeNull();
        expect(yield* roomsOf(fixture, examId)).toEqual([]);
        expect(yield* frozenOf(fixture, examId)).toBe(false);
        expect(
          Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
        ).toContain("sitting.cancel");
      })
  );

  it.effect("lets an Admin cancel a room that another Person scheduled", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* keyedSchool(fixture);
      const examId = yield* keyedExam(fixture, "Ulangan");
      const made = yield* scheduleSitting(fixture, {
        closesAt: CLOSES_AT,
        examId,
        group: { kind: "unit", unitId: fixture.units.smp },
        opensAt: OPENS_AT,
      });
      yield* fixture
        .as("admin")
        .mutation(cancel, { sittingId: made.id, slug: nf });
      expect(yield* roomsOf(fixture, examId)).toEqual([]);
    })
  );

  it.effect(
    "keeps the exam frozen while another room of it remains, and refuses a teacher who neither scheduled the room nor is an Admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Dua ruang");
        const first = yield* scheduleSitting(fixture, {
          actor: "admin",
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
          room: "Lab 1",
        });
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
          room: "Lab 2",
        });
        const refused = yield* fixture
          .as("teacher")
          .mutation(cancel, { sittingId: first.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied", reason: "role" });
        yield* fixture
          .as("admin")
          .mutation(cancel, { sittingId: first.id, slug: nf });
        expect(Arr.length(yield* roomsOf(fixture, examId))).toBe(1);
        expect(yield* frozenOf(fixture, examId)).toBe(true);
      })
  );

  it.effect(
    "refuses to cancel a room in a suspended school, as a write, and keeps the room",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ditangguhkan");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        yield* fixture.run(suspend(fixture.tenants.nf));
        const refused = yield* fixture
          .as("admin")
          .mutation(cancel, { sittingId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AccessDenied",
          reason: "condition",
        });
        expect(Arr.length(yield* roomsOf(fixture, examId))).toBe(1);
      })
  );

  it.effect(
    "refuses to cancel a room of an archived unit, as a write, and keeps the room",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Unit arsip");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantUnits")
              .patch(fixture.units.smp, { status: "archived" })
          )
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(cancel, { sittingId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AccessDenied",
          reason: "condition",
        });
        expect(Arr.length(yield* roomsOf(fixture, examId))).toBe(1);
      })
  );

  it.effect("keeps a room that has opened, and refuses to cancel it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* keyedSchool(fixture);
      const examId = yield* keyedExam(fixture, "Terbuka");
      const made = yield* scheduleSitting(fixture, {
        closesAt: CLOSES_AT,
        examId,
        group: { kind: "unit", unitId: fixture.units.smp },
        opensAt: OPENS_AT,
      });
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("examSittings").patch(made.id, { state: "open" })
        )
      );
      const refused = yield* fixture
        .as("teacher")
        .mutation(cancel, { sittingId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "RoomOpened",
        code: "ROOM_OPENED",
      });
      expect(Arr.length(yield* roomsOf(fixture, examId))).toBe(1);
    })
  );
});
