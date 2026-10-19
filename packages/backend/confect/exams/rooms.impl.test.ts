import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { denied, nf } from "@repo/backend/test/editor";
import { LANGUAGE } from "@repo/backend/test/exams";
import {
  CLOSES_AT as CLOSES,
  keyedExam,
  keyedSchool,
  mentions,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedPlacement,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { exam, list } = refs.public.exams.rooms;
const { create } = refs.public.exams.exams;

/** A room that opens half an hour after the first one opens, and closes with it. */
const LATER = OPENS + 1_800_000;

/** The address of the other school, for the isolation test. */
const OTHER_SCHOOL = slugOf("other");

/** The account a rooms read is made as, within the school. */
type Actor = "admin" | "deputy" | "principal" | "student" | "teacher";

/** The first page of the rooms of an exam, read as one account, with the given page size. */
const roomsOf = (
  fixture: SittingFixture,
  actor: Actor,
  examId: GenericId.GenericId<"exams">,
  numItems = 10
) =>
  fixture.as(actor).query(list, {
    examId,
    paginationOpts: { cursor: null, numItems },
    slug: nf,
  });

describe("exams/rooms", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "lists the rooms in the order they open, each with its unit's name and time zone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const late = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: LATER,
          room: "Lab 3",
        });
        const early = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
          room: "Lab 2",
        });
        const page = yield* roomsOf(fixture, "teacher", examId);
        expect(page.isDone).toBe(true);
        expect(page.page).toEqual([
          {
            closesAt: CLOSES,
            group: { kind: "unit", name: "SMP Nakafa" },
            id: early.id,
            opensAt: OPENS,
            room: "Lab 2",
            state: "scheduled",
            timeZone: "Asia/Jakarta",
          },
          {
            closesAt: CLOSES,
            group: { kind: "unit", name: "SMP Nakafa" },
            id: late.id,
            opensAt: LATER,
            room: "Lab 3",
            state: "scheduled",
            timeZone: "Asia/Jakarta",
          },
        ]);
      })
  );

  it.effect("names a cohort room by its cohort, and no token is in a row", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* keyedSchool(fixture);
      const examId = yield* keyedExam(fixture, "PTS");
      const cohortId = yield* seedPlacement(
        fixture,
        fixture.people.student.personId
      );
      const made = yield* scheduleSitting(fixture, {
        closesAt: CLOSES,
        examId,
        group: { cohortId, kind: "cohort" },
        opensAt: OPENS,
        room: "Lab 2",
      });
      const page = yield* roomsOf(fixture, "teacher", examId);
      expect(page.page).toMatchObject([
        { group: { kind: "cohort", name: "10A" }, id: made.id },
      ]);
      expect(mentions(page.page, made.token)).toBe(false);
    })
  );

  it.effect(
    "pages the rooms in their opening order, without repeating one, and says when the list is done",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        // The rooms are scheduled out of their opening order, so the page shows the order of the
        // opening times and not the order the rooms were made in.
        const rooms = [
          { opensAt: OPENS + 120_000, room: "Lab 3" },
          { opensAt: OPENS, room: "Lab 1" },
          { opensAt: OPENS + 60_000, room: "Lab 2" },
        ];
        yield* Effect.forEach(rooms, (scheduled) =>
          scheduleSitting(fixture, {
            closesAt: CLOSES,
            examId,
            group: { kind: "unit", unitId: fixture.units.smp },
            opensAt: scheduled.opensAt,
            room: scheduled.room,
          })
        );
        const first = yield* roomsOf(fixture, "teacher", examId, 2);
        expect(first.isDone).toBe(false);
        const second = yield* fixture.as("teacher").query(list, {
          examId,
          paginationOpts: { cursor: first.continueCursor, numItems: 2 },
          slug: nf,
        });
        expect(second.isDone).toBe(true);
        expect(
          Arr.map(Arr.appendAll(first.page, second.page), (row) => row.room)
        ).toEqual(["Lab 1", "Lab 2", "Lab 3"]);
      })
  );

  it.effect("narrows the rooms to one state when the caller names it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const opened = yield* openedSitting(fixture, "PTS");
      const { examId } = yield* sittingRow(fixture, opened.id);
      const scheduled = yield* scheduleSitting(fixture, {
        closesAt: CLOSES,
        examId,
        group: { kind: "unit", unitId: fixture.units.smp },
        opensAt: LATER,
        room: "Lab 3",
      });
      const readState = (state: "open" | "scheduled") =>
        fixture.as("teacher").query(list, {
          examId,
          paginationOpts: { cursor: null, numItems: 10 },
          slug: nf,
          state,
        });
      const open = yield* readState("open");
      expect(Arr.map(open.page, (row) => row.id)).toEqual([opened.id]);
      const scheduledOnly = yield* readState("scheduled");
      expect(Arr.map(scheduledOnly.page, (row) => row.id)).toEqual([
        scheduled.id,
      ]);
      const every = yield* roomsOf(fixture, "teacher", examId);
      expect(Arr.map(every.page, (row) => row.id)).toEqual([
        opened.id,
        scheduled.id,
      ]);
    })
  );

  it.effect(
    "refuses the rooms of another school's exam, as it refuses a missing exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const listed = yield* fixture
          .as("otherOwner")
          .query(list, {
            examId,
            paginationOpts: { cursor: null, numItems: 10 },
            slug: OTHER_SCHOOL,
          })
          .pipe(Effect.flip);
        const summary = yield* fixture
          .as("otherOwner")
          .query(exam, { examId, slug: OTHER_SCHOOL })
          .pipe(Effect.flip);
        expect([listed, summary]).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );

  it.effect(
    "refuses a teacher and a student the rooms of a school-wide exam, which no unit grant covers",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const schoolExam = yield* fixture.as("admin").mutation(create, {
          language: LANGUAGE,
          scope: { kind: "tenant" },
          slug: nf,
          title: "PTS Sekolah",
        });
        const teacher = yield* roomsOf(fixture, "teacher", schoolExam.id).pipe(
          Effect.flip
        );
        const student = yield* roomsOf(fixture, "student", schoolExam.id).pipe(
          Effect.flip
        );
        expect([teacher, student]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
      })
  );

  it.effect(
    "shows the Deputy the rooms and the exam of a unit, and refuses the Principal, who holds a grant in another unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
          room: "Lab 2",
        });
        const page = yield* roomsOf(fixture, "deputy", examId);
        expect(Arr.map(page.page, (row) => row.id)).toEqual([made.id]);
        expect(
          yield* fixture.as("deputy").query(exam, { examId, slug: nf })
        ).toMatchObject({ id: examId, title: "PTS" });
        const principal = yield* roomsOf(fixture, "principal", examId).pipe(
          Effect.flip
        );
        expect(principal).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "hides a room in a unit the Deputy's grant does not cover, and shows every room to the admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const own = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
          room: "Lab 2",
        });
        const elsewhere = yield* scheduleSitting(fixture, {
          actor: "admin",
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.sma },
          opensAt: LATER,
          room: "Lab 9",
        });
        // The teacher who wrote the exam sees every room of it through the exam author's
        // relation, so the caller here is the Deputy, who wrote nothing and holds one unit.
        const deputy = yield* roomsOf(fixture, "deputy", examId);
        expect(Arr.map(deputy.page, (row) => row.id)).toEqual([own.id]);
        const admin = yield* roomsOf(fixture, "admin", examId);
        expect(Arr.map(admin.page, (row) => row.id)).toEqual([
          own.id,
          elsewhere.id,
        ]);
      })
  );
});
