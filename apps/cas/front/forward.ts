import { Data, Effect, Random, Schema } from "effect";
import { CAS_MATH_PATH } from "@/front/route";

/** Warm engine objects that serve concurrent calls; each call picks one at random. */
const CAS_POOL_SIZE = 16;

/** The longest the front waits for one engine object before it asks another object. */
const CAS_ENGINE_DEADLINE = "25 seconds";

/** The engine could not answer: its object was overloaded, or it failed. */
export class CasEngineFailed extends Data.TaggedError("CasEngineFailed")<{
  readonly overloaded: boolean;
}> {}

/** The engine did not answer within its deadline, so the front stopped waiting. */
export class CasEngineTimedOut extends Data.TaggedError("CasEngineTimedOut")<{
  readonly budget: string;
}> {}

/** One engine object, which answers a request with a response. */
export interface CasSolverStub {
  readonly fetch: (request: Request) => Promise<Response>;
}

/** The Durable Object namespace of the engine, as the front Worker binds it. */
export interface CasSolverNamespace {
  readonly get: (id: unknown) => CasSolverStub;
  readonly idFromName: (name: string) => unknown;
}

/** The bindings of the front Worker: the engine namespace and the bearer key. */
export interface CasFrontEnv {
  readonly CAS_SOLVER: CasSolverNamespace;
  readonly MATH_CAS_API_KEY?: string | undefined;
}

/** The runtime marks a call to an overloaded object with this flag on its error. */
const Overloaded = Schema.Struct({ overloaded: Schema.Literal(true) });

/**
 * Sends one bounded body to one object of the pool, and waits at most the
 * deadline. The object keeps running after the front stops waiting, and the
 * platform's CPU limit still ends that work.
 */
const sendToObject = Effect.fn("cas.forward.object")(function* (
  namespace: CasSolverNamespace,
  index: number,
  body: Uint8Array<ArrayBuffer>
) {
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
    catch: (cause) =>
      new CasEngineFailed({ overloaded: Schema.is(Overloaded)(cause) }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: CAS_ENGINE_DEADLINE,
      orElse: () => new CasEngineTimedOut({ budget: CAS_ENGINE_DEADLINE }),
    })
  );
});

/**
 * Sends one bounded body to a random object of the pool. An object that fails
 * with a 503 or misses its deadline gets one more call, at a different object of
 * the pool. The engine's response reaches the caller unchanged.
 */
export const forwardMath = Effect.fn("cas.forward.math")(function* (
  namespace: CasSolverNamespace,
  body: Uint8Array<ArrayBuffer>
) {
  const first = yield* Random.nextIntBetween(0, CAS_POOL_SIZE, {
    halfOpen: true,
  });
  // An offset of 1 to 15 from the first object always names a different object.
  const offset = yield* Random.nextIntBetween(1, CAS_POOL_SIZE, {
    halfOpen: true,
  });
  const second = (first + offset) % CAS_POOL_SIZE;
  const retry = () => sendToObject(namespace, second, body);
  return yield* sendToObject(namespace, first, body).pipe(
    Effect.catchTags({ CasEngineFailed: retry, CasEngineTimedOut: retry })
  );
});
