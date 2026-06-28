import type { PolarCheckoutLocale } from "@repo/backend/convex/customers/checkout/localization";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import type { Locale } from "@repo/utilities/locales";
import { Schema } from "effect";

export const invalidCheckoutSuccessUrlCode = "INVALID_CHECKOUT_SUCCESS_URL";

export interface CheckoutRequestInput {
  readonly locale: Locale;
  readonly successUrl: string;
}

export interface CheckoutRequest {
  readonly locale: Locale;
  readonly polarLocale: PolarCheckoutLocale;
  readonly primaryProductId: string;
  readonly productIds: readonly string[];
  readonly successUrl: string;
}

export class InvalidCheckoutSuccessUrl
  extends Schema.TaggedError<InvalidCheckoutSuccessUrl>()(
    "InvalidCheckoutSuccessUrl",
    {
      code: Schema.Literal(invalidCheckoutSuccessUrlCode),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: typeof invalidCheckoutSuccessUrlCode;
  declare readonly message: string;
}
