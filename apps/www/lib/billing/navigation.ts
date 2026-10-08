import { Effect, Schema } from "effect";

const BillingDestinationSchema = Schema.Struct({
  url: Schema.String,
});

type BillingDestination = typeof BillingDestinationSchema.Type;
type BillingNavigate = (url: string) => void;
type BillingFailureHandler<E> = (cause: E) => Effect.Effect<void>;

/** Opens a successful billing destination or reports the typed request failure. */
export const billingNavigationProgram = Effect.fn("www.billing.navigate")(
  function* <E>(input: {
    readonly navigate: BillingNavigate;
    readonly onFailure: BillingFailureHandler<E>;
    readonly request: Effect.Effect<BillingDestination, E>;
  }) {
    yield* input.request.pipe(
      Effect.matchEffect({
        onSuccess: (destination) =>
          Effect.sync(() => input.navigate(destination.url)),
        onFailure: input.onFailure,
      })
    );
  }
);
