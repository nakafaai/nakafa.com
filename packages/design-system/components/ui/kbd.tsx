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
        "bg-muted in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background text-muted-foreground dark:in-data-[slot=tooltip-content]:bg-background/10 pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs leading-none font-medium select-none [&_svg:not([class*='size-'])]:size-2.75",
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
