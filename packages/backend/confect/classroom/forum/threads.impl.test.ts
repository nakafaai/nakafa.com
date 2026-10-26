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
import { slugOf, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const { get, open, replies, reply } = refs.public.classroom.forum.threads;
const { page, send } = refs.public.classroom.forum.messages;
const { setPolicy } = refs.public.tenancy.settings;

describe("classroom/forum threads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "numbers the discussions of a class in order, seals the title, and shows each in its channel through its opening message",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const teacher = fixture.as("teacher");
        const first = yield* teacher.mutation(open, {
          ...forum,
          clientKey: "first-discussion",
          slug: nf,
          text: "Tuliskan contohnya di sini.",
          title: "Kenapa gaya gesek berlawanan arah gerak?",
        });
        vi.setSystemTime(TENANCY_NOW + 1000);
        const second = yield* teacher.mutation(open, {
          ...forum,
          clientKey: "second-discussion",
          slug: nf,
          text: "Satu pertanyaan per balasan.",
          title: "Persiapan ulangan",
        });
        const retried = yield* teacher.mutation(open, {
          ...forum,
          clientKey: "first-discussion",
          slug: nf,
          text: "Tuliskan contohnya di sini.",
          title: "Kenapa gaya gesek berlawanan arah gerak?",
        });
        expect(retried).toEqual(first);
        expect(first).toMatchObject({
          channelId: forum.channelId,
          discussion: {
            lastReplyAt: null,
            number: 1,
            replies: 0,
            title: "Kenapa gaya gesek berlawanan arah gerak?",
            unread: false,
          },
          opening: { mine: true, text: "Tuliskan contohnya di sini." },
        });
        expect(second.discussion.number).toBe(2);
        const found = yield* fixture
          .as("student")
          .query(get, { classId: forum.classId, number: 2, slug: nf });
        expect(found).toMatchObject({
          discussion: { number: 2, title: "Persiapan ulangan" },
          opening: { mine: false, text: "Satu pertanyaan per balasan." },
        });
        const channel = yield* fixture
          .as("student")
          .query(page, { ...firstPage, ...forum, slug: nf });
        expect(
          Arr.map(channel.page, (message) => message.discussion?.number)
        ).toEqual([2, 1]);
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomThreads").get(first.id)
          )
        );
        expect(encodeJsonText(stored.sealedTitle)).not.toContain("gesek");
      })
  );

  it.effect(
    "keeps discussions to teachers until the school lets students open them",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        const student = fixture.as("student");
        const args = {
          ...forum,
          clientKey: "student-discussion",
          slug: nf,
          text: "Ada yang mau belajar bersama?",
          title: "Belajar bersama",
        };
        const closed = yield* student.mutation(open, args).pipe(Effect.flip);
        expect(closed._tag).toBe("DiscussionsClosed");
        yield* fixture.as("owner").mutation(setPolicy, {
          policy: { key: "studentThreads", value: true },
          slug: nf,
        });
        const opened = yield* student.mutation(open, args);
        expect(opened.discussion).toMatchObject({
          number: 1,
          title: "Belajar bersama",
        });
      })
  );

  it.effect(
    "counts the replies of a discussion, keeps them out of the channel, and marks the discussion unread for whoever has not read the newest reply",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-3");
        const teacher = fixture.as("teacher");
        const student = fixture.as("student");
        yield* teacher.mutation(open, {
          ...forum,
          clientKey: "replied-discussion",
          slug: nf,
          text: "Pertanyaan pembuka",
          title: "Diskusi bab 2",
        });
        vi.setSystemTime(TENANCY_NOW + 2000);
        const answer = yield* student.mutation(reply, {
          classId: forum.classId,
          clientKey: "student-reply",
          number: 1,
          slug: nf,
          text: "Karena gaya gesek melawan gerak.",
        });
        vi.setSystemTime(TENANCY_NOW + 3000);
        const second = yield* teacher.mutation(reply, {
          classId: forum.classId,
          clientKey: "teacher-reply",
          number: 1,
          slug: nf,
          text: "Betul.",
        });
        const retried = yield* student.mutation(reply, {
          classId: forum.classId,
          clientKey: "student-reply",
          number: 1,
          slug: nf,
          text: "Karena gaya gesek melawan gerak.",
        });
        expect(retried).toEqual(answer);
        const listed = yield* student.query(replies, {
          ...firstPage,
          classId: forum.classId,
          number: 1,
          slug: nf,
        });
        expect(Arr.map(listed.page, (message) => message.id)).toEqual([
          second.id,
          answer.id,
        ]);
        const forStudent = yield* student.query(get, {
          classId: forum.classId,
          number: 1,
          slug: nf,
        });
        expect(forStudent.discussion).toMatchObject({
          lastReplyAt: TENANCY_NOW + 3000,
          replies: 2,
          unread: true,
        });
        const forTeacher = yield* teacher.query(get, {
          classId: forum.classId,
          number: 1,
          slug: nf,
        });
        expect(forTeacher.discussion.unread).toBe(false);
        // A school leader who never opened the discussion reads it unread.
        const forAdmin = yield* fixture.as("admin").query(get, {
          classId: forum.classId,
          number: 1,
          slug: nf,
        });
        expect(forAdmin.discussion.unread).toBe(true);
        const channel = yield* student.query(page, {
          ...firstPage,
          ...forum,
          slug: nf,
        });
        expect(Arr.map(channel.page, (message) => message.text)).toEqual([
          "Pertanyaan pembuka",
        ]);
      })
  );

  it.effect(
    "refuses a client key that belongs to another message or another member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-4");
        const teacher = fixture.as("teacher");
        const plain = yield* teacher.mutation(send, {
          ...forum,
          clientKey: "plain-message",
          slug: nf,
          text: "Pesan biasa",
        });
        yield* teacher.mutation(open, {
          ...forum,
          clientKey: "keyed-discussion",
          slug: nf,
          text: "Pembuka",
          title: "Diskusi",
        });
        yield* teacher.mutation(reply, {
          classId: forum.classId,
          clientKey: "teacher-key",
          number: 1,
          slug: nf,
          text: "Balasan guru",
        });
        const student = fixture.as("student");
        const refusals = yield* Effect.all([
          teacher
            .mutation(open, {
              ...forum,
              clientKey: plain.clientKey,
              slug: nf,
              text: "Pembuka",
              title: "Judul",
            })
            .pipe(Effect.flip),
          student
            .mutation(reply, {
              classId: forum.classId,
              clientKey: "teacher-key",
              number: 1,
              slug: nf,
              text: "Kunci orang lain",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(reply, {
              classId: forum.classId,
              clientKey: plain.clientKey,
              number: 1,
              slug: nf,
              text: "Kunci pesan kanal",
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject(Arr.makeBy(3, () => denied("resource")));
      })
  );

  it.effect(
    "refuses a discussion number the class does not hold, the school's leaders' replies, and a member of another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-5");
        const other = yield* forumClass(fixture, term.id, "X-6", false);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(open, {
          ...other,
          clientKey: "other-discussion",
          slug: nf,
          text: "Kelas lain",
          title: "Diskusi kelas lain",
        });
        const refusals = yield* Effect.all([
          teacher
            .query(get, { classId: forum.classId, number: 1, slug: nf })
            .pipe(Effect.flip),
          teacher
            .query(replies, {
              ...firstPage,
              classId: forum.classId,
              number: 1,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(reply, {
              classId: forum.classId,
              clientKey: "missing-discussion",
              number: 1,
              slug: nf,
              text: "Tidak ada",
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject(Arr.makeBy(3, () => denied("resource")));
        const admin = yield* fixture
          .as("admin")
          .mutation(reply, {
            classId: other.classId,
            clientKey: "admin-reply",
            number: 1,
            slug: nf,
            text: "Pengumuman",
          })
          .pipe(Effect.flip);
        expect(admin).toMatchObject(denied("role"));
        const foreign = yield* Effect.all([
          fixture
            .as("otherOwner")
            .query(get, { classId: other.classId, number: 1, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("otherOwner")
            .query(get, {
              classId: other.classId,
              number: 1,
              slug: slugOf("other"),
            })
            .pipe(Effect.flip),
        ]);
        expect(foreign).toMatchObject([
          { _tag: "NotMember" },
          denied("resource"),
        ]);
      })
  );
});
