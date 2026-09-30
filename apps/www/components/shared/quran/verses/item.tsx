import { cn } from "cn";
import type { ReactNode } from "react";

/** Frames one Quran verse, so every verse keeps the same spacing and rule. */
export function QuranVerse({
  children,
  isLast,
  number,
}: {
  children: ReactNode;
  isLast: boolean;
  number: number;
}) {
  return (
    <div
      className={cn(
        "mb-6 space-y-6 border-b pb-6 content-auto-quran-verse",
        isLast && "mb-0 border-b-0 pb-0"
      )}
      data-quran-verse={number}
    >
      {children}
    </div>
  );
}

/**
 * Shows a verse's number as its anchor and heading, with the verse's actions
 * composed as children.
 */
export function QuranVerseHeading({
  children,
  id,
  label,
  number,
}: {
  children: ReactNode;
  id: string;
  label: string;
  number: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <a
        className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
        href={`#${id}`}
        id={id}
      >
        <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
          <span className="font-mono text-xs tracking-tighter">{number}</span>
          <h2 className="sr-only">{label}</h2>
        </div>
      </a>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
