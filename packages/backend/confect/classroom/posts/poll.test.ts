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
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const { list, publish, remove, vote, votes } = refs.public.classroom.posts;

/** A class with a teacher's poll, one choice or several by `multiple`, and a plain announcement. */
const polled = (multiple: boolean) =>
  Effect.gen(function* () {
    const fixture = yield* keyedFixture;
    const term = yield* period(fixture, fixture.units.smp);
    const forum = yield* forumClass(fixture, term.id, "X-1");
    const scope = { classId: forum.classId, slug: nf };
    const teacher = fixture.as("teacher");
    const post = yield* teacher.mutation(publish, {
      ...scope,
      clientKey: "poll-on-home",
      email: false,
      poll: {
        multiple,
        options: ["Senin", "Selasa", "Rabu"],
        question: "Ulangan hari apa?",
      },
      text: "Ulangan hari apa?",
    });
    const plain = yield* teacher.mutation(publish, {
      ...scope,
      clientKey: "plain-on-home",
      email: false,
      poll: null,
      text: "Selamat pagi",
    });
    return { fixture, forum, plain, post, scope, teacher, term };
  });

describe("classroom/posts polls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "seals a poll, shows it to the class, and keeps each reader's vote apart from the post",
    () =>
      Effect.gen(function* () {
        const { fixture, post, scope } = yield* polled(false);
        const student = fixture.as("student");
        const { page } = yield* student.query(list, { ...firstPage, ...scope });
        expect(
          Arr.findFirst(page, (found) => found.id === post.id)
        ).toMatchObject({
          value: {
            poll: {
              multiple: false,
              options: ["Senin", "Selasa", "Rabu"],
              question: "Ulangan hari apa?",
            },
          },
        });
        expect(
          encodeJsonText(
            yield* fixture.run(
              Effect.flatMap(DatabaseReader, (reader) =>
                reader.table("classroomPosts").index("by_creation_time").take(5)
              )
            )
          )
        ).not.toContain("Selasa");

        const ballot = { ...scope, postId: post.id };
        const read = { ...scope, postIds: [post.id] };
        expect(yield* student.query(votes, read)).toEqual([]);
        yield* student.mutation(vote, { ...ballot, options: [1] });
        yield* fixture
          .as("teacher")
          .mutation(vote, { ...ballot, options: [1] });
        expect(yield* student.query(votes, read)).toEqual([
          {
            postId: post.id,
            votes: [{ count: 2, mine: true, option: 1 }],
          },
        ]);

        // A new choice replaces the old one, and no choice takes the vote back.
        yield* student.mutation(vote, { ...ballot, options: [2] });
        expect(yield* student.query(votes, read)).toMatchObject([
          {
            votes: [
              { count: 1, mine: false, option: 1 },
              { count: 1, mine: true, option: 2 },
            ],
          },
        ]);
        yield* student.mutation(vote, { ...ballot, options: [] });
        expect(yield* student.query(votes, read)).toMatchObject([
          { votes: [{ count: 1, mine: false, option: 1 }] },
        ]);
      })
  );

  it.effect("takes several choices only in a poll of several", () =>
    Effect.gen(function* () {
      const { fixture, post, scope } = yield* polled(true);
      const student = fixture.as("student");
      const ballot = { ...scope, postId: post.id };
      yield* student.mutation(vote, { ...ballot, options: [0, 2] });
      expect(
        yield* student.query(votes, { ...scope, postIds: [post.id] })
      ).toMatchObject([{ votes: [{ option: 0 }, { option: 2 }] }]);
      expect(
        yield* student
          .mutation(vote, { ...ballot, options: [3] })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "VoteRefused" });
    })
  );

  it.effect(
    "refuses a second choice in a poll of one, a post with no poll, a leader, and another class",
    () =>
      Effect.gen(function* () {
        const { fixture, plain, post, scope, teacher, term } =
          yield* polled(false);
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const refusals = yield* Effect.all([
          teacher
            .mutation(vote, { ...scope, options: [0, 1], postId: post.id })
            .pipe(Effect.flip),
          teacher
            .mutation(vote, { ...scope, options: [0], postId: plain.id })
            .pipe(Effect.flip),
          teacher
            .mutation(vote, {
              classId: other.classId,
              options: [0],
              postId: post.id,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "VoteRefused" },
          denied("resource"),
          denied("resource"),
        ]);
        expect(
          yield* teacher.query(votes, {
            classId: other.classId,
            postIds: [post.id],
            slug: nf,
          })
        ).toEqual([]);
      })
  );

  it.effect("deletes a poll's votes with its announcement", () =>
    Effect.gen(function* () {
      const { fixture, post, scope, teacher } = yield* polled(false);
      yield* fixture
        .as("student")
        .mutation(vote, { ...scope, options: [0], postId: post.id });
      yield* teacher.mutation(remove, { ...scope, postId: post.id });
      expect(
        yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomPostVotes").index("by_creation_time").take(5)
          )
        )
      ).toHaveLength(0);
    })
  );
});
