import { expect } from "@playwright/test";
import { MEMORY_CAPABILITY } from "@repo/backend/confect/nina/capability/spec";
import { PROVIDER_METADATA } from "@repo/backend/confect/nina/reader";
import {
  Array as Arr,
  Option,
  Record as Rec,
  type Result,
  Schema,
} from "effect";
import type { Changes } from "@/e2e/support/changes";

/**
 * The queries that tell a page of a chat: its conversation with the latest
 * turn, the turns that ended, and its messages.
 */
const CONVERSATION = "nina/conversation:get";
const TURNS = "nina/conversation:turns";
const MESSAGES = "nina/messages:list";
/** The facts a reader's page is told of a turn: where it stands, and which prompt it answers. */
const READER_FACTS = [
  "order",
  "promptMessageId",
  "promptedAt",
  "state",
  "usage",
];
/** What a turn cost the owner, which only the owner's page is told. */
const COST_FACTS = ["credits", "tokens"];

/** A turn summary as a page was told it: its keys are the facts the page was given. */
const TurnSummary = Schema.Record(Schema.String, Schema.Unknown);
/** The account that owns a chat, as a chat and a message of it name it. */
const Owned = {
  userId: Schema.optionalKey(Schema.String),
};
const ToldConversation = Schema.fromJsonString(
  Schema.Struct({
    chat: Schema.Struct({
      activeTurnId: Schema.optionalKey(Schema.String),
      ...Owned,
    }),
    turn: Schema.NullOr(TurnSummary),
  })
);
/** A page of the turns that ended, each as a page was told it. */
const ToldTurns = Schema.fromJsonString(
  Schema.Struct({ page: Schema.Array(TurnSummary) })
);
/** What a page is told of the live streams: the running ones, or the new parts of some. */
const ToldStreams = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("list"),
    messages: Schema.Array(Schema.Unknown),
  }),
  Schema.Struct({
    kind: Schema.Literal("deltas"),
    deltas: Schema.Array(Schema.Unknown),
  }),
]);
/** A part of a message as a page was told it: its type, and every other key it was given. */
const ToldPart = Schema.StructWithRest(Schema.Struct({ type: Schema.String }), [
  Schema.Record(Schema.String, Schema.Unknown),
]);
const ToldMessages = Schema.fromJsonString(
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        parts: Schema.Array(ToldPart),
        ...Owned,
      })
    ),
    streams: ToldStreams,
  })
);
const readConversation = Schema.decodeResult(ToldConversation);
const readTurns = Schema.decodeResult(ToldTurns);
const readMessages = Schema.decodeResult(ToldMessages);

/** What a check asks of a page: the answers its queries were given. */
type Answered = Pick<Changes, "answersTo">;

/**
 * Every answer a page was given to the query `udfPath`, read by `read`. An
 * answer that does not read fails the check and names the query, instead of
 * dropping out of it, because a check that looked at less than it names passes
 * for nothing.
 */
const readAnswers = <A>(
  page: Answered,
  udfPath: string,
  read: (text: string) => Result.Result<A, unknown>
) => {
  const answers = Arr.map(page.answersTo(udfPath), (text) => read(text));

  expect(
    Arr.getFailures(answers),
    `the answers to ${udfPath} that the check cannot read`
  ).toEqual([]);
  return Arr.getSuccesses(answers);
};

/**
 * Everything a page was told of its chat, in the order it was told: its
 * conversations, each with the latest turn, the turns that ended of every page
 * of them, the messages of every page of messages, and the streams that each
 * answer about messages carried. A page that was told no conversation, no turns
 * or no message fails the check, so one source cannot stand in for another.
 */
const told = (page: Answered) => {
  const conversations = readAnswers(page, CONVERSATION, readConversation);
  const turnAnswers = readAnswers(page, TURNS, readTurns);
  const answers = readAnswers(page, MESSAGES, readMessages);
  const messages = Arr.flatMap(answers, (answer) => answer.page);

  expect(
    conversations.length,
    "the conversations the page was told"
  ).toBeGreaterThan(0);
  // A chat whose turn still runs has no turn that ended, but the page is told so.
  expect(
    turnAnswers.length,
    "the answers about the turns that ended the page was given"
  ).toBeGreaterThan(0);
  expect(messages.length, "the messages the page was told").toBeGreaterThan(0);
  return {
    conversations,
    messages,
    streams: Arr.map(answers, (answer) => answer.streams),
    turns: Arr.flatMap(turnAnswers, (answer) => answer.page),
  };
};

type Told = ReturnType<typeof told>;

