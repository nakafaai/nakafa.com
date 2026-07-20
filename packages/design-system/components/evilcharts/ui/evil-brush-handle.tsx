import type { BrushPointerBindings } from "@repo/design-system/components/evilcharts/ui/evil-brush-drag";
import { cn } from "@repo/design-system/lib/utils";

interface EvilBrushHandleProps {
  bind: BrushPointerBindings;
  label?: string;
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
            "relative flex h-4 w-1.5 items-center justify-center rounded-md bg-muted-foreground transition-colors group-hover:bg-foreground",
            isLeft ? "-left-1.5" : "-right-1.5"
          )}
        >
          <div className="flex flex-col gap-0.5">
            <div className="h-0.5 w-0.5 rounded-full bg-background/70" />
            <div className="h-0.5 w-0.5 rounded-full bg-background/70" />
            <div className="h-0.5 w-0.5 rounded-full bg-background/70" />
          </div>
        </div>
      </div>

      {label && (
        <div
          className={cn(
            "pointer-events-none absolute -bottom-3 -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-foreground px-1 py-px font-medium text-[8px] text-background leading-tight opacity-0 group-hover:opacity-100",
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
