import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * Where a pass stopped. `chats` continues the list of chats, read by creation
 * time, after the chat in progress. `messages` continues inside that chat's
 * Agent thread when it has more messages than one call reads, and is null once
 * the chat is finished.
 */
export const OutcomeCursor = Schema.Struct({
  chats: Schema.NullOr(Schema.String),
  messages: Schema.NullOr(
    Schema.Struct({ cursor: Schema.String, threadId: Schema.String })
  ),
});

/**
 * What reading did: how many messages it read, how many it rewrote, and where
 * the pass continues, null after the last chat. A call reports the sum of its
 * reads.
 */
export const OutcomeReport = Schema.Struct({
  cursor: Schema.NullOr(OutcomeCursor),
  rewritten: Count,
  scanned: Count,
});

/**
 * Temporary maintenance function. Until 10 October 2026 a capability tool
 * stored its output with a `failure` key (`failed`, `denied` or `sourceLimit`)
 * when it failed, and with no mark at all when it lost one of its cards.
 * Today it stores an `outcome` that agrees with its cards. `rewriteFailures`
 * gives every stored output that has no `outcome` the one the capability
 * runner would store now (`settleOutcome` decides). An output with the old key
 * becomes `failed`, `denied`, `limit`, or `partial` when a failed run had
 * loaded a card, and the key goes. An output without it becomes `partial`
 * beside a loaded card and `failed` without one, when it lost a card. An
 * output that has neither the key nor a lost card is complete and stays as it
 * is. The function reads the Agent thread of each chat, chats in creation
 * order, and rewrites a message through the Agent component's own update
 * function. Everything else in the message stays as it was.
 *
 * One call takes at most four steps, and a step reads one page of one chat:
 * twenty messages at most, and fewer when they are large. A call rewrites at
 * most three messages, and a page that holds more waits for the next call,
 * which reads it again and finds what is left. `scanned` counts the messages a
 * call read, `rewritten` the messages it changed, and `cursor` is where to
 * continue, or null when every chat is done. Run it with `{ "cursor": null }`,
 * then send each returned cursor back unchanged until it is null. A pass in
 * which every call rewrites 0 proves the data is clean. Running a pass again is
 * safe, because an output with an `outcome` is left alone.
 *
 * Run one call on dev first and read its time in the logs before production.
 * If a call takes long, lower `STEPS`, `REWRITES`, `PAGE` or `PAGE_BYTES` in
 * the implementation. It runs on dev and on production, and it is deleted with
 * its tests once both report zero.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "rewriteFailures",
    args: () => ({ cursor: Schema.NullOr(OutcomeCursor) }),
    returns: () => OutcomeReport,
  })
);
