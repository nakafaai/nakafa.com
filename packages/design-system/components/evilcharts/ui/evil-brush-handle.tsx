import type { BrushPointerBindings } from "@repo/design-system/components/evilcharts/ui/evil-brush-drag";
import { cn } from "cn";

interface EvilBrushHandleProps {
  bind: BrushPointerBindings;
  label?: string | undefined;
  position: string;
  side: "left" | "right";
}

/** Renders one draggable range edge and its optional hover label. */
function EvilBrushHandle({
  side,
  position,
  label,
  bind,
}: EvilBrushHandleProps) {
  const isLeft = side === "left";

  return (
    <div className="absolute inset-y-0 z-10" style={{ left: position }}>
      <div
        className={cn(
          "group absolute inset-y-0 flex w-3 cursor-ew-resize touch-none items-center justify-center after:absolute after:inset-y-0 after:-left-4 after:w-11 after:content-['']",
          isLeft ? "" : "-translate-x-full"
        )}
        {...bind}
      >
        <div
          className={cn(
            "bg-muted-foreground group-hover:bg-foreground relative flex h-4 w-1.5 items-center justify-center rounded-md transition-colors",
            isLeft ? "-left-1.5" : "-right-1.5"
          )}
        >
          <div className="flex flex-col gap-0.5">
            <div className="bg-background/70 h-0.5 w-0.5 rounded-full" />
            <div className="bg-background/70 h-0.5 w-0.5 rounded-full" />
            <div className="bg-background/70 h-0.5 w-0.5 rounded-full" />
          </div>
        </div>
      </div>

      {label && (
        <div
          className={cn(
            "bg-foreground text-background pointer-events-none absolute -bottom-3 -translate-y-1/2 rounded-[3px] px-1 py-px text-[8px] leading-tight font-medium whitespace-nowrap opacity-0 group-hover:opacity-100",
            isLeft ? "left-1.5" : "right-1.5"
          )}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export { EvilBrushHandle };
