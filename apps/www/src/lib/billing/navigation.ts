import { Effect, Schema } from "effect";
import { withoutShareToken } from "@/lib/share/fragment";

const BillingDestinationSchema = Schema.Struct({
  url: Schema.String,
});

export type BillingDestination = typeof BillingDestinationSchema.Type;
type BillingNavigate = (url: string) => void;
type BillingFailureHandler<E> = (cause: E) => Effect.Effect<void>;

/**
 * The address a buyer returns to after checkout: the page `href` names, without
 * the share token its fragment may carry. The address goes to the payment
 * processor, and the token opens a chat.
 */
export function checkoutReturnUrl(href: string) {
  const url = new URL(href);
  url.hash = withoutShareToken(url.hash);
  return url.href;
}

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
