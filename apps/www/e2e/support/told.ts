import { expect } from "@playwright/test";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import type { Changes } from "@/e2e/support/changes";

/** The queries that tell a page of a chat: its conversation with the latest turn, and its messages. */
const CONVERSATION = "nina/conversation:get";
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
const ToldMessages = Schema.fromJsonString(
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        metadata: Schema.optionalKey(TurnSummary),
        ...Owned,
      })
    ),
  })
);

/** Every conversation a page was told: the chat and its latest turn. */
const conversationsTold = (changes: Changes) =>
  Arr.flatMap(changes.answersTo(CONVERSATION), (text) =>
    Option.toArray(Schema.decodeOption(ToldConversation)(text))
  );

/** Every message a page was told, whatever page of messages it came in. */
const messagesTold = (changes: Changes) =>
  Arr.flatMap(changes.answersTo(MESSAGES), (text) =>
    Option.match(Schema.decodeOption(ToldMessages)(text), {
      onNone: () => [],
      onSome: ({ page }) => page,
    })
  );

/** Every turn summary a page was told, in its conversation and in its messages. */
const summariesTold = (changes: Changes) =>
  Arr.appendAll(
    Arr.flatMap(conversationsTold(changes), ({ turn }) =>
      Option.toArray(Option.fromNullishOr(turn))
    ),
    Arr.flatMap(messagesTold(changes), ({ metadata }) =>
      Option.toArray(Option.fromNullishOr(metadata))
    )
  );

/**
 * What the owner's page was told of the turns of its chat: where each stands,
 * and what each cost. The reader's page is checked against this.
 */
export const learnsWhatTurnsCost = (changes: Changes) => {
  const facts = Arr.flatMap(summariesTold(changes), Rec.keys);

  expect(facts, "what the owner's page was told of the turns").toEqual(
    expect.arrayContaining(COST_FACTS)
  );
};

/**
 * What a reader's page was told of the turns of a shared chat: where each
 * stands and which prompt it answers, with an empty list of usage. None of
 * what a turn cost the owner, what Nina kept from it or what she suggests next
 * belongs to a reader.
 */
export const learnsOnlyWhereTurnsStand = (changes: Changes) => {
  const summaries = summariesTold(changes);

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
};

/** The account a page was told owns its chat, in the chat and in every message of it. */
const ownersTold = (changes: Changes) =>
  Arr.appendAll(
    Arr.map(conversationsTold(changes), ({ chat }) => chat.userId),
    Arr.map(messagesTold(changes), ({ userId }) => userId)
  );

/**
 * The owner's page is told which account owns the chat, in the chat and in
 * each of its messages.
 */
export const learnsWhoOwnsTheChat = (changes: Changes) => {
  const owners = ownersTold(changes);

  expect(
    owners.length,
    "the chats and messages the owner's page was told"
  ).toBeGreaterThan(1);
  expect(
    Arr.every(owners, (owner) => owner !== undefined),
    "whether each of them names the owner"
  ).toBe(true);
};

/**
 * A reader's page is told nothing of the account that owns the chat or of the
 * turn that runs in it, in the chat or in any message of it.
 */
export const learnsNothingOfWhoOwnsTheChat = (changes: Changes) => {
  const owners = ownersTold(changes);

  expect(
    owners.length,
    "the chats and messages the reader's page was told"
  ).toBeGreaterThan(1);
  expect(
    Arr.filter(owners, (owner) => owner !== undefined),
    "the accounts that the reader's page was told"
  ).toEqual([]);
  expect(
    Arr.filter(
      Arr.map(conversationsTold(changes), ({ chat }) => chat.activeTurnId),
      (turn) => turn !== undefined
    ),
    "the turns that the reader's page was told run in the chat"
  ).toEqual([]);
};
