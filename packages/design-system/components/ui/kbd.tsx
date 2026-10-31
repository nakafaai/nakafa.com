import { cn } from "cn";

/**
 * One key of a shortcut, on one optical grid: every key of a single glyph takes the same 20px square, and a symbol
 * drawn as an icon stands as tall as the letters' capitals, centred on the same line, so ⌘ and K read as a pair.
 * An 11px icon draws a 9.2px glyph beside the 8.7px capitals of the 12px face, and both centre on the key's middle.
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-muted in-data-[slot=tooltip-content]:bg-background/20 px-1 font-medium font-sans in-data-[slot=tooltip-content]:text-background text-muted-foreground text-xs leading-none dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-2.75",
        className
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
