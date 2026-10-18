import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

/**
 * One part of a marketing page. Each part is at least as tall as the screen
 * under the header and holds its content in the middle of that height, so a
 * reader sees one thing at a time, and the next part starts below the screen.
 * An anchor link lands the part right under the header. A dark part keeps its
 * band of color from edge to edge, with its content inset like any other.
 */
const sectionVariants = cva(
  "relative isolate grid min-h-[calc(100svh-4rem)] scroll-mt-16 content-center px-6 py-20 lg:px-10 lg:py-32",
  {
    variants: {
      tone: {
        dark: "bg-nina-ink text-nina-face",
        page: "",
      },
    },
    defaultVariants: {
      tone: "page",
    },
  }
);

/** A part of a marketing page, at least one screen tall, its content centred in it. */
export function MarketingSection({
  children,
  id,
  labelledBy,
  tone,
}: {
  children: ReactNode;
  id: string;
  labelledBy?: string;
} & VariantProps<typeof sectionVariants>) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={sectionVariants({ tone })}
      id={id}
    >
      {children}
    </section>
  );
}
