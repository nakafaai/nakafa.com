import { cn } from "cn";
import type { ComponentProps } from "react";
import { quranFont } from "@/components/shared/quran/font";

export function QuranText({
  children,
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn(quranFont.className, "text-4xl leading-loose", className)}
      dir="rtl"
      lang="ar"
      {...props}
    >
      {children}
    </p>
  );
}
