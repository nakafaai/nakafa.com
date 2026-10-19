"use client";

import {
  CodeSquareIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
  TableIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import type {
  SlashKey,
  SlashLabels,
} from "@repo/design-system/components/editor/slash";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import {
  type ComponentProps,
  type Ref,
  useImperativeHandle,
  useState,
} from "react";

/** The keys that the menu answers, which the suggestion passes it for each key the writer presses. */
export interface SlashMenuHandle {
  /** Moves the selection with the arrow keys and inserts the selected block with Enter. Returns whether it used the key. */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** What the menu shows for one query: the blocks that match it, in order, and the names of the blocks. */
export interface SlashMenuProps {
  /** The blocks that match the query, in the order the menu lists them. */
  items: readonly SlashKey[];
  /** The accessible name of the list of blocks. */
  label: string;
  /** The names of the blocks, in the reader's language. */
  labels: SlashLabels;
  /** The handle of the menu, which the suggestion calls for each key the writer presses. */
  ref?: Ref<SlashMenuHandle>;
  /** Inserts the block the writer picked. */
  select: (key: SlashKey) => void;
}

/** The icon of each block. */
const ICONS: Record<SlashKey, ComponentProps<typeof HugeIcons>["icon"]> = {
  bullets: LeftToRightListBulletIcon,
  "code-block": CodeSquareIcon,
  "heading-1": Heading01Icon,
  "heading-2": Heading02Icon,
  "heading-3": Heading03Icon,
  numbers: LeftToRightListNumberIcon,
  quote: QuoteDownIcon,
  table: TableIcon,
  text: TextIcon,
};

/**
 * The list of blocks that the slash command offers under the query. The arrow keys move the
 * selection and Enter picks it, while a press picks the block under the pointer. The menu
 * takes no focus: the editor keeps the caret, so the query goes on being typed. It draws
 * nothing while no block matches.
 */
export function SlashMenu({
  items,
  label,
  labels,
  ref,
  select,
}: SlashMenuProps) {
  const [chosen, setChosen] = useState(0);
  const selected = Math.min(chosen, Math.max(items.length - 1, 0));

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) {
        return false;
      }
      if (event.key === "ArrowDown") {
        setChosen((selected + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setChosen((selected + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const picked = Arr.get(items, selected);
        if (Option.isSome(picked)) {
          select(picked.value);
        }
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={label}
      className="z-50 max-h-72 w-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      role="listbox"
    >
      {Arr.map(items, (key, index) => (
        <button
          aria-selected={index === selected}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm",
            index === selected && "bg-accent text-accent-foreground"
          )}
          key={key}
          onClick={() => select(key)}
          // The press must not take the focus from the text, or the query would
          // lose its caret for a moment.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setChosen(index)}
          role="option"
          type="button"
        >
          <HugeIcons icon={ICONS[key]} />
          {labels[key]}
        </button>
      ))}
    </div>
  );
}
