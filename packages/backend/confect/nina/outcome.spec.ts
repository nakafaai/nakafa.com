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
 * stored its output with a `failure` key (`failed`, `denied` or `sourceLimit`).
 * Today it stores an `outcome` instead. `rewriteFailures` replaces the old key
 * in every stored output that still has it with the `outcome` the capability
 * runner would store now: `failed`, `denied`, `limit`, or `partial` when a
 * failed run had loaded a card (`settleOutcome` decides). It reads the Agent
 * thread of each chat, chats in creation order, and rewrites a message through
 * the Agent component's own update function. Everything else in the message
 * stays as it was.
 *
 * One call takes at most five steps, and a step reads at most twenty messages
 * of one chat, so a call opens at most five chats and reads at most a hundred
 * messages. It takes no new step once it has rewritten five messages. It
 * counts the messages it read in `scanned` and the messages it changed in
 * `rewritten`, and returns the `cursor` to continue from, or null when every
 * chat is done. Run it with `{ "cursor": null }`, then send each returned
 * cursor back unchanged until it is null. A pass in which every call rewrites
 * 0 proves the data is clean. Running a pass again is safe, because an output
 * without the old key is left alone.
 *
 * It runs on dev and on production, and it is deleted with its tests once
 * both report zero.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "rewriteFailures",
    args: () => ({ cursor: Schema.NullOr(OutcomeCursor) }),
    returns: () => OutcomeReport,
  })
);
