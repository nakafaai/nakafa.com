import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function FooterContent({ children, className }: Props) {
  return (
    <section>
      <footer className={cn("relative py-20", className)} data-pagefind-ignore>
        <div className="z-10 mx-auto max-w-3xl px-6">{children}</div>
      </footer>
    </section>
  );
}
