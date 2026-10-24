import { Data, Effect, Random, Schema } from "effect";
import { CAS_MATH_PATH } from "@/front/route";

/** Warm engine objects that serve concurrent calls; each call picks one at random. */
const CAS_POOL_SIZE = 16;

/** The whole call has this budget, and its one retry gets only the time that is left. */
const CAS_CALL_DEADLINE = "20 seconds";

/** The engine could not answer: its object was overloaded, reset, or failed. */
export class CasEngineFailed extends Data.TaggedError("CasEngineFailed")<{
  readonly overloaded: boolean;
  readonly retryable: boolean;
}> {}

/** The engine did not answer within the call's deadline, so the front stopped waiting. */
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

/** The platform marks a call to an overloaded object with this flag on its error. */
const Overloaded = Schema.Struct({ overloaded: Schema.Literal(true) });

/**
 * The platform marks a transport failure or a reset object with this flag. An
 * overloaded call is never retryable, because its object refused the work.
 */
const Retryable = Schema.Struct({ retryable: Schema.Literal(true) });

/**
 * Sends one bounded body to one object of the pool. The failure records whether
 * the platform allows a retry, so the caller never retries an overloaded object.
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
    catch: (cause) => {
      const overloaded = Schema.is(Overloaded)(cause);
      return new CasEngineFailed({
        overloaded,
        retryable: !overloaded && Schema.is(Retryable)(cause),
      });
    },
  });
});

/**
 * Sends one bounded body to a random object of the pool, within one deadline for
 * the whole call. A retryable failure gets one more call at a different object,
 * and that call gets only the time that is left. A missed deadline is not retried:
 * the engine would run the same heavy work again after the caller stopped waiting.
 * The engine's response reaches the caller unchanged.
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
  return yield* sendToObject(namespace, first, body).pipe(
    Effect.catchTags({
      CasEngineFailed: (failure) =>
        failure.retryable
          ? sendToObject(namespace, second, body)
          : Effect.fail(failure),
    }),
    Effect.timeoutOrElse({
      duration: CAS_CALL_DEADLINE,
      orElse: () => new CasEngineTimedOut({ budget: CAS_CALL_DEADLINE }),
    })
  );
});
