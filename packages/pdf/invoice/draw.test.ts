import { describe, expect, it } from "@effect/vitest";
import { drawInvoicePdf } from "@repo/pdf/invoice/draw";
import { Effect, Exit } from "effect";

/** A paid pack, as a learner downloads it. */
const paid = {
  buyer: { email: "raka@example.com", name: "Raka Pratama" },
  dueOn: null,
  issuedOn: "1 November 2026",
  lines: [{ amount: "Rp 59.000", description: "1.000 kredit Nina" }],
  locale: "id",
  number: "py-5c73f11b",
  paidWith: "Xendit",
  status: "paid",
  total: "Rp 59.000",
} as const;

describe("pdf/invoice", () => {
  it.effect(
    "draws a paid invoice as a PDF that names its number in its properties",
    () =>
      Effect.gen(function* () {
        const bytes = yield* drawInvoicePdf(paid);
        const text = new TextDecoder("latin1").decode(bytes);
        expect(text.slice(0, 5)).toBe("%PDF-");
        expect(text).toContain("py-5c73f11b");
      })
  );

  it.effect(
    "draws a school's open invoice, with no address and a due date",
    () =>
      Effect.gen(function* () {
        const bytes = yield* drawInvoicePdf({
          ...paid,
          buyer: { email: null, name: "SMA Harapan" },
          dueOn: "14 November 2026",
          locale: "en",
          paidWith: null,
          status: "open",
        });
        expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe(
          "%PDF-"
        );
      })
  );

  it.effect("draws any learner's name, accented or in Arabic", () =>
    Effect.gen(function* () {
      for (const name of ["Nguyễn Đức", "Şükrü Ğül", "محمد عبد الله"]) {
        const exit = yield* Effect.exit(
          drawInvoicePdf({ ...paid, buyer: { email: null, name } })
        );
        expect(Exit.isSuccess(exit)).toBe(true);
      }
    })
  );

  it.effect(
    "fails with a typed error when a name holds a script no font covers",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(
          drawInvoicePdf({ ...paid, buyer: { email: null, name: "山田太郎" } })
        );
        expect(failure._tag).toBe("PdfRenderError");
      })
  );
});
