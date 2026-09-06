import type { createTestPublication } from "@repo/backend/test/content/publication";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type TestRuntimeQueryClient = (
  query: unknown,
  args: unknown
) => Promise<unknown>;

/** Adapts one mocked client to the Effect-native runtime query interface. */
export function createTestRuntimeQuery(read: TestRuntimeQueryClient) {
  return (_convexUrl: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      try: () => read(query, args),
      catch: (cause) =>
        new NakafaAgentDataReadError({
          message: "Unable to read test Convex query.",
          cause: String(cause),
        }),
    });
}

type TestPublication = Effect.Success<ReturnType<typeof createTestPublication>>;
type PublicTestQuery = FunctionReference<
  "query",
  "public",
  DefaultFunctionArgs,
  unknown
>;

/** Executes generated query references against the actual Convex schema and modules. */
export function createTestNativeQuery(runtime: TestPublication) {
  return (
    _convexUrl: string,
    query: PublicTestQuery,
    args: DefaultFunctionArgs
  ) =>
    Effect.tryPromise({
      try: () => runtime.query(query, args),
      catch: (cause) =>
        new NakafaAgentDataReadError({
          message: "Unable to read test Convex query.",
          cause: String(cause),
        }),
    });
}
