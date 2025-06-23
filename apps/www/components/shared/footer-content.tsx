import { Particles } from "@repo/design-system/components/ui/particles";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function FooterContent({ children, className }: Props) {
  return (
    <section>
      <footer
        className={cn("relative mt-10 pt-10 pb-20", className)}
        data-pagefind-ignore
      >
        <Particles
          className="pointer-events-none absolute inset-0 opacity-80"
          quantity={25}
        />
        <div className="z-10 mx-auto max-w-3xl px-6">{children}</div>
      </footer>
    </section>
  );
}