/** Every turn summary a page was told, in its conversations and among the turns that ended. */
const summariesOf = ({ conversations, turns }: Told) =>
  Arr.appendAll(
    Arr.flatMap(conversations, ({ turn }) =>
      Option.toArray(Option.fromNullishOr(turn))
    ),
    turns
  );

/** The account a page was told owns its chat, in each chat and in each message of it. */
const ownersOf = ({ conversations, messages }: Told) =>
  Arr.appendAll(
    Arr.map(conversations, ({ chat }) => chat.userId),
    Arr.map(messages, ({ userId }) => userId)
  );

/**
 * What the owner's page was told of the turns of its chat: where each stands,
 * and what each cost. The reader's page is checked against this.
 */
export const learnsWhatTurnsCost = (page: Answered) => {
  const facts = Arr.flatMap(summariesOf(told(page)), Rec.keys);

  expect(facts, "what the owner's page was told of the turns").toEqual(
    expect.arrayContaining(COST_FACTS)
  );
};

/**
 * What a reader's page was told of the turns of a shared chat: where each
 * stands and which prompt it answers, with an empty list of usage. None of
 * what a turn cost the owner, what Nina kept from it or what she suggests next
 * belongs to a reader, and no part of a message holds what the provider
 * reported for the call that wrote it, which is where the gateway reports what
 * the call cost. The local runtime has no model, so no part of a chat of a
 * browser test was written by a call: the last check shows only what the
 * production build answers with, and the tests of this module show that it
 * fails for a page that was told such a part. `nina/messages.impl.test.ts` runs
 * a real turn and reads it as a reader.
 */
export const learnsOnlyWhereTurnsStand = (page: Answered) => {
  const answered = told(page);
  const summaries = summariesOf(answered);

  expect(
    summaries.length,
    "the turns the reader's page was told"
  ).toBeGreaterThan(0);
  for (const summary of summaries) {
    expect(
      Arr.difference(Rec.keys(summary), READER_FACTS),
      "the facts of a turn that the reader's page was told beyond where it stands"
    ).toEqual([]);
    expect(summary.usage).toEqual([]);
  }
  expect(
    Arr.filter(
      Arr.flatMap(answered.messages, ({ parts }) => parts),
      (part) => Arr.some(PROVIDER_METADATA, (key) => Rec.has(part, key))
    ),
    "the parts that the reader's page was told with what the provider reported for a call"
  ).toEqual([]);
};

/**
 * The owner's page is told which account owns the chat, in the chat and in
 * each of its messages.
 */
export const learnsWhoOwnsTheChat = (page: Answered) => {
  const owners = ownersOf(told(page));

  expect(
    Arr.every(owners, (owner) => owner !== undefined),
    "whether the chat and each message the owner's page was told name the owner"
  ).toBe(true);
};

/**
 * A reader's page is told no live stream: each answer about its messages lists
 * no running stream and holds no part of one, and no message it was told holds
 * the call of a search of the owner's memory or its result. What Nina looked
 * for in the owner's memories, whether something matched and whether memory is
 * paused belong to the owner. A stream carries chunks of a tool call that name
 * only the call, so a page that is told none cannot be told those of a search.
 * The local runtime has no model, so a chat of a browser test holds neither a
 * search nor a running stream: the check shows what the production build answers
 * a reader's requests with, and the tests of this module show that it fails for
 * a page that was told either.
 */
export const learnsNoStreamAndNoMemory = (page: Answered) => {
  const { messages, streams } = told(page);

  expect(
    Arr.filter(streams, (stream) =>
      stream.kind === "list"
        ? stream.messages.length > 0
        : stream.deltas.length > 0
    ),
    "the streams that the reader's page was told"
  ).toEqual([]);
  expect(
    Arr.filter(
      Arr.flatMap(messages, ({ parts }) => parts),
      ({ type }) => type === `tool-${MEMORY_CAPABILITY}`
    ),
    "the parts of a memory call that the reader's page was told"
  ).toEqual([]);
};

/**
 * A reader's page is told nothing of the account that owns the chat or of the
 * turn that runs in it, in the chat or in any message of it.
 */
export const learnsNothingOfWhoOwnsTheChat = (page: Answered) => {
  const answered = told(page);

  expect(
    Arr.filter(ownersOf(answered), (owner) => owner !== undefined),
    "the accounts that the reader's page was told"
  ).toEqual([]);
  expect(
    Arr.filter(
      Arr.map(answered.conversations, ({ chat }) => chat.activeTurnId),
      (turn) => turn !== undefined
    ),
    "the turns that the reader's page was told run in the chat"
  ).toEqual([]);
};
