import { Effect, Schema } from "effect";
import { lazy as reactLazy } from "react";

/** The component that React's `lazy` takes, as React names it. */
type LazyComponent = Awaited<
  ReturnType<Parameters<typeof reactLazy>[0]>
>["default"];

/** An import failed. It carries the failure, which the caller reads as the import threw it. */
class ChunkReadFailed extends Schema.TaggedError<
  ChunkReadFailed,
  { readonly brand: unique symbol }
>()("ChunkReadFailed", { cause: Schema.Unknown }) {}

/**
 * The attribute of the root element that says the page is going, and why: the
 * page reloads for a chunk of an earlier deploy (`GOING_RELOAD`), or the reader
 * leaves it (`GOING_LEAVE`). The stale-chunk script of the head sets it, and a
 * press removes it, because a page that is still pressed has stayed: a prompt
 * kept it.
 */
export const GOING_ATTRIBUTE = "data-going";

/** The page reloads for a chunk of an earlier deploy. */
export const GOING_RELOAD = "reload";

/** The reader leaves the page. */
export const GOING_LEAVE = "leave";

/** Why the page is going, or none while it stays. */
export function readPageGoing() {
  return typeof document === "undefined"
    ? null
    : document.documentElement.getAttribute(GOING_ATTRIBUTE);
}

/** Waits until the browser reports a network again. */
const waitForNetwork = Effect.callback<void>((resume) => {
  const answer = () => resume(Effect.void);
  window.addEventListener("online", answer, { once: true });
  return Effect.sync(() => window.removeEventListener("online", answer));
});

/** Waits until the page stays, which a press shows once a prompt kept it. */
const waitUntilStays = Effect.callback<void>((resume) => {
  const observer = new MutationObserver(() => {
    if (readPageGoing() === null) {
      resume(Effect.void);
    }
  });
  observer.observe(document.documentElement, {
    attributeFilter: [GOING_ATTRIBUTE],
  });
  return Effect.sync(() => observer.disconnect());
});

/**
 * Loads a chunk. A failed import in a browser without a network is out of reach, not
 * gone, so it waits for the network and runs again. A failed import of a page that is
 * going, because it reloads for a chunk of an earlier deploy or the reader leaves it,
 * waits too, so nothing draws an error while the page goes. Should the page stay after
 * all, it runs again. Any other failure stays as the import threw it, so a chunk of an
 * earlier deploy still reads as one.
 */
export const readChunk = Effect.fn("design.chunks.read")(function* <Module>(
  load: () => Promise<Module>
) {
  const read = Effect.tryPromise({
    catch: (cause) => new ChunkReadFailed({ cause }),
    try: load,
  });
  const holdWhileGoing = (
    failure: ChunkReadFailed
  ): Effect.Effect<Module, ChunkReadFailed> =>
    readPageGoing() === null
      ? Effect.fail(failure)
      : Effect.andThen(waitUntilStays, read).pipe(
          Effect.catchTag("ChunkReadFailed", holdWhileGoing)
        );
  return yield* read.pipe(
    Effect.catchIf(
      () => navigator.onLine === false,
      () => Effect.andThen(waitForNetwork, read)
    ),
    Effect.catchTag("ChunkReadFailed", holdWhileGoing),
    Effect.catchTag("ChunkReadFailed", ({ cause }) => Effect.die(cause))
  );
});

/**
 * `lazy` for a chunk that the network can take away. React hands a failed import to
 * the route's error boundary, which throws the page away, so an import with no network,
 * or of a page that is going, waits (`readChunk`), and the nearest Suspense boundary
 * holds its place meanwhile.
 */
export function lazy<Component extends LazyComponent>(
  load: () => Promise<{ default: Component }>
) {
  return reactLazy(() => Effect.runPromise(readChunk(load)));
}
