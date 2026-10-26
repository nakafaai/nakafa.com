import { Ref } from "@confect/core";
import { ConvexClient } from "convex/browser";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Deferred, Effect, Schema } from "effect";

/** A call that the Convex client failed, with no typed error of its function to decode. */
export class WireFailed extends Schema.TaggedError<WireFailed>()("WireFailed", {
  message: Schema.String,
}) {}

/** The failure of a call that its function's typed errors do not name. */
const wireFailed = (error: unknown) =>
  new WireFailed({
    message: error instanceof Error ? error.message : "The call failed.",
  });

/** Encoded arguments, as Convex takes them: an object of field values. */
const argsOf = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.Unknown)
);

/**
 * The calls of a Convex client that a load test student or proctor makes, as one browser tab
 * of the player makes them: a mutation, a live query, and closing the connection.
 */
export interface Wire {
  readonly close: () => Promise<void>;
  readonly mutation: (
    reference: FunctionReference<"mutation">,
    args: DefaultFunctionArgs
  ) => Promise<unknown>;
  readonly onUpdate: (
    reference: FunctionReference<"query">,
    args: DefaultFunctionArgs,
    onValue: (value: unknown) => void,
    onError: (error: Error) => void
  ) => () => void;
}

/**
 * Opens one WebSocket connection to the deployment at `address`, signed in through `token`,
 * which Convex asks again before the token expires. The connection closes with its scope.
 */
export const openWire = Effect.fn("load.wire.open")(function* (
  address: string,
  token: Effect.Effect<string>
) {
  return yield* Effect.acquireRelease(
    Effect.sync(() => {
      const client = new ConvexClient(address, {
        skipConvexDeploymentUrlCheck: true,
        unsavedChangesWarning: false,
      });
      // Convex owns the callback that asks for a token, so the token's effect runs here.
      client.setAuth(() => Effect.runPromise(token));
      return client satisfies Wire;
    }),
    (client) => Effect.promise(() => client.close())
  );
});

/**
 * Runs one mutation through the wire with its function's codec: the arguments are encoded,
 * and the reply is decoded into the function's return value or its typed error.
 */
export const send = <Ref_ extends Ref.AnyPublicMutation>(
  wire: Wire,
  ref: Ref_,
  args: Ref.Args<Ref_>
) =>
  Ref.runWithCodec(
    ref,
    args,
    (reference, encoded) => wire.mutation(reference, argsOf(encoded)),
    wireFailed
  ).pipe(Effect.catchTag("SchemaError", Effect.die));

/**
 * Keeps one live query open through the wire for the rest of the scope, and returns a
 * deferred that its first value or typed error completes. `onValue` sees every value,
 * the first one included, as the server sends it.
 */
export const watch = Effect.fn("load.wire.watch")(function* <
  Ref_ extends Ref.AnyPublicQuery,
>(
  wire: Wire,
  ref: Ref_,
  args: Ref.Args<Ref_>,
  onValue: (value: Ref.Returns<Ref_>) => void
) {
  const first = yield* Deferred.make<Ref.Returns<Ref_>, unknown>();
  const encoded = argsOf(Ref.encodeArgsSync(ref, args));
  yield* Effect.acquireRelease(
    Effect.sync(() =>
      wire.onUpdate(
        Ref.getFunctionReference(ref),
        encoded,
        (value) => {
          const decoded = Ref.decodeReturnsSync(ref, value);
          Deferred.doneUnsafe(first, Effect.succeed(decoded));
          onValue(decoded);
        },
        (error) => {
          Deferred.doneUnsafe(
            first,
            Effect.fail(Ref.decodeErrorOrElse(ref, wireFailed)(error))
          );
        }
      )
    ),
    (unsubscribe) => Effect.sync(unsubscribe)
  );
  return first;
});
