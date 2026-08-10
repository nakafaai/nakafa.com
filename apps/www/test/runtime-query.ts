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
