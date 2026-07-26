import { Data, Effect } from "effect";

/** Test-only typed failure for mocked runtime query Promise rejections. */
class TestRuntimeQueryError extends Data.TaggedError("TestRuntimeQueryError")<{
  readonly message: string;
}> {}

/** Preserves a mocked runtime query rejection message in the Effect error channel. */
export function readTestRuntimeQuery(
  _name: string,
  read: () => Promise<unknown>
) {
  return Effect.tryPromise({
    try: read,
    catch: (cause) =>
      new TestRuntimeQueryError({
        message: String(cause),
      }),
  });
}
