import { Data, Effect } from "effect";

interface BillingDestination {
  readonly url: string;
}

interface BillingNavigationInput {
  readonly navigate: (url: string) => void;
  readonly onFailure: (cause: unknown) => Effect.Effect<void>;
  readonly request: () => Promise<BillingDestination>;
}

/** Typed rejection from a checkout or customer-portal request. */
class BillingNavigationError extends Data.TaggedError(
  "BillingNavigationError"
)<{
  readonly cause: unknown;
}> {}

/** Opens a billing destination while containing recoverable request failures. */
export const billingNavigationProgram = Effect.fn("www.billing.navigate")(
  function* (input: BillingNavigationInput) {
    yield* Effect.tryPromise({
      try: input.request,
      catch: (cause) => new BillingNavigationError({ cause }),
    }).pipe(
      Effect.tap((destination) =>
        Effect.sync(() => input.navigate(destination.url))
      ),
      Effect.catchTag("BillingNavigationError", (error) =>
        input.onFailure(error.cause)
      )
    );
  }
);
