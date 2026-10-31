import "takumi-pdf/primitives";
import { PDF_FONT } from "@repo/pdf/render";
import type { ReactNode } from "react";
import { renderSVG } from "uqr";

/** One page of a document: Inter at the size documents read at. */
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <main
      style={{ fontFamily: PDF_FONT }}
      tw="flex flex-col gap-6 text-[10pt] text-gray-900"
    >
      {children}
    </main>
  );
}

/** A label and its value on one line. */
export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div tw="flex justify-between gap-6 py-1">
      <span tw="text-gray-500">{label}</span>
      <span tw="text-right">{value}</span>
    </div>
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
    <footer tw="mt-auto flex items-center gap-4 pt-6 text-[8pt] text-gray-500">
      <img
        alt=""
        height={80}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(code)}`}
        tw="size-20"
        width={80}
      />
      <div tw="flex min-w-0 flex-col gap-1">
        <span>{note}</span>
        <span>{hash}</span>
        <span>{link}</span>
      </div>
    </footer>
  );
}
