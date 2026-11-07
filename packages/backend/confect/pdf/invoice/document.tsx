import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { INVOICE_COPY } from "@repo/backend/confect/pdf/invoice/copy";
import {
  Fact,
  Facts,
  NumberCell,
  Sheet,
  TableHead,
  TableRow,
  TableTotal,
  TextCell,
} from "@repo/backend/confect/pdf/parts";
import { Array as Arr } from "effect";
import type {} from "takumi-pdf/primitives";

/**
 * The body of a Nakafa invoice: who it bills and how it stands, one line per
 * item with its amount, and the total under the amounts.
 */
export function InvoiceDocument({
  invoice,
}: {
  invoice: typeof InvoiceInput.Type;
}) {
  const copy = INVOICE_COPY[invoice.locale];

  return (
    <Sheet>
      <Facts>
        <Fact
          detail={invoice.buyer.email}
          label={copy.billedTo}
          value={invoice.buyer.name}
        />
        <Fact label={copy.status} value={copy[invoice.status]} />
        <Fact label={copy.date} value={invoice.issuedOn} />
        {invoice.dueOn === null ? null : (
          <Fact label={copy.due} value={invoice.dueOn} />
        )}
        {invoice.paidWith === null ? null : (
          <Fact label={copy.paidWith} value={invoice.paidWith} />
        )}
      </Facts>
      <section tw="flex flex-col">
        <TableHead>
          <TextCell>{copy.item}</TextCell>
          <NumberCell>{copy.amount}</NumberCell>
        </TableHead>
        {Arr.map(invoice.lines, (line) => (
          <TableRow key={line.description}>
            <TextCell>{line.description}</TextCell>
            <NumberCell>{line.amount}</NumberCell>
          </TableRow>
        ))}
        <TableTotal>
          <TextCell>{copy.total}</TextCell>
          <NumberCell>{invoice.total}</NumberCell>
        </TableTotal>
      </section>
    </Sheet>
  );
}
