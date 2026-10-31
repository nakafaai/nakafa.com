import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { INVOICE_COPY } from "@repo/backend/confect/pdf/invoice/copy";
import { InvoiceDocument } from "@repo/backend/confect/pdf/invoice/document";
import { renderPdf } from "@repo/backend/confect/pdf/render";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect } from "effect";
import { createElement } from "react";

/** Draws one invoice as an A4 PDF in its own language. */
export const drawInvoicePdf = Effect.fn("pdf.invoice.draw")(function* (
  invoice: typeof InvoiceInput.Type
) {
  return yield* renderPdf(
    createElement(InvoiceDocument, {
      invoice,
      site: new URL(SITE_ORIGIN).host,
    }),
    {
      language: invoice.locale,
      title: `${INVOICE_COPY[invoice.locale].title} ${invoice.number}`,
    }
  );
});
