import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Loader } from "lucide-react";

export function LoaderIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <Loader
      className={cn("size-4 animate-spin [animation-duration:2s]", className)}
      {...props}
    />
  );
}
