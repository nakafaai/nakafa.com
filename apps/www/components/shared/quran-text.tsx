import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export function QuranText({
  children,
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("font-quran text-4xl leading-loose", className)}
      dir="rtl"
      lang="ar"
      {...props}
    >
      {children}
    </p>
  );
}
