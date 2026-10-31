import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  denied,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { png } from "@repo/backend/test/exams";
import { storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { get, reply, start } = refs.public.classroom.forum.threads;
const { hide, send } = refs.public.classroom.forum.messages;
const { register } = refs.public.classroom.forum.files;
const { setPolicy } = refs.public.tenancy.settings;

describe("classroom/forum start", () => {
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
});
