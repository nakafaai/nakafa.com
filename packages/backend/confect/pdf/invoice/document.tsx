import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { INVOICE_COPY } from "@repo/backend/confect/pdf/invoice/copy";
import { Field, Sheet } from "@repo/backend/confect/pdf/parts";
import { PDF_AUTHOR } from "@repo/backend/confect/pdf/render";
import { Array as Arr } from "effect";
import type {} from "takumi-pdf/primitives";

/** An invoice of Nakafa: who sells, who it bills, what it bills, and how it stands. */
export function InvoiceDocument({
  invoice,
  site,
}: {
  invoice: typeof InvoiceInput.Type;
  site: string;
}) {
  const copy = INVOICE_COPY[invoice.locale];

  return (
    <Sheet>
      <header tw="flex items-start justify-between gap-6">
        <div tw="flex flex-col gap-1">
          <h1 tw="text-[16pt] font-semibold">Nakafa</h1>
          <span tw="text-gray-500">{PDF_AUTHOR}</span>
          <span tw="text-gray-500">{site}</span>
        </div>
        <div tw="flex flex-col items-end gap-1">
          <h2 tw="text-[16pt] font-semibold">{copy.title}</h2>
          <span tw="text-gray-500">{invoice.number}</span>
        </div>
      </header>
      <section tw="flex flex-col gap-1">
        <span tw="text-gray-500">{copy.billedTo}</span>
        <span tw="font-medium">{invoice.buyer.name}</span>
        {invoice.buyer.email === null ? null : (
          <span>{invoice.buyer.email}</span>
        )}
      </section>
      <section tw="flex flex-col">
        <div tw="flex justify-between border-b border-gray-200 pb-2 font-medium">
          <span>{copy.item}</span>
          <span>{copy.amount}</span>
        </div>
        {Arr.map(invoice.lines, (line) => (
          <div
            key={line.description}
            tw="flex justify-between gap-6 border-b border-gray-200 py-3"
          >
            <span>{line.description}</span>
            <span tw="text-right">{line.amount}</span>
          </div>
        ))}
        <div tw="flex justify-between pt-3 font-semibold">
          <span>{copy.total}</span>
          <span>{invoice.total}</span>
        </div>
      </section>
      <section tw="flex flex-col">
        <Field label={copy.date} value={invoice.issuedOn} />
        {invoice.dueOn === null ? null : (
          <Field label={copy.due} value={invoice.dueOn} />
        )}
        {invoice.paidWith === null ? null : (
          <Field label={copy.paidWith} value={invoice.paidWith} />
        )}
        <Field label={copy.status} value={copy[invoice.status]} />
      </section>
    </Sheet>
  );
}
