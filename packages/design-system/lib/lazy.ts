import { Effect, Schema } from "effect";
import { lazy as reactLazy } from "react";

/** The component that React's `lazy` takes, as React names it. */
type LazyComponent = Awaited<
  ReturnType<Parameters<typeof reactLazy>[0]>
>["default"];

/** An import failed. It carries the failure, which the caller reads as the import threw it. */
class ChunkReadFailed extends Schema.TaggedError<ChunkReadFailed>()(
  "ChunkReadFailed",
  { cause: Schema.Unknown }
) {}

/** Waits until the browser reports a network again. */
const waitForNetwork = Effect.callback<void>((resume) => {
  const answer = () => resume(Effect.void);
  window.addEventListener("online", answer, { once: true });
  return Effect.sync(() => window.removeEventListener("online", answer));
});

/**
 * Loads a chunk. A failed import in a browser without a network is out of reach, not
 * gone, so it waits for the network and runs again. Any other failure stays as the
 * import threw it, so a chunk of an earlier deploy still reads as one.
 */
export const readChunk = Effect.fn("design.chunks.read")(function* <Module>(
  load: () => Promise<Module>
) {
  const read = Effect.tryPromise({
    catch: (cause) => new ChunkReadFailed({ cause }),
    try: load,
  });
  return yield* read.pipe(
    Effect.catchIf(
      () => navigator.onLine === false,
      () => Effect.andThen(waitForNetwork, read)
    ),
    Effect.catchTag("ChunkReadFailed", ({ cause }) => Effect.die(cause))
  );
});

/**
 * `lazy` for a chunk that the network can take away. React hands a failed import to
 * the route's error boundary, which throws the page away, so an import with no network
 * waits (`readChunk`), and the nearest Suspense boundary holds its place meanwhile.
 */
export function lazy<Component extends LazyComponent>(
  load: () => Promise<{ default: Component }>
) {
  return reactLazy(() => Effect.runPromise(readChunk(load)));
}
