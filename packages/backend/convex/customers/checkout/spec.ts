import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { Schema } from "effect";

export const invalidCheckoutProductSelectionCode =
  "INVALID_CHECKOUT_PRODUCT_SELECTION";
export const invalidCheckoutSuccessUrlCode = "INVALID_CHECKOUT_SUCCESS_URL";

export interface CheckoutRequestInput {
  readonly productIds: readonly string[];
  readonly successUrl: string;
}

export interface CheckoutRequest {
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
