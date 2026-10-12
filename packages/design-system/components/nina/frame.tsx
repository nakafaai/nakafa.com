import type { Mode } from "@repo/mascot/nina/options";
import { cn } from "cn";
import type { ComponentProps } from "react";

type FrameProps = ComponentProps<"span"> & {
  /** How much of her shows. Over an edge, whatever goes down behind the edge is hidden. */
  mode: Mode;
};

/** The box that holds her, exactly as large as her picture. */
export function Frame({ children, mode, ...props }: FrameProps) {
  return (
    <span
      className={cn("block w-fit", mode === "peek" && "overflow-hidden")}
      {...props}
    >
      {children}
    </span>
  );
}
