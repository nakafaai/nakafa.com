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
import { png } from "@repo/backend/test/exams";
import { storeFile } from "@repo/backend/test/logo";
import { slugOf, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const { get, list, open, rename, replies, reply, start } =
  refs.public.classroom.forum.threads;
const { hide, page, send } = refs.public.classroom.forum.messages;
const { register } = refs.public.classroom.forum.files;
const { setPolicy } = refs.public.tenancy.settings;

describe("classroom/forum threads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "starts a thread from any message of a channel, titled by the message's first line, and answers the same thread on a repeat",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-8");
        const student = fixture.as("student");
        const message = yield* student.mutation(send, {
          ...forum,
          attachments: [],
          clientKey: "plain-question",
          mentions: [],
          poll: null,
          slug: nf,
          text: "Kapan ulangan?\nSaya belum belajar.",
        });
        const args = {
          classId: forum.classId,
          messageId: message.id,
          slug: nf,
        };
        const first = yield* fixture.as("teacher").mutation(start, args);
        const repeat = yield* student.mutation(start, args);
        expect(repeat).toEqual(first);
        const thread = yield* student.query(get, {
          classId: forum.classId,
          number: first.number,
          slug: nf,
        });
        expect(thread.discussion.title).toBe("Kapan ulangan?");
        expect(thread.opening.id).toBe(message.id);
      })
  );

  it.effect(
    "titles a thread from a poll, and starts none from a reply or a hidden message",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-7");
        const teacher = fixture.as("teacher");
        const poll = yield* teacher.mutation(send, {
          ...forum,
          attachments: [],
          clientKey: "poll-question",
          mentions: [],
          poll: {
            multiple: false,
            options: ["Ya", "Tidak"],
            question: "Setuju?",
          },
          slug: nf,
          text: "",
        });
        const args = { classId: forum.classId, slug: nf };
        const started = yield* teacher.mutation(start, {
          ...args,
          messageId: poll.id,
        });
        const thread = yield* teacher.query(get, {
          ...args,
          number: started.number,
        });
        expect(thread.discussion.title).toBe("Setuju?");
        const answer = yield* teacher.mutation(reply, {
          ...args,
          attachments: [],
          clientKey: "answer-reply",
          mentions: [],
          number: started.number,
          text: "Setuju.",
        });
        const hidden = yield* teacher.mutation(send, {
          ...forum,
          attachments: [],
          clientKey: "to-be-hidden",
          mentions: [],
          poll: null,
          slug: nf,
          text: "Salah kirim",
        });
        yield* teacher.mutation(hide, { ...args, messageId: hidden.id });
        const failures = yield* Effect.all([
          teacher
            .mutation(start, { ...args, messageId: answer.id })
            .pipe(Effect.flip),
          teacher
            .mutation(start, { ...args, messageId: hidden.id })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          denied("resource"),
          { _tag: "MessageHidden" },
        ]);
      })
  );

  it.effect(
    "titles a thread from a photo without text, and keeps a file in a reply and an empty reply out",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-5");
        const teacher = fixture.as("teacher");
        const upload = (name: string) =>
          Effect.gen(function* () {
            return yield* teacher.action(register, {
              classId: forum.classId,
              height: 1,
              name,
              slug: nf,
              storageId: yield* storeFile(fixture.convex, png()),
              thumbnailId: null,
              width: 1,
            });
          });
        const photo = yield* upload("papan.png");
        const sent = yield* teacher.mutation(send, {
          ...forum,
          attachments: [photo.id],
          clientKey: "photo-alone",
          mentions: [],
          poll: null,
          slug: nf,
          text: "",
        });
        const args = { classId: forum.classId, slug: nf };
        const { number } = yield* teacher.mutation(start, {
          ...args,
          messageId: sent.id,
        });
        const thread = yield* teacher.query(get, { ...args, number });
        expect(thread.discussion.title).toBe("papan.png");
        const second = yield* upload("jawaban.png");
        const answer = yield* teacher.mutation(reply, {
          ...args,
          attachments: [second.id],
          clientKey: "photo-answer",
          mentions: [],
          number,
          text: "",
        });
        expect(answer.attachments[0]?.name).toBe("jawaban.png");
        const refused = yield* teacher
          .mutation(reply, {
            ...args,
            attachments: [],
            clientKey: "empty-answer",
            mentions: [],
            number,
            text: "",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "MessageEmpty" });
      })
  );

  it.effect(
    "keeps a student from starting a thread while the school keeps discussions to teachers",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-6");
        yield* fixture.as("owner").mutation(setPolicy, {
          policy: { key: "studentThreads", value: false },
          slug: nf,
        });
        const message = yield* fixture.as("student").mutation(send, {
          ...forum,
          attachments: [],
          clientKey: "closed-question",
          mentions: [],
          poll: null,
          slug: nf,
          text: "Boleh tanya?",
        });
        const refused = yield* fixture
          .as("student")
          .mutation(start, {
            classId: forum.classId,
            messageId: message.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "DiscussionsClosed" });
      })
  );

  it.effect(
    "lists a class's discussions, the newest first, each with its channel and unread for whoever has not read its newest reply",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-9");
        const teacher = fixture.as("teacher");
        for (const [clientKey, title] of [
          ["older-discussion", "Bab 1"],
          ["newer-discussion", "Bab 2"],
        ] as const) {
          yield* teacher.mutation(open, {
            ...forum,
            clientKey,
            mentions: [],
            slug: nf,
            text: "Mulai di sini.",
            title,
          });
        }
        yield* teacher.mutation(reply, {
          attachments: [],
          classId: forum.classId,
          clientKey: "first-reply",
          mentions: [],
          number: 1,
          slug: nf,
          text: "Balasan pertama.",
        });
        const listed = yield* fixture.as("student").query(list, {
          ...firstPage,
          classId: forum.classId,
          slug: nf,
        });
        expect(
          Arr.map(listed.page, (row) => [
            row.channelId,
            row.discussion.title,
            row.discussion.replies,
            row.discussion.unread,
          ])
        ).toEqual([
          [forum.channelId, "Bab 2", 0, false],
          [forum.channelId, "Bab 1", 1, true],
        ]);
      })
  );

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
          mentions: [],
          slug: nf,
          text: "Tuliskan contohnya di sini.",
          title: "Kenapa gaya gesek berlawanan arah gerak?",
        });
        vi.setSystemTime(TENANCY_NOW + 1000);
        const second = yield* teacher.mutation(open, {
          ...forum,
          clientKey: "second-discussion",
          mentions: [],
          slug: nf,
          text: "Satu pertanyaan per balasan.",
          title: "Persiapan ulangan",
        });
        const retried = yield* teacher.mutation(open, {
          ...forum,
          clientKey: "first-discussion",
          mentions: [],
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
          mentions: [],
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
          mentions: [],
          slug: nf,
          text: "Pertanyaan pembuka",
          title: "Diskusi bab 2",
        });
        vi.setSystemTime(TENANCY_NOW + 2000);
        const answer = yield* student.mutation(reply, {
          attachments: [],
          classId: forum.classId,
          clientKey: "student-reply",
          mentions: [],
          number: 1,
          slug: nf,
          text: "Karena gaya gesek melawan gerak.",
        });
        vi.setSystemTime(TENANCY_NOW + 3000);
        const second = yield* teacher.mutation(reply, {
          attachments: [],
          classId: forum.classId,
          clientKey: "teacher-reply",
          mentions: [],
          number: 1,
          slug: nf,
          text: "Betul.",
        });
        const retried = yield* student.mutation(reply, {
          attachments: [],
          classId: forum.classId,
          clientKey: "student-reply",
          mentions: [],
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
          attachments: [],
          poll: null,
          ...forum,
          clientKey: "plain-message",
          mentions: [],
          slug: nf,
          text: "Pesan biasa",
        });
        yield* teacher.mutation(open, {
          ...forum,
          clientKey: "keyed-discussion",
          mentions: [],
          slug: nf,
          text: "Pembuka",
          title: "Diskusi",
        });
        yield* teacher.mutation(reply, {
          attachments: [],
          classId: forum.classId,
          clientKey: "teacher-key",
          mentions: [],
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
              mentions: [],
              slug: nf,
              text: "Pembuka",
              title: "Judul",
            })
            .pipe(Effect.flip),
          student
            .mutation(reply, {
              attachments: [],
              classId: forum.classId,
              clientKey: "teacher-key",
              mentions: [],
              number: 1,
              slug: nf,
              text: "Kunci orang lain",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(reply, {
              attachments: [],
              classId: forum.classId,
              clientKey: plain.clientKey,
              mentions: [],
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
          mentions: [],
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
              attachments: [],
              classId: forum.classId,
              clientKey: "missing-discussion",
              mentions: [],
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
            attachments: [],
            classId: other.classId,
            clientKey: "admin-reply",
            mentions: [],
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

  it.effect(
    "lets the opener and a subject teacher rename a discussion, sealed anew, and refuses another student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-7");
        const classArgs = { classId: forum.classId, number: 1, slug: nf };
        yield* fixture.as("admin").mutation(setPolicy, {
          policy: { key: "studentThreads", value: true },
          slug: nf,
        });
        yield* fixture.as("student").mutation(open, {
          ...forum,
          clientKey: "student-discussion",
          mentions: [],
          slug: nf,
          text: "Bagaimana caranya?",
          title: "Judul salah ketik",
        });
        expect(
          yield* fixture
            .as("student")
            .mutation(rename, { ...classArgs, title: "Judul benar" })
        ).toBeNull();
        const opened = yield* fixture.as("student").query(get, classArgs);
        expect(opened.discussion.title).toBe("Judul benar");
        yield* fixture
          .as("teacher")
          .mutation(rename, { ...classArgs, title: "Judul dari guru" });
        const stored = yield* fixture.run(
          Effect.gen(function* () {
            return yield* (yield* DatabaseReader)
              .table("classroomThreads")
              .index("by_classId_and_number", (query) =>
                query.eq("classId", forum.classId).eq("number", 1)
              )
              .first();
          })
        );
        expect(encodeJsonText(stored)).not.toContain("Judul");
        const channel = yield* fixture.as("teacher").query(page, {
          ...firstPage,
          channelId: forum.channelId,
          classId: forum.classId,
          slug: nf,
        });
        expect(channel.page[0]?.discussion?.title).toBe("Judul dari guru");
      })
  );

  it.effect(
    "meets a member who neither opened it nor teaches as a missing object",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-8");
        yield* fixture.as("teacher").mutation(open, {
          ...forum,
          clientKey: "teacher-discussion",
          mentions: [],
          slug: nf,
          text: "Diskusikan.",
          title: "Diskusi guru",
        });
        const refused = yield* fixture
          .as("student")
          .mutation(rename, {
            classId: forum.classId,
            number: 1,
            slug: nf,
            title: "Diambil alih",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );
});
