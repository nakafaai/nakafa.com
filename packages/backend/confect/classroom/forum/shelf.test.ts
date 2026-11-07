import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { archive, list, open, restore } = refs.public.classroom.forum.threads;
const { setPolicy } = refs.public.tenancy.settings;

describe("classroom/forum shelf", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "archives a discussion out of the class's list into the archived one, restores it, and refuses anyone but its opener and the forum's managers",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-7");
        const student = fixture.as("student");
        const teacher = fixture.as("teacher");
        yield* fixture.as("admin").mutation(setPolicy, {
          policy: { key: "studentThreads", value: true },
          slug: nf,
        });
        yield* student.mutation(open, {
          ...forum,
          clientKey: "student-discussion",
          mentions: [],
          slug: nf,
          text: "Ada yang paham soal nomor 3?",
          title: "Soal nomor 3",
        });
        const args = { classId: forum.classId, number: 1, slug: nf };
        const titles = (archived: boolean) =>
          Effect.map(
            teacher.query(list, { ...firstPage, archived, ...forumArgs }),
            (listed) =>
              Arr.map(listed.page, (row) => [
                row.discussion.title,
                row.archived,
              ])
          );
        const forumArgs = { classId: forum.classId, slug: nf };

        // The opener archives it, and it moves to the archived list.
        expect(yield* student.mutation(archive, args)).toBeNull();
        expect(yield* titles(false)).toEqual([]);
        expect(yield* titles(true)).toEqual([["Soal nomor 3", true]]);

        // Whoever manages the forum restores it.
        expect(yield* teacher.mutation(restore, args)).toBeNull();
        expect(yield* titles(false)).toEqual([["Soal nomor 3", false]]);

        // A member who neither opened it nor manages the forum meets it as missing.
        yield* teacher.mutation(open, {
          ...forum,
          clientKey: "teacher-discussion",
          mentions: [],
          slug: nf,
          text: "Pengumuman kelas.",
          title: "Pengumuman",
        });
        const refused = yield* student
          .mutation(archive, { ...args, number: 2 })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );
});
