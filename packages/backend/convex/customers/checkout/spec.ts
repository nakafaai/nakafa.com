import type { PolarCheckoutLocale } from "@repo/backend/convex/customers/checkout/localization";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import type { Locale } from "@repo/utilities/locales";
import { Schema } from "effect";

export const invalidCheckoutProductSelectionCode =
  "INVALID_CHECKOUT_PRODUCT_SELECTION";
export const invalidCheckoutSuccessUrlCode = "INVALID_CHECKOUT_SUCCESS_URL";

export interface CheckoutRequestInput {
  readonly customerIpAddress: string | null;
  readonly locale: Locale;
  readonly productIds: readonly string[];
  readonly successUrl: string;
}

export interface CheckoutRequest {
  readonly customerIpAddress: string | null;
  readonly locale: Locale;
  readonly polarLocale: PolarCheckoutLocale;
  readonly primaryProductId: string;
  readonly productIds: readonly string[];
  readonly successUrl: string;
}

export class InvalidCheckoutProductSelection
  extends Schema.TaggedError<InvalidCheckoutProductSelection>()(
    "InvalidCheckoutProductSelection",
    {
      code: Schema.Literal(invalidCheckoutProductSelectionCode),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: typeof invalidCheckoutProductSelectionCode;
  declare readonly message: string;
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
