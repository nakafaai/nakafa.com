import type { ReactNode } from "react";

/**
 * The body of a student's sitting screen under its bar, in the paper's own column: the screen's parts in one
 * stack, with long words breaking so nothing is cut at the column's edge.
 */
export function SittingBody({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid gap-6 wrap-anywhere" data-slot="sitting-body">
      {children}
    </div>
  );
}

/**
 * One state of a sitting, on the paper with no card around it: what it is, the sentence that says so, and what
 * the student can do or read now.
 */
export function SittingNotice({
  children,
  description,
  title,
}: {
  readonly children?: ReactNode;
  readonly description: string;
  readonly title: string;
}) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}
