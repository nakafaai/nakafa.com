import { PDF_FONT } from "@repo/backend/confect/pdf/frame";
import type { ReactNode } from "react";
import type {} from "takumi-pdf/primitives";
import { renderSVG } from "uqr";

/** The body of a document: Inter at the size documents read at, one column of sections. */
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <main
      className="text-foreground"
      style={{ fontFamily: PDF_FONT }}
      tw="flex flex-col gap-6 text-[9.5pt] leading-normal"
    >
      {children}
    </main>
  );
}

/** The key facts that open a document, two to a row. */
export function Facts({ children }: { children: ReactNode }) {
  return <section tw="grid grid-cols-2 gap-x-8 gap-y-4">{children}</section>;
}

/** One key fact: its label above its value, and an optional second line. */
export function Fact({
  detail,
  label,
  value,
}: {
  detail?: string | null;
  label: string;
  value: string;
}) {
  return (
    <div style={{ overflowWrap: "anywhere" }} tw="flex min-w-0 flex-col">
      <span className="text-muted-foreground" tw="text-[8pt]">
        {label}
      </span>
      <span tw="font-medium">{value}</span>
      {detail === undefined || detail === null ? null : (
        <span className="text-muted-foreground">{detail}</span>
      )}
    </div>
  );
}

/** A titled part of a document's body. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section style={{ breakInside: "avoid" }} tw="flex flex-col gap-2">
      <h2 tw="text-[10pt] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The column heads of a table, on the muted fill the app's tables use. */
export function TableHead({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-muted text-muted-foreground"
      tw="flex gap-4 rounded-md px-3 py-2 text-[8pt] font-medium"
    >
      {children}
    </div>
  );
}

/** One row of a table: one line, ruled below. */
export function TableRow({ children }: { children: ReactNode }) {
  return (
    <div className="border" tw="flex gap-4 border-b px-3 py-1.5">
      {children}
    </div>
  );
}

/** The closing row of a table, such as a total or an average. */
export function TableTotal({ children }: { children: ReactNode }) {
  return <div tw="flex gap-4 px-3 pt-3 font-semibold">{children}</div>;
}

/** A cell of words that takes the room the other cells leave, cut to one line. */
export function TextCell({ children }: { children: ReactNode }) {
  return <span tw="min-w-0 flex-1 truncate">{children}</span>;
}

/** A cell of a fixed width for a short word, cut to one line. */
export function WordCell({ children }: { children: ReactNode }) {
  return <span tw="w-32 shrink-0 truncate">{children}</span>;
}

/** A cell that counts rows, or stands empty under the count in a closing row. */
export function IndexCell({ children }: { children?: ReactNode }) {
  return <span tw="w-6 shrink-0">{children}</span>;
}

/** A cell of a number or an amount, aligned right on one line. */
export function NumberCell({ children }: { children: ReactNode }) {
  return (
    <span tw="w-32 shrink-0 whitespace-nowrap text-right">{children}</span>
  );
}

/**
 * The check at the foot of a school's document: the QR code of its public
 * check, the note that it is checked by its hash, the hash, and the link.
 */
export function Seal({
  hash,
  link,
  note,
}: {
  hash: string;
  link: string;
  note: string;
}) {
  const code = renderSVG(link, { border: 0, ecc: "M" });
  return (
    <section
      className="text-muted-foreground border"
      style={{ breakInside: "avoid", overflowWrap: "anywhere" }}
      tw="flex items-center gap-4 rounded-md border p-4 text-[8pt]"
    >
      <img
        alt=""
        height={72}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(code)}`}
        tw="size-18 shrink-0"
        width={72}
      />
      <div tw="flex min-w-0 flex-1 flex-col gap-1">
        <span tw="font-medium">{note}</span>
        <span tw="text-[7.5pt]">{hash}</span>
        <span tw="text-[7.5pt]">{link}</span>
      </div>
    </section>
  );
}
