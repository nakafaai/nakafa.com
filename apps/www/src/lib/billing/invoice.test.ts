import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { invoiceBlob } from "@/lib/billing/invoice";

describe("billing/invoice", () => {
  it.effect("turns Base64 bytes into a PDF file", () =>
    Effect.gen(function* () {
      const blob = yield* invoiceBlob("JVBERi0=");
      expect(blob.type).toBe("application/pdf");
      expect(blob.size).toBe(5);
    })
  );

  it.effect("fails on bytes that are not Base64", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(invoiceBlob("not base64!"));
      expect(failure).toBeDefined();
    })
  );
});
