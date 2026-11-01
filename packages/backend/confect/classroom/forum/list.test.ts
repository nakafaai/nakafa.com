import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { Effect } from "effect";

const { list } = refs.public.classroom.forum.channels;
const { hide, send } = refs.public.classroom.forum.messages;

/** The general channel of every class, as the list shows it. */
const general = {
  archived: false,
  id: expect.any(String),
  kind: "general",
  last: null,
  name: "general",
  unread: false,
};

describe("classroom/forum list", () => {
  it.effect(
    "shows a chat's newest message to its list, the start of a long one, whose it is, and that a teacher hid it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const text = "Panjang ".repeat(40).trim();
        const sent = yield* fixture.as("teacher").mutation(send, {
          attachments: [],
          poll: null,
          ...forum,
          clientKey: "long-message",
          mentions: [],
          slug: nf,
          text,
        });
        const read = (role: "student" | "teacher") =>
          fixture.as(role).query(list, {
            ...firstPage,
            classId: forum.classId,
            slug: nf,
          });
        const student = yield* read("student");
        expect(student.page).toEqual([
          {
            ...general,
            last: {
              at: sent.createdAt,
              author: expect.any(String),
              media: null,
              mine: false,
              text: text.slice(0, 120),
            },
            unread: true,
          },
        ]);
        const teacher = yield* read("teacher");
        expect(teacher.page[0]).toMatchObject({
          last: { mine: true },
          unread: false,
        });
        yield* fixture.as("teacher").mutation(hide, {
          classId: forum.classId,
          messageId: sent.id,
          slug: nf,
        });
        const hidden = yield* read("student");
        expect(hidden.page[0]?.last?.text).toBeNull();
      })
  );

  it.effect("says a poll is a chat's newest message", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      yield* fixture.as("teacher").mutation(send, {
        ...forum,
        attachments: [],
        clientKey: "poll-message",
        mentions: [],
        poll: {
          multiple: false,
          options: ["Ya", "Tidak"],
          question: "Setuju?",
        },
        slug: nf,
        text: "",
      });
      const listed = yield* fixture.as("student").query(list, {
        ...firstPage,
        classId: forum.classId,
        slug: nf,
      });
      expect(listed.page[0]?.last).toMatchObject({ media: "poll", text: "" });
    })
  );
});
