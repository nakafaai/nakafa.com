// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { PROVIDER_METADATA } from "@repo/backend/confect/nina/reader";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Option, Record as Rec } from "effect";
import {
  learnsNoStreamAndNoMemory,
  learnsNothingOfWhoOwnsTheChat,
  learnsOnlyWhereTurnsStand,
  learnsWhatTurnsCost,
  learnsWhoOwnsTheChat,
} from "@/e2e/support/told";

const CONVERSATION = "nina/conversation:get";
const TURNS = "nina/conversation:turns";
const MESSAGES = "nina/messages:page";
const OWNER = "user-of-the-owner";
/** What the check of a reader's page says when it was told an account. */
const ACCOUNTS = "the accounts that the reader's page was told";

/** Where a turn stands, which is all a reader is told of it. */
const standing = {
  order: 0,
  promptMessageId: "message-1",
  promptedAt: 1,
  state: { status: "queued" },
  usage: [],
};
/** What the same turn cost the owner. */
const cost = { credits: 5, tokens: { input: 1, output: 2, total: 3 } };

/** The answer to the query for the conversation of a chat. */
const conversationOf = (
  chat: Record<string, string>,
  turn: Record<string, unknown> | null
) => encodeJsonText({ chat: { _id: "chat-1", ...chat }, turn });

/** The answer to the query for a page of the turns that ended. */
const turnsOf = (...page: Record<string, unknown>[]) =>
  encodeJsonText({ continueCursor: "", isDone: true, page });

/** The answer to the query for a page of messages. */
const messagesOf = (...page: Record<string, unknown>[]) =>
  encodeJsonText({
    continueCursor: "",
    isDone: true,
    page,
    streams: { kind: "list", messages: [] },
  });

/** The answer to a request for the streams of the chat, which carries no message. */
const streamsOf = (streams: Record<string, unknown>) =>
  encodeJsonText({ continueCursor: "", isDone: true, page: [], streams });

/** The parts of an answer that did a sum: the step, the sum, and the words. */
const answered = [
  { type: "step-start" },
  { toolCallId: "math-1", type: "tool-math" },
  { text: "The value is 2.", type: "text" },
];
/** The parts of a search of the owner's memory, which only the owner is told. */
const searched = [
  { type: "step-start" },
  { toolCallId: "recall-1", type: "tool-memory" },
];

/** A page of the browser that was given these answers, by the query that answered them. */
const given = (answers: Readonly<Record<string, string[]>>) => ({
  answersTo: (udfPath: string) =>
    Option.getOrElse(Rec.get(answers, udfPath), () => []),
});

/**
 * The owner's page: the chat names the owner and the turn that runs, and the
 * turn shows what it cost. The page is told the conversation again whenever
 * the turn moves, so it holds more than one.
 */
const owner = {
  [CONVERSATION]: Arr.map(
    [{ status: "queued" }, { finishedAt: 2, status: "failed" }],
    (state) =>
      conversationOf(
        { activeTurnId: "turn-1", userId: OWNER },
        { ...standing, ...cost, state }
      )
  ),
  [TURNS]: [
    turnsOf({
      ...standing,
      ...cost,
      state: { finishedAt: 2, status: "failed" },
    }),
  ],
  [MESSAGES]: [
    messagesOf({
      id: "message-1",
      parts: [...searched, ...answered],
      userId: OWNER,
    }),
  ],
};

/**
 * A reader's page, loaded the way the browser test loads it: the chat three
 * times, the turns that ended, its messages, and the answers to the requests
 * for streams, which list none and hold no delta.
 */
const reader = {
  [CONVERSATION]: Arr.replicate(conversationOf({}, standing), 3),
  [TURNS]: [turnsOf(standing)],
  [MESSAGES]: [
    messagesOf({ id: "message-1", parts: answered }),
    streamsOf({ kind: "list", messages: [] }),
    streamsOf({ kind: "deltas", deltas: [] }),
  ],
};

