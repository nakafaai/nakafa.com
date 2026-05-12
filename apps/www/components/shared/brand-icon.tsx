import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";

interface BrandIconProps {
  className?: string;
  src: string;
}

/**
 * Renders an exact static brand mark beside visible text labels.
 */
export function BrandIcon({ className, src }: BrandIconProps) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-4 shrink-0 object-contain", className)}
      height={16}
      src={src}
      unoptimized
      width={16}
    />
  );
}
