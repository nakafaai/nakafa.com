import { vMessageDoc } from "@convex-dev/agent/validators";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import type { ThreadRead } from "@repo/backend/confect/nina/sealed/thread";
import { parse } from "convex-helpers/validators";
import { Array as Arr, Effect } from "effect";

type LearnerId = Docs["users"]["_id"];

/** One page of a thread as an action reads it: the rows, and the cursor that continues the page. */
export type ThreadPage = Effect.Success<
  ReturnType<typeof readThreadFromAction>
>;

/**
 * Reads one page of a thread's messages from an action. Only a query or a
 * mutation reads the keys that open the rows, so the internal query of the
 * sealed module opens them there, in the same single trip. Each row comes back
 * as the Agent's own message document, and the Agent's validator checks it.
 */
export const readThreadFromAction = Effect.fn("nina.sealed.threadFromAction")(
  function* ({ owner, ...read }: ThreadRead) {
    const { runQuery: query } = yield* QueryRunner;
    const result = yield* query(refs.internal.nina.sealed.thread, {
      owner,
      ...read,
    });
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      page: Arr.map(result.page, (row) => parse(vMessageDoc, row)),
    };
  }
);

/**
 * Reads one message of a thread from an action, opened for `owner`, or null
 * when the component holds no message with that id.
 */
export const readMessageFromAction = Effect.fn("nina.sealed.messageFromAction")(
  function* (owner: LearnerId, messageId: string) {
    const { runQuery: query } = yield* QueryRunner;
    const row = yield* query(refs.internal.nina.sealed.message, {
      messageId,
      owner,
    });
    return row === null ? null : parse(vMessageDoc, row);
  }
);
