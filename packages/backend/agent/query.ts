import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect } from "effect";

type AgentQuery = FunctionReference<"query", "public" | "internal">;

/** Runs one Convex query in-process from an HTTP Action with a typed failure. */
export function readAgentQuery<Query extends AgentQuery>(
  ctx: ActionCtx,
  query: Query,
  args: FunctionArgs<Query>,
  message: string
) {
  return Effect.tryPromise({
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message,
      }),
    try: (): Promise<FunctionReturnType<Query>> => ctx.runQuery(query, args),
  });
}
