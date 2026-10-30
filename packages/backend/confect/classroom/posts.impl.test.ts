import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { journal, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const { edit, list, publish, remove } = refs.public.classroom.posts;

describe("classroom/posts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "lets a subject teacher post sealed announcements that the class and its leaders read newest first, each a published change",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const teacher = fixture.as("teacher");
        const first = yield* teacher.mutation(publish, {
          classId: forum.classId,
          clientKey: "first-post",
          email: false,
          slug: nf,
          text: "Ulangan bab 2 hari Senin.",
        });
        vi.setSystemTime(TENANCY_NOW + 1000);
        const second = yield* teacher.mutation(publish, {
          classId: forum.classId,
          clientKey: "second-post",
          email: true,
          slug: nf,
          text: "Bawa kalkulator.",
        });
        const retried = yield* teacher.mutation(publish, {
          classId: forum.classId,
          clientKey: "first-post",
          email: false,
          slug: nf,
          text: "Ulangan bab 2 hari Senin.",
        });
        expect(retried).toEqual(first);
        expect(second).toMatchObject({ email: true, mine: true });
        const forStudent = yield* fixture
          .as("student")
          .query(list, { ...firstPage, classId: forum.classId, slug: nf });
        expect(Arr.map(forStudent.page, (post) => post.text)).toEqual([
          "Bawa kalkulator.",
          "Ulangan bab 2 hari Senin.",
        ]);
        expect(Arr.map(forStudent.page, (post) => post.mine)).toEqual([
          false,
          false,
        ]);
        const forAdmin = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, classId: forum.classId, slug: nf });
        expect(forAdmin.page).toHaveLength(2);
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomPosts").get(first.id)
          )
        );
        expect(encodeJsonText(stored.sealedText)).not.toContain("Ulangan");
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(entries, (entry) =>
            encodeJsonText(entry).includes("announcement.posted")
          )
        ).toHaveLength(2);
      })
  );

  it.effect(
    "lets the author edit and remove an announcement, and refuses everyone else",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        const other = yield* forumClass(fixture, term.id, "X-3", false);
        const teacher = fixture.as("teacher");
        const posted = yield* teacher.mutation(publish, {
          classId: forum.classId,
          clientKey: "edited-post",
          email: false,
          slug: nf,
          text: "Ulangan hari Senin.",
        });
        vi.setSystemTime(TENANCY_NOW + 5000);
        const edited = yield* teacher.mutation(edit, {
          classId: forum.classId,
          postId: posted.id,
          slug: nf,
          text: "Ulangan hari Selasa.",
        });
        expect(edited).toMatchObject({
          editedAt: TENANCY_NOW + 5000,
          text: "Ulangan hari Selasa.",
        });
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(publish, {
              classId: forum.classId,
              clientKey: "student-post",
              email: false,
              slug: nf,
              text: "Bukan guru",
            })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(edit, {
              classId: forum.classId,
              postId: posted.id,
              slug: nf,
              text: "Admin",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(edit, {
              classId: other.classId,
              postId: posted.id,
              slug: nf,
              text: "Kelas lain",
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("resource"),
        ]);
        const elsewhere = yield* teacher.mutation(publish, {
          classId: other.classId,
          clientKey: "edited-post",
          email: false,
          slug: nf,
          text: "Kelas lain",
        });
        expect(elsewhere.id).not.toBe(posted.id);
        expect(
          yield* teacher.mutation(remove, {
            classId: forum.classId,
            postId: posted.id,
            slug: nf,
          })
        ).toBeNull();
        const gone = yield* teacher
          .mutation(remove, {
            classId: forum.classId,
            postId: posted.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(gone).toMatchObject(denied("resource"));
        const listed = yield* teacher.query(list, {
          ...firstPage,
          classId: forum.classId,
          slug: nf,
        });
        expect(listed.page).toEqual([]);
      })
  );
});
