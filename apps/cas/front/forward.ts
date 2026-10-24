import { Data, Effect, Random } from "effect";
import { CAS_MATH_PATH } from "@/front/route";

/** Warm engine objects that serve concurrent calls; each call picks one at random. */
export const CAS_POOL_SIZE = 8;

/** The engine could not answer: its object was overloaded, or it failed. */
export class CasEngineFailed extends Data.TaggedError("CasEngineFailed")<{
  readonly overloaded: boolean;
}> {}

/** The Durable Object namespace of the engine, as the front Worker binds it. */
export interface CasSolverNamespace {
  readonly get: (id: unknown) => CasSolverStub;
  readonly idFromName: (name: string) => unknown;
}

/** One engine object, which answers a request with a response. */
export interface CasSolverStub {
  readonly fetch: (request: Request) => Promise<Response>;
}

/** The runtime refuses a call to an overloaded object with a flag on its error. */
function isOverloaded(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "overloaded" in cause &&
    cause.overloaded === true
  );
}

/**
 * Sends one bounded body to a random object of the pool. The engine's response
 * reaches the caller unchanged, with its status and its JSON detail.
 */
export const forwardMath = Effect.fn("cas.forward.math")(function* (
  namespace: CasSolverNamespace,
  body: Uint8Array<ArrayBuffer>
) {
  const index = yield* Random.nextIntBetween(0, CAS_POOL_SIZE, {
    halfOpen: true,
  });
  const stub = namespace.get(namespace.idFromName(`cas-${index}`));
  return yield* Effect.tryPromise({
    try: () =>
      stub.fetch(
        new Request(`https://cas.internal${CAS_MATH_PATH}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
      ),
    catch: (cause) => new CasEngineFailed({ overloaded: isOverloaded(cause) }),
  });
});
