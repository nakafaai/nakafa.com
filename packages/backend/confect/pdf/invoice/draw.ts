import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { INVOICE_COPY } from "@repo/backend/confect/pdf/invoice/copy";
import { InvoiceDocument } from "@repo/backend/confect/pdf/invoice/document";
import { renderPdf } from "@repo/backend/confect/pdf/render";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Effect } from "effect";
import { createElement } from "react";

/** Draws one invoice as an A4 PDF in its own language, issued by Nakafa under its number. */
export const drawInvoicePdf = Effect.fn("pdf.invoice.draw")(function* (
  invoice: typeof InvoiceInput.Type
) {
  const title = INVOICE_COPY[invoice.locale].title;
  return yield* renderPdf(createElement(InvoiceDocument, { invoice }), {
    brand: { _tag: "nakafa" },
    identifier: invoice.number,
    issuer: COMPANY_IDENTITY.legalName,
    language: invoice.locale,
    name: `${title} ${invoice.number}`,
    title,
  });
});
