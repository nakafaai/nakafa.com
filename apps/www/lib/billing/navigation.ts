import { Effect } from "effect";

interface BillingDestination {
  readonly url: string;
}

interface BillingNavigationInput<E> {
  readonly navigate: (url: string) => void;
  readonly onFailure: (cause: E) => Effect.Effect<void>;
  readonly request: Effect.Effect<BillingDestination, E>;
}

/** Opens a successful billing destination or reports the typed request failure. */
export const billingNavigationProgram = Effect.fn("www.billing.navigate")(
  function* <E>(input: BillingNavigationInput<E>) {
    yield* input.request.pipe(
      Effect.matchEffect({
        onSuccess: (destination) =>
          Effect.sync(() => input.navigate(destination.url)),
        onFailure: input.onFailure,
      })
    );
  }
);