describe("the checks of what a page was told of a chat", () => {
  it("pass for the owner's page and a reader's page that were told what each is meant to be told", () => {
    learnsWhatTurnsCost(given(owner));
    learnsWhoOwnsTheChat(given(owner));
    learnsOnlyWhereTurnsStand(given(reader));
    learnsNothingOfWhoOwnsTheChat(given(reader));
    learnsNoStreamAndNoMemory(given(reader));
  });

  it("fail for a reader's page that was told a live stream, the new parts of one, or a part of a memory call", () => {
    const running = { streamId: "stream-1" };
    const written = { end: 1, parts: [], start: 0, streamId: "stream-1" };
    const STREAMS = "the streams that the reader's page was told";
    expect(() =>
      learnsNoStreamAndNoMemory(
        given({
          ...reader,
          [MESSAGES]: [
            ...reader[MESSAGES],
            streamsOf({ kind: "list", messages: [running] }),
          ],
        })
      )
    ).toThrow(STREAMS);
    expect(() =>
      learnsNoStreamAndNoMemory(
        given({
          ...reader,
          [MESSAGES]: [
            ...reader[MESSAGES],
            streamsOf({ deltas: [written], kind: "deltas" }),
          ],
        })
      )
    ).toThrow(STREAMS);
    expect(() =>
      learnsNoStreamAndNoMemory(
        given({
          ...reader,
          [MESSAGES]: [
            messagesOf({
              id: "message-1",
              parts: [...searched, ...answered],
            }),
          ],
        })
      )
    ).toThrow("the parts of a memory call that the reader's page was told");
  });

  it("fail for a reader's page that was told what only the owner is told", () => {
    expect(() =>
      learnsOnlyWhereTurnsStand(
        given({
          ...reader,
          [CONVERSATION]: [conversationOf({}, { ...standing, ...cost })],
        })
      )
    ).toThrow("beyond where it stands");
    expect(() =>
      learnsOnlyWhereTurnsStand(
        given({ ...reader, [TURNS]: [turnsOf({ ...standing, ...cost })] })
      )
    ).toThrow("beyond where it stands");
    expect(() =>
      learnsNothingOfWhoOwnsTheChat(
        given({
          ...reader,
          [CONVERSATION]: [conversationOf({ userId: OWNER }, standing)],
        })
      )
    ).toThrow(ACCOUNTS);
    expect(() =>
      learnsNothingOfWhoOwnsTheChat(
        given({
          ...reader,
          [MESSAGES]: [
            messagesOf({
              id: "message-1",
              parts: answered,
              userId: OWNER,
            }),
          ],
        })
      )
    ).toThrow(ACCOUNTS);
    expect(() =>
      learnsNothingOfWhoOwnsTheChat(
        given({
          ...reader,
          [CONVERSATION]: [
            conversationOf({ activeTurnId: "turn-1" }, standing),
          ],
        })
      )
    ).toThrow("the turns that the reader's page was told run in the chat");
  });

  it.each(PROVIDER_METADATA)(
    "fail for a reader's page that was told a part with what the provider reported for a call, under %s",
    (key) => {
      const reported = { convexGateway: { cost: 0.25 } };

      expect(() =>
        learnsOnlyWhereTurnsStand(
          given({
            ...reader,
            [MESSAGES]: [
              messagesOf({
                id: "message-1",
                parts: [...answered, { [key]: reported, type: "text" }],
              }),
            ],
          })
        )
      ).toThrow("with what the provider reported for a call");
    }
  );

  it("fail for an owner's page that was told neither what the turn cost nor who owns the chat", () => {
    expect(() => learnsWhatTurnsCost(given(reader))).toThrow(
      "what the owner's page was told of the turns"
    );
    expect(() => learnsWhoOwnsTheChat(given(reader))).toThrow("name the owner");
  });

  it.each([
    ["learnsWhatTurnsCost", learnsWhatTurnsCost, owner],
    ["learnsWhoOwnsTheChat", learnsWhoOwnsTheChat, owner],
    ["learnsOnlyWhereTurnsStand", learnsOnlyWhereTurnsStand, reader],
    ["learnsNothingOfWhoOwnsTheChat", learnsNothingOfWhoOwnsTheChat, reader],
    ["learnsNoStreamAndNoMemory", learnsNoStreamAndNoMemory, reader],
  ] as const)(
    "%s reads every answer it names, and no other answer stands in for one it cannot",
    (_name, check, page) => {
      // The messages answer lost the key that holds the messages. The answers
      // about the chat, which the page is given again with every load, must not
      // carry the check.
      expect(() =>
        check(
          given({ ...page, [MESSAGES]: [encodeJsonText({ isDone: true })] })
        )
      ).toThrow(`the answers to ${MESSAGES} that the check cannot read`);
      expect(() =>
        check(
          given({ ...page, [CONVERSATION]: [encodeJsonText({ chat: {} })] })
        )
      ).toThrow(`the answers to ${CONVERSATION} that the check cannot read`);
      expect(() =>
        check(given({ ...page, [TURNS]: [encodeJsonText({ isDone: true })] }))
      ).toThrow(`the answers to ${TURNS} that the check cannot read`);
      // A page that was told no message, or no chat, or no answer about turns.
      expect(() => check(given({ ...page, [MESSAGES]: [] }))).toThrow(
        "the messages the page was told"
      );
      expect(() => check(given({ ...page, [TURNS]: [] }))).toThrow(
        "the answers about the turns that ended"
      );
      expect(() => check(given({ ...page, [CONVERSATION]: [] }))).toThrow(
        "the conversations the page was told"
      );
    }
  );
});
