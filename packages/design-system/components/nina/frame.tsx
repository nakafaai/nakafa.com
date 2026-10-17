import type { Mode } from "@repo/mascot/nina/options";
import { cn } from "cn";
import type { ComponentProps } from "react";

type FrameProps = ComponentProps<"span"> & {
  /** How much of her shows. Over an edge, whatever goes down behind the edge is hidden. */
  mode: Mode;
};

/**
 * The box that holds her, exactly as large as her picture. Over an edge it
 * hides what goes down behind the edge. In a tile it is a circle, as every face
 * of a person or of Nina is, so no caller can show her tile as a square.
 */
export function Frame({ children, mode, ...props }: FrameProps) {
  return (
    <span
      className={cn(
        "block w-fit",
        mode === "peek" && "overflow-hidden",
        mode === "tile" && "overflow-hidden rounded-full"
      )}
      {...props}
    >
      {children}
    </span>
  );
}
