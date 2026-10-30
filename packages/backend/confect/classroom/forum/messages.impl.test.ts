import type { GenericId } from "@confect/core";
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

const { edit, hide, page, send } = refs.public.classroom.forum.messages;

/** The stored row of a message. */
const messageRow = (messageId: GenericId.GenericId<"classroomMessages">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("classroomMessages").get(messageId).pipe(Effect.orDie)
  );

describe("classroom/forum messages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "sends a sealed message that the class reads newest first, and a retry of its key posts nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const student = fixture.as("student");
        const first = yield* student.mutation(send, {
          ...forum,
          clientKey: "first-message",
          mentions: [],
          slug: nf,
          text: "Kapan tugasnya dikumpulkan?",
        });
        vi.setSystemTime(TENANCY_NOW + 1000);
        const second = yield* fixture.as("teacher").mutation(send, {
          ...forum,
          clientKey: "second-message",
          mentions: [],
          slug: nf,
          text: "Jumat, sebelum jam 12.",
        });
        const retried = yield* student.mutation(send, {
          ...forum,
          clientKey: "first-message",
          mentions: [],
          slug: nf,
          text: "Kapan tugasnya dikumpulkan?",
        });
        expect(retried).toEqual(first);
        expect(first).toMatchObject({
          editedAt: null,
          mine: true,
          text: "Kapan tugasnya dikumpulkan?",
        });
        const read = yield* student.query(page, {
          ...firstPage,
          ...forum,
          slug: nf,
        });
        expect(Arr.map(read.page, (message) => message.id)).toEqual([
          second.id,
          first.id,
        ]);
        expect(Arr.map(read.page, (message) => message.mine)).toEqual([
          false,
          true,
        ]);
        const stored = yield* fixture.run(messageRow(first.id));
        expect(encodeJsonText(stored.sealedText)).not.toContain("tugasnya");
      })
  );

  it.effect(
    "lets the author edit a message, and refuses another member's edit and a reuse of the author's key",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        const sent = yield* fixture.as("student").mutation(send, {
          ...forum,
          clientKey: "student-key",
          mentions: [],
          slug: nf,
          text: "Halo",
        });
        vi.setSystemTime(TENANCY_NOW + 5000);
        const edited = yield* fixture.as("student").mutation(edit, {
          classId: forum.classId,
          messageId: sent.id,
          slug: nf,
          text: "Halo semua",
        });
        expect(edited).toMatchObject({
          editedAt: TENANCY_NOW + 5000,
          id: sent.id,
          text: "Halo semua",
        });
        const teacher = fixture.as("teacher");
        const refusals = yield* Effect.all([
          teacher
            .mutation(edit, {
              classId: forum.classId,
              messageId: sent.id,
              slug: nf,
              text: "Bukan punyaku",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(send, {
              ...forum,
              clientKey: "student-key",
              mentions: [],
              slug: nf,
              text: "Kunci orang lain",
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );

  it.effect(
    "lets a subject teacher hide a message for good, with a journal entry and no text, and refuses a student's hide",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-3");
        const student = fixture.as("student");
        const sent = yield* student.mutation(send, {
          ...forum,
          clientKey: "hidden-message",
          mentions: [],
          slug: nf,
          text: "Pesan yang disembunyikan",
        });
        const refused = yield* student
          .mutation(hide, {
            classId: forum.classId,
            messageId: sent.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
        const teacher = fixture.as("teacher");
        const hidden = yield* teacher.mutation(hide, {
          classId: forum.classId,
          messageId: sent.id,
          slug: nf,
        });
        const again = yield* teacher.mutation(hide, {
          classId: forum.classId,
          messageId: sent.id,
          slug: nf,
        });
        expect(hidden).toMatchObject({ id: sent.id, text: null });
        expect(again).toEqual(hidden);
        expect((yield* fixture.run(messageRow(sent.id))).sealedText).toBeNull();
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(entries, (entry) =>
            encodeJsonText(entry).includes("message.hidden")
          )
        ).toHaveLength(1);
        const edited = yield* student
          .mutation(edit, {
            classId: forum.classId,
            messageId: sent.id,
            slug: nf,
            text: "Ditulis lagi",
          })
          .pipe(Effect.flip);
        expect(edited._tag).toBe("MessageHidden");
      })
  );

  it.effect(
    "lets a school Admin read a channel and refuses the Admin's message, as the school's leaders write nothing in a forum",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "XII-1");
        yield* fixture.as("student").mutation(send, {
          ...forum,
          clientKey: "student-post",
          mentions: [],
          slug: nf,
          text: "Selamat pagi",
        });
        const admin = fixture.as("admin");
        const read = yield* admin.query(page, {
          ...firstPage,
          ...forum,
          slug: nf,
        });
        expect(Arr.map(read.page, (message) => message.text)).toEqual([
          "Selamat pagi",
        ]);
        const refused = yield* admin
          .mutation(send, {
            ...forum,
            clientKey: "admin-post",
            mentions: [],
            slug: nf,
            text: "Pengumuman",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses a channel and a message of another class as missing objects",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const own = yield* forumClass(fixture, term.id, "XI-1");
        const other = yield* forumClass(fixture, term.id, "XI-2", false);
        const teacher = fixture.as("teacher");
        const elsewhere = yield* teacher.mutation(send, {
          ...other,
          clientKey: "other-class",
          mentions: [],
          slug: nf,
          text: "Kelas lain",
        });
        const refusals = yield* Effect.all([
          teacher
            .query(page, {
              ...firstPage,
              channelId: other.channelId,
              classId: own.classId,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(send, {
              channelId: other.channelId,
              classId: own.classId,
              clientKey: "wrong-channel",
              mentions: [],
              slug: nf,
              text: "Salah kanal",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(edit, {
              classId: own.classId,
              messageId: elsewhere.id,
              slug: nf,
              text: "Salah kelas",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(hide, {
              classId: own.classId,
              messageId: elsewhere.id,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject(Arr.makeBy(4, () => denied("resource")));
      })
  );
});
