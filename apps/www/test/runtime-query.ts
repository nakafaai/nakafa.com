import type {
  ContentSources,
  SnapshotContext,
} from "@repo/backend/content/snapshot/context";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Data, Effect } from "effect";

/** Test-only typed failure for mocked runtime query Promise rejections. */
class TestRuntimeQueryError extends Data.TaggedError("TestRuntimeQueryError")<{
  readonly message: string;
}> {}

type TestRuntimeQueryClient = (
  query: unknown,
  args: unknown
) => Promise<unknown>;

/** Adapts one mocked client to the Effect-native runtime query interface. */
export function createTestRuntimeQuery(read: TestRuntimeQueryClient) {
  return (query: unknown, args: unknown) =>
    Effect.tryPromise({
      try: () => read(query, args),
      catch: (cause) =>
        new TestRuntimeQueryError({
          message: String(cause),
        }),
    });
}

/** Executes an application's real query program against authenticated serving rows. */
export function createTestSnapshotQuery(context: SnapshotContext) {
  return <Query extends FunctionReference<"query">>(
    _query: Query,
    args: FunctionArgs<Query>,
    read: (
      args: FunctionArgs<Query>
    ) => Effect.Effect<FunctionReturnType<Query>, unknown, ContentSources>
  ) => read(args).pipe(Effect.provideContext(context));
}

/** Runs the same authenticated query at a Promise-based application test boundary. */
export function createTestSnapshotFetch(context: SnapshotContext) {
  return <Query extends FunctionReference<"query">>(
    _query: Query,
    args: FunctionArgs<Query>,
    read: (
      args: FunctionArgs<Query>
    ) => Effect.Effect<FunctionReturnType<Query>, unknown, ContentSources>
  ) => Effect.runPromise(read(args).pipe(Effect.provideContext(context)));
}
