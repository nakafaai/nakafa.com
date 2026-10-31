import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
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
import { provider } from "@repo/backend/test/gateway";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Option } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

/** The search of Nakafa content, which each test answers. */
const findContent = vi.hoisted(() => vi.fn());
vi.mock("@repo/backend/confect/nina/nakafa/find", () => ({ findContent }));

type Fixture = Effect.Success<typeof tenancyFixture>;

const { page, send } = refs.public.classroom.forum.messages;
const { open } = refs.public.classroom.forum.threads;
const { finish, reply } = refs.internal.classroom.forum.nina;

/** Nina answers every question with `output`. */
const ninaAnswers = (output: { text: string; unsure: boolean }) => {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([{ text: encodeJsonText(output), type: "text" }]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
};

/** Turns Nina on for the school and gives it the pool of a School grant. */
const withPool = (fixture: Fixture, ninaSeats: number) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const tenant = yield* (yield* DatabaseReader)
        .table("tenants")
        .get(fixture.tenants.nf);
      yield* writer.table("tenants").patch(fixture.tenants.nf, {
        policies: { ...tenant.policies, nina: true },
      });
      if (ninaSeats > 0) {
        yield* writer.table("billingGrants").insert({
          ninaSeats,
          product: "school",
          scope: { kind: "tenant" },
          seats: ninaSeats,
          source: { contractId: "contract-nina", kind: "contract" },
          tenantId: fixture.tenants.nf,
          validFrom: 0,
          validTo: TENANCY_NOW * 2,
        });
      }
    }).pipe(Effect.orDie)
  );

/** What the school's pool has used this month. */
const poolUsed = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("creditPools")
        .index("by_creation_time")
        .first()
        .pipe(
          Effect.map((row) =>
            Option.getOrElse(
              Option.map(row, (found) => found.used),
              () => 0
            )
          ),
          Effect.orDie
        )
    )
  );

/** The question a student asks Nina in the class's general channel. */
const asked = Effect.fn("test.forum.nina.asked")(function* (fixture: Fixture) {
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const message = yield* fixture.as("student").mutation(send, {
    ...forum,
    clientKey: "nina-question",
    mentions: [{ _tag: "nina" }],
    slug: nf,
    text: "Kenapa percepatan bisa negatif?",
  });
  return { forum, messageId: message.id };
});

/** The inbox rows of the class's teacher. */
const teacherRows = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("notifications")
        .index("by_recipientPersonId_and_createdAt", (query) =>
          query.eq("recipientPersonId", fixture.people.teacher.personId)
        )
        .take(10)
        .pipe(Effect.orDie)
    )
  );

