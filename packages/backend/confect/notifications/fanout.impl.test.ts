import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const posts = refs.public.classroom.posts;
const inbox = refs.public.notifications.inbox;
const fanout = refs.internal.notifications.fanout;

/** Members of a cohort that no access check admits: Persons placed directly, without a student grant. */
const placeStrangers = (
  fixture: Effect.Success<typeof keyedFixture>,
  classId: GenericId.GenericId<"classes">,
  count: number
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const klass = yield* reader
        .table("classes")
        .get(classId)
        .pipe(Effect.orDie);
      yield* Effect.forEach(Arr.range(1, count), (index) =>
        Effect.gen(function* () {
          const personId = yield* writer.table("tenantPeople").insert({
            account: { state: "unclaimed" },
            kind: "member",
            name: `Tamu ${index}`,
            status: index === 1 ? "suspended" : "active",
            tenantId: klass.tenantId,
          });
          yield* writer.table("tenantCohortMembers").insert({
            cohortId: klass.cohortId,
            periodId: klass.periodId,
            personId,
            tenantId: klass.tenantId,
          });
        })
      );
    })
  );

describe("notifications/fanout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "writes an announcement's row for each member who reads the class, in batches, and none for its author",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        yield* placeStrangers(fixture, forum.classId, 101);
        const posted = yield* fixture.as("teacher").mutation(posts.publish, {
          classId: forum.classId,
          clientKey: "fanout-post",
          email: false,
          slug: nf,
          text: "Besok ulangan.",
        });
        yield* fixture.finishScheduled();
        const rows = yield* fixture.as("student").query(inbox.list, firstPage);
        expect(rows.page).toEqual([
          expect.objectContaining({
            changeType: "announcement.posted",
            detail: {
              actor: "Teacher",
              channelId: null,
              className: "Fisika X-1",
              classSlug: "fisika-x-1",
              discussion: null,
              messageId: null,
              task: null,
            },
          }),
        ]);
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("notifications")
              .index("by_recipientPersonId_and_createdAt", (query) =>
                query.eq("recipientPersonId", fixture.people.teacher.personId)
              )
              .take(5)
          )
        );
        expect(stored).toEqual([]);

        // A removed announcement keeps its row, without its detail, and a late run writes nothing.
        yield* fixture.as("teacher").mutation(posts.remove, {
          classId: forum.classId,
          postId: posted.id,
          slug: nf,
        });
        const removed = yield* fixture
          .as("student")
          .query(inbox.list, firstPage);
        expect(Arr.map(removed.page, (row) => row.detail)).toEqual([null]);
        expect(
          yield* fixture.internal.mutation(fanout.run, {
            cursor: null,
            phase: "students",
            source: { _tag: "post", postId: posted.id },
          })
        ).toBeNull();
      })
  );
});
