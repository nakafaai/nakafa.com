import { BlockArt } from "@repo/design-system/components/ui/block-art";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export function Blocker({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto grid w-full max-w-7xl", className)} {...props}>
      <BlockArt gridRows={4} />
    </div>
  );
}