describe("classroom/forum nina", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    findContent.mockReturnValue(
      Effect.succeed({ result: null, text: "Sumber Nakafa" })
    );
  });

  afterEach(() => {
    provider.languageModel.mockReset();
  });

  it.effect("refuses a mention of Nina in a school that keeps her off", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      expect(
        yield* fixture
          .as("student")
          .mutation(send, {
            ...forum,
            clientKey: "nina-refused",
            mentions: [{ _tag: "nina" }],
            slug: nf,
            text: "Halo",
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "MentionRefused" });
    })
  );

  it.effect(
    "answers in the channel as an ordinary message, labelled Nina, and draws its credits",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* withPool(fixture, 3);
        const { forum, messageId } = yield* asked(fixture);
        ninaAnswers({ text: "Karena arahnya berlawanan.", unsure: false });

        yield* fixture.internal.action(reply, { messageId });

        const listed = yield* fixture.as("student").query(page, {
          ...firstPage,
          channelId: forum.channelId,
          classId: forum.classId,
          slug: nf,
        });
        expect(Arr.head(listed.page)).toEqual(
          Option.some(
            expect.objectContaining({
              author: expect.objectContaining({ name: "Nina", nina: true }),
              text: "Karena arahnya berlawanan.",
            })
          )
        );
        expect(yield* poolUsed(fixture)).toBe(5);
      })
  );

  it.effect("keeps a reply in its discussion", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      const teacher = fixture.as("teacher");
      const discussion = yield* teacher.mutation(open, {
        ...forum,
        clientKey: "nina-discussion",
        mentions: [],
        slug: nf,
        text: "Tanya apa saja.",
        title: "Tanya",
      });
      const question = yield* fixture
        .as("student")
        .mutation(refs.public.classroom.forum.threads.reply, {
          classId: forum.classId,
          clientKey: "nina-reply-asks",
          mentions: [{ _tag: "nina" }],
          number: discussion.discussion.number,
          slug: nf,
          text: "Apa itu gaya?",
        });
      ninaAnswers({ text: "Dorongan atau tarikan.", unsure: false });

      yield* fixture.internal.action(reply, { messageId: question.id });

      const seen = yield* teacher.query(
        refs.public.classroom.forum.threads.get,
        {
          classId: forum.classId,
          number: discussion.discussion.number,
          slug: nf,
        }
      );
      expect(seen.discussion.replies).toBe(2);
    })
  );

  it.effect("passes the question to the teacher when Nina is not sure", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const { messageId } = yield* asked(fixture);
      ninaAnswers({ text: "", unsure: true });

      yield* fixture.internal.action(reply, { messageId });

      expect(yield* teacherRows(fixture)).toMatchObject([
        { changeType: "forum.mentioned", messageId },
      ]);
      expect(yield* poolUsed(fixture)).toBe(0);
    })
  );

  it.effect("passes the question on when the school's pool holds nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 0);
      const { messageId } = yield* asked(fixture);
      const model = ninaAnswers({ text: "Tidak dipakai.", unsure: false });

      yield* fixture.internal.action(reply, { messageId });

      expect(model.doGenerateCalls).toEqual([]);
      expect(yield* teacherRows(fixture)).toHaveLength(1);
    })
  );

  it.effect("reads the talk before a question, her own replies included", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const { forum, messageId } = yield* asked(fixture);
      ninaAnswers({ text: "Karena arahnya berlawanan.", unsure: false });
      yield* fixture.internal.action(reply, { messageId });
      vi.setSystemTime(TENANCY_NOW + 1000);
      const next = yield* fixture.as("student").mutation(send, {
        ...forum,
        clientKey: "nina-follow-up",
        mentions: [{ _tag: "nina" }],
        slug: nf,
        text: "Contohnya?",
      });
      const model = ninaAnswers({ text: "Rem mobil.", unsure: false });

      yield* fixture.internal.action(reply, { messageId: next.id });

      const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
      expect(prompt).toContain("Kenapa percepatan bisa negatif?");
      expect(prompt).toContain("Nina: Karena arahnya berlawanan.");
      expect(prompt).toContain("Sumber Nakafa");
    })
  );

  it.effect("answers without sources when the search fails", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const { messageId } = yield* asked(fixture);
      findContent.mockReturnValue(Effect.fail(new Error("down")));
      const model = ninaAnswers({ text: "Tetap dijawab.", unsure: false });

      yield* fixture.internal.action(reply, { messageId });

      expect(model.doGenerateCalls).toHaveLength(1);
      expect(yield* poolUsed(fixture)).toBe(5);
    })
  );

  it.effect(
    "passes the question on and gives the credits back when the model fails",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* withPool(fixture, 3);
        const { messageId } = yield* asked(fixture);
        provider.languageModel.mockReturnValue(
          new MockLanguageModelV4({
            doGenerate: () => Promise.reject(new Error("down")),
          })
        );

        yield* fixture.internal.action(reply, { messageId });

        expect(yield* teacherRows(fixture)).toHaveLength(1);
        expect(yield* poolUsed(fixture)).toBe(0);
      })
  );

  it.effect("passes the question on when the member's day is spent", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      yield* fixture.run(
        Effect.gen(function* () {
          const tenant = yield* (yield* DatabaseReader)
            .table("tenants")
            .get(fixture.tenants.nf);
          yield* (yield* DatabaseWriter)
            .table("tenants")
            .patch(fixture.tenants.nf, {
              policies: { ...tenant.policies, ninaDailyCredits: 1 },
            });
        }).pipe(Effect.orDie)
      );
      const { messageId } = yield* asked(fixture);
      const model = ninaAnswers({ text: "Tidak dipakai.", unsure: false });

      yield* fixture.internal.action(reply, { messageId });

      expect(model.doGenerateCalls).toEqual([]);
    })
  );

  it.effect(
    "holds nothing for a Person without an account, and settles without a hold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* withPool(fixture, 3);
        const { messageId } = yield* asked(fixture);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantPeople")
              .patch(fixture.people.student.personId, {
                account: { state: "unclaimed" },
              })
          ).pipe(Effect.orDie)
        );

        yield* fixture.internal.mutation(finish, { answer: null, messageId });

        expect(yield* teacherRows(fixture)).toHaveLength(1);
      })
  );

  it.effect("sends nothing for a question a teacher hid", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const { forum, messageId } = yield* asked(fixture);
      yield* fixture
        .as("teacher")
        .mutation(refs.public.classroom.forum.messages.hide, {
          classId: forum.classId,
          messageId,
          slug: nf,
        });
      const model = ninaAnswers({ text: "Tidak dipakai.", unsure: false });

      yield* fixture.internal.action(reply, { messageId });

      expect(model.doGenerateCalls).toEqual([]);
      expect(yield* teacherRows(fixture)).toEqual([]);
    })
  );
});
