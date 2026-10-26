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
import { slugOf, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { page, send } = refs.public.classroom.forum.messages;
const { open, reply } = refs.public.classroom.forum.threads;
const people = refs.public.classroom.forum.people;
const inbox = refs.public.notifications.inbox;

/** The rows of the inbox of the fixture account `account`, newest first. */
const inboxOf = (
  fixture: Effect.Success<typeof keyedFixture>,
  account: "student" | "teacher"
) =>
  Effect.map(
    fixture.as(account).query(inbox.list, firstPage),
    (listed) => listed.page
  );

describe("classroom/forum mentions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "writes one inbox row for each mentioned member, never for the sender, and shows the mention by name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const teacher = fixture.as("teacher");
        const listed = yield* teacher.query(people.list, {
          classId: forum.classId,
          slug: nf,
        });
        expect(listed).toEqual([
          { id: fixture.people.student.personId, name: "Student" },
        ]);
        const sent = yield* teacher.mutation(send, {
          ...forum,
          clientKey: "mention-message",
          mentions: [
            { _tag: "person", id: fixture.people.student.personId },
            { _tag: "person", id: fixture.people.student.personId },
            { _tag: "person", id: fixture.people.teacher.personId },
          ],
          slug: nf,
          text: "@Student tolong kumpulkan tugasnya.",
        });
        expect(sent.mentions).toEqual([
          {
            _tag: "person",
            id: fixture.people.student.personId,
            name: "Student",
          },
          {
            _tag: "person",
            id: fixture.people.teacher.personId,
            name: "Teacher",
          },
        ]);
        const rows = yield* inboxOf(fixture, "student");
        expect(rows).toEqual([
          expect.objectContaining({
            changeType: "forum.mentioned",
            detail: {
              actor: "Teacher",
              channelId: forum.channelId,
              className: "Fisika X-1",
              classSlug: "fisika-x-1",
              discussion: null,
              messageId: sent.id,
            },
            subject: { id: forum.classId, kind: "class" },
          }),
        ]);
        expect(yield* inboxOf(fixture, "teacher")).toEqual([]);

        // A mention in a reply opens its discussion.
        yield* teacher.mutation(open, {
          ...forum,
          clientKey: "mention-discussion",
          mentions: [],
          slug: nf,
          text: "Pembuka",
          title: "Diskusi",
        });
        vi.setSystemTime(TENANCY_NOW + 1000);
        const answered = yield* teacher.mutation(reply, {
          classId: forum.classId,
          clientKey: "mention-reply",
          mentions: [{ _tag: "person", id: fixture.people.student.personId }],
          number: 1,
          slug: nf,
          text: "@Student lihat ini.",
        });
        const after = yield* inboxOf(fixture, "student");
        expect(after[0]?.detail).toMatchObject({
          discussion: 1,
          messageId: answered.id,
        });

        // A member who no longer reads the class sees the row without its detail.
        yield* fixture.run(
          Effect.gen(function* () {
            const grant = yield* (yield* DatabaseReader)
              .table("tenantGrants")
              .get(fixture.people.student.grantId);
            yield* (yield* DatabaseWriter)
              .table("tenantGrants")
              .patch(grant._id, { status: "revoked" });
          })
        );
        const revoked = yield* inboxOf(fixture, "student");
        expect(Arr.map(revoked, (row) => row.detail)).toEqual([null, null]);
      })
  );

  it.effect(
    "refuses a mention of someone outside the class, of another school, or of everyone by a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        const refusals = yield* Effect.all([
          fixture
            .as("teacher")
            .mutation(send, {
              ...forum,
              clientKey: "outside-mention",
              mentions: [{ _tag: "person", id: fixture.people.admin.personId }],
              slug: nf,
              text: "@Admin",
            })
            .pipe(Effect.flip),
          fixture
            .as("teacher")
            .mutation(send, {
              ...forum,
              clientKey: "foreign-mention",
              mentions: [
                { _tag: "person", id: fixture.people.otherOwner.personId },
              ],
              slug: nf,
              text: "@Other",
            })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .mutation(send, {
              ...forum,
              clientKey: "student-everyone",
              mentions: [{ _tag: "everyone" }],
              slug: nf,
              text: "@everyone",
            })
            .pipe(Effect.flip),
        ]);
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual([
          "MentionRefused",
          "MentionRefused",
          "MentionRefused",
        ]);
        const channel = yield* fixture
          .as("teacher")
          .query(page, { ...firstPage, ...forum, slug: nf });
        expect(channel.page).toEqual([]);
      })
  );

  it.effect(
    "writes the rows of a mention of everyone in a fan-out, once for a member it also names",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-3");
        yield* fixture.as("teacher").mutation(send, {
          ...forum,
          clientKey: "everyone-message",
          mentions: [
            { _tag: "everyone" },
            { _tag: "person", id: fixture.people.student.personId },
          ],
          slug: nf,
          text: "@everyone besok libur, @Student juga.",
        });
        yield* fixture.finishScheduled();
        const rows = yield* inboxOf(fixture, "student");
        expect(Arr.map(rows, (row) => row.changeType)).toEqual([
          "forum.mentioned",
        ]);
        expect(yield* inboxOf(fixture, "teacher")).toEqual([]);
        const other = yield* fixture
          .as("otherOwner")
          .query(people.list, { classId: forum.classId, slug: slugOf("other") })
          .pipe(Effect.flip);
        expect(other._tag).toBe("AccessDenied");
      })
  );
});
