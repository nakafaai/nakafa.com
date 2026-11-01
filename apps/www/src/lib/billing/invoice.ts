import { Effect } from "effect";
import { Base64 } from "effect/encoding";

/** Turns one invoice's Base64 bytes into the PDF the browser saves. */
export const invoiceBlob = Effect.fn("billing.invoice.blob")(function* (
  base64: string
) {
  const bytes = yield* Effect.fromResult(Base64.decode(base64));
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
});
