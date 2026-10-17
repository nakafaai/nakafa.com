import { components } from "@repo/backend/confect/_generated/components";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Array as Arr, Predicate, Record as Rec } from "effect";

/** A test deployment of the backend, as the stored rows are read from it. */
type Deployment = ReturnType<typeof createConvexTestWithBetterAuth>;

const decoder = new TextDecoder();

/** Every string that a stored value holds, with each binary value read as its bytes. */
function textsIn(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (value instanceof ArrayBuffer) {
    return [decoder.decode(value)];
  }
  if (Arr.isArray(value)) {
    return Arr.flatMap(value, textsIn);
  }
  if (Predicate.isObject(value)) {
    return Arr.flatMap(Rec.values(value), textsIn);
  }
  return [];
}

/**
 * The text of a stored value, with each binary value read as its bytes. A planted
 * string shows here wherever a table export would show it, even inside sealed bytes,
 * so a sealed row that leaks its text fails a search for it.
 */
export function storedTextOf(value: unknown): string {
  return Arr.join(textsIn(value), " ");
}

/**
 * The rows that the Agent component holds for one thread and the given files, as the
 * component stores them: the thread, its messages with every status and tool flag,
 * its streams and their deltas, and the files. A planted string that is in none of
 * them is in no table the component keeps for the thread (ADR 0024).
 */
export function storedRowsIn(
  t: Deployment,
  threadId: string,
  fileIds: readonly string[]
) {
  return t.query(async (ctx) => {
    const streams = await ctx.runQuery(components.nina.streams.list, {
      statuses: ["streaming", "finished", "aborted"],
      threadId,
    });
    return {
      deltas: await ctx.runQuery(components.nina.streams.listDeltas, {
        cursors: Arr.map(streams, (stream) => ({
          cursor: 0,
          streamId: stream.streamId,
        })),
        threadId,
      }),
      files: await Promise.all(
        Arr.map(fileIds, (fileId) =>
          ctx.runQuery(components.nina.files.get, { fileId })
        )
      ),
      messages: await ctx.runQuery(
        components.nina.messages.listMessagesByThreadId,
        {
          order: "asc",
          paginationOpts: { cursor: null, numItems: 1000 },
          threadId,
        }
      ),
      streams,
      thread: await ctx.runQuery(components.nina.threads.getThread, {
        threadId,
      }),
    };
  });
}
