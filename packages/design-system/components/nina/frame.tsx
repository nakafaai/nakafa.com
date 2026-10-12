import { cn } from "cn";
import type { ComponentProps } from "react";

type FrameProps = ComponentProps<"span"> & {
  /** Whether she looks over an edge, which hides whatever goes down behind it. */
  edge: boolean;
};

/** The box that holds her, exactly as large as her picture. */
export function Frame({ children, edge, ...props }: FrameProps) {
  return (
    <span className={cn("block w-fit", edge && "overflow-hidden")} {...props}>
      {children}
    </span>
  );
}
