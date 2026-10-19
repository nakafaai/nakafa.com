import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { runtime, type ServerServices } from "@/lib/server/runtime";

/** How one server effect ends at the framework boundary. */
interface RunServerOptions<E, M> {
  /** Turns a typed failure into the value the router or the client receives. */
  readonly mapFailure?: ((error: E) => M) | undefined;
  /** Stops the effect when the request is aborted. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * Runs one server effect on the runtime and returns its value. The runtime
 * rejects with the failure, after `mapFailure` maps a typed failure, and with a
 * defect as it was raised. So a value such as a TanStack `notFound()` or
 * `redirect()` reaches the router unchanged.
 */
export function runServerEffect<A, E, M = never>(
  effect: Effect.Effect<A, E, ServerServices>,
  options: RunServerOptions<E, M> = {}
): Promise<A> {
  const mapped: Effect.Effect<A, E | M, ServerServices> =
    options.mapFailure === undefined
      ? effect
      : Effect.mapError(effect, options.mapFailure);
  return runtime.runPromise(mapped, { signal: options.signal });
}

/**
 * Adapts a server effect into the handler of a TanStack server function. Write
 * the validator at the call site, where the input type is concrete, because
 * TanStack's validator types do not accept a generic Standard Schema:
 *
 * ```ts
 * createServerFn({ method: "GET" })
 *   .validator(Schema.toStandardSchemaV1(Input))
 *   .handler(serverHandler((data: typeof Input.Type) => readThing(data)));
 * ```
 *
 * The request signal stops the effect when the visitor leaves.
 */
export function serverHandler<Data, A, E, M = never>(
  run: (data: Data) => Effect.Effect<A, E, ServerServices>,
  options: Omit<RunServerOptions<E, M>, "signal"> = {}
) {
  return ({ data }: { readonly data: Data }) =>
    runServerEffect(run(data), {
      ...options,
      signal: getRequest().signal,
    });
}
