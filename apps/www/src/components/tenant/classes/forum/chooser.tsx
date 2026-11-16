import { Cancel01Icon, SmileIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { readChunk } from "@repo/design-system/lib/lazy";
import { Array as Arr, Effect, Option } from "effect";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import type { EmojiEntry } from "@/components/tenant/classes/forum/emoji";
import { EmojiPanel } from "@/components/tenant/classes/forum/panel";

/** The emoji the chat ships, once a first intent loaded them. */
type Glyphs = readonly (typeof EmojiEntry.Type)[];

/** Loads the chat's emoji, which ship with the page as a chunk of their own. */
const loadGlyphs = readChunk(
  () => import("@/components/tenant/classes/forum/glyphs")
).pipe(Effect.map((module) => module.GLYPHS));

/** Loads the popover's emoji on a first intent on its button, before the press. */
const WarmContext = createContext<() => void>(() => undefined);

/**
 * An emoji chooser in a popover, as the composer and a message's reactions open it, around the button its caller
 * composes (`EmojiTrigger`, with its tooltip): the emoji load on the first intent on the button, and the popover opens
 * only once they are in, so it never opens empty and never grows after it opened; a tap with no intent before it
 * opens it the moment they arrive. It reads as header, body and footer: its title and the close in the header, `quick`
 * (one press each), the search and the grid in the body, and the active emoji's name in the footer. It opens on the
 * search field for a mouse or the keys, so typing searches at once, and on nothing for a touch, so a phone's keyboard
 * stays down until asked. A pick closes it.
 */
export function EmojiPopover({
  children,
  onPick,
  quick = [],
  side = "bottom",
}: {
  /** The button that opens the chooser, an `EmojiTrigger` in its tooltip. */
  children: ReactNode;
  onPick: (emoji: string) => void;
  /** The emoji offered first, one press each, above the search. */
  quick?: readonly string[];
  side?: "bottom" | "top";
}) {
  const common = useTranslations("Common");
  const [glyphs, setGlyphs] = useState<Option.Option<Glyphs>>(Option.none);
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const load = loadGlyphs.pipe(
    Effect.tap((loaded) => Effect.sync(() => setGlyphs(Option.some(loaded))))
  );

  /** Opens the popover once the emoji are in, or closes it. */
  const change = (next: boolean) => {
    if (!next || Option.isSome(glyphs)) {
      setOpen(next);
      return;
    }
    Effect.runPromise(
      load.pipe(Effect.andThen(Effect.sync(() => setOpen(true))))
    );
  };

  /** Loads the emoji on a first intent, before the press. */
  const warm = () => {
    if (Option.isNone(glyphs)) {
      Effect.runPromise(load);
    }
  };

  /** Gives the chosen emoji and closes the popover. */
  const pick = (emoji: string) => {
    setOpen(false);
    onPick(emoji);
  };

  return (
    <Popover onOpenChange={change} open={open}>
      <WarmContext value={warm}>{children}</WarmContext>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-1rem)] gap-0 p-0"
        initialFocus={(type) =>
          type === "touch"
            ? false
            : (popup.current?.querySelector("input") ?? true)
        }
        ref={popup}
        side={side}
      >
        <header className="flex items-center justify-between gap-2 border-b py-2 ps-3 pe-2">
          <PopoverTitle className="text-sm">{common("emoji")}</PopoverTitle>
          <Button
            onClick={() => setOpen(false)}
            size="icon"
            tooltip={common("close")}
            type="button"
            variant="ghost"
          >
            <HugeIcons icon={Cancel01Icon} />
          </Button>
        </header>
        {Arr.isReadonlyArrayEmpty(quick) ? null : (
          <div className="grid grid-cols-6 justify-items-center border-b p-2">
            {Arr.map(quick, (emoji) => (
              <Button
                className="text-lg"
                key={emoji}
                onClick={() => pick(emoji)}
                size="icon"
                tooltip={emoji}
                type="button"
                variant="ghost"
              >
                {emoji}
              </Button>
            ))}
          </div>
        )}
        {Option.match(glyphs, {
          onNone: () => null,
          onSome: (loaded) => <EmojiPanel glyphs={loaded} onPick={pick} />,
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The button of an `EmojiPopover`, drawn by `render` with the popover's emoji icon. Its first hover or focus loads the
 * emoji, heard in the capture phase, so whatever a tooltip around it hands down keeps its own handlers.
 */
export function EmojiTrigger(props: ComponentProps<typeof PopoverTrigger>) {
  const warm = use(WarmContext);

  return (
    <PopoverTrigger
      {...props}
      onFocusCapture={warm}
      onPointerOverCapture={warm}
    >
      <HugeIcons icon={SmileIcon} />
    </PopoverTrigger>
  );
}
