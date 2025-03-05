import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Particles } from "../ui/particles";

type Props = {
  children: ReactNode;
  className?: string;
};

export function FooterContent({ children, className }: Props) {
  return (
    <footer
      data-pagefind-ignore
      className={cn("relative mt-10 border-t pt-10 pb-20", className)}
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-50" />
      <div className="z-10 mx-auto max-w-3xl px-4">{children}</div>
    </footer>
  );
}
