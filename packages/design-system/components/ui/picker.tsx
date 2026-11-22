import { Tick01Icon } from "@hugeicons/core-free-icons";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/design-system/components/ui/command";
import {
  HugeIcons,
  OptionIcon,
} from "@repo/design-system/components/ui/huge-icons";
import {
  createPopoverController,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr, HashMap, Option } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { createContext, use, useEffect, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * A search the server answers: the text of the box, which the caller reads its options by, and its change. The
 * picker shows the caller's options as they come and filters nothing itself.
 */
interface ServerSearch {
  readonly onTextChange: (text: string) => void;
  readonly text: string;
}

/** What every part of a picker reads: how it closes, and the server's search, if any. */
interface PickerState {
  readonly search: ServerSearch | undefined;
  readonly setOpen: (open: boolean) => void;
}

const PickerContext = createContext<PickerState | null>(null);

/** The words the search matches each option by, keyed by the option the caller drew it from. */
const PickerLabelsContext = createContext<HashMap.HashMap<unknown, string>>(
  HashMap.empty()
);

/** Reads the picker around a part. Every part renders inside `Picker`, so a missing one is a composition error. */
function usePicker() {
  const picker = use(PickerContext);
  if (picker === null) {
    throw new Error("A picker part requires Picker.");
  }
  return picker;
}

/**
 * One searchable choice among many: a trigger, and the list it opens with a search field at its top. On a wide or a
 * mouse screen the list opens in a popover under the trigger; on a phone it rises from the bottom as a sheet, which
 * closes as every sheet does, by its handle, a swipe or a press outside. Choosing an option closes the picker, and
 * closing it empties a search the server answers, so the next opening starts from the whole list.
 */
function Picker({
  children,
  defaultOpen = false,
  search,
}: {
  children: ReactNode;
  /**
   * Opens the picker as it mounts, for a picker whose code the press that opens it loads. It opens from code, so its
   * search takes the focus, as it does when a press opens it.
   */
  defaultOpen?: boolean | undefined;
  /** The server's search, for a list too long to send at once. Without it the picker filters its own options. */
  search?: ServerSearch | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [controller] = useState(createPopoverController);
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) {
      search?.onTextChange("");
    }
  };

  useEffect(() => {
    if (defaultOpen) {
      controller.setOpen(true);
    }
  }, [controller, defaultOpen]);

  return (
    <PickerContext value={{ search, setOpen: change }}>
      <Popover controller={controller} onOpenChange={change} open={open}>
        {children}
      </Popover>
    </PickerContext>
  );
}

/**
 * The button that opens the picker, which shows what is chosen. It renders the caller's element through `render`,
 * such as an outline Button, so the trigger looks like the field or the header button it stands for.
 */
function PickerTrigger(props: ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger {...props} />;
}

/**
 * The list a picker opens: the search field at the top, then the label and the options under it. The options are the
 * caller's rows, one `PickerItem` each. The popover is as wide as its trigger, and never narrower than a row of
 * options needs; the sheet stands at one height whatever the list holds, so the search field never moves while the
 * list filters. A list with no option says so in one sentence under the search field in place of the label, where the
 * keyboard never covers it, as the palette does, and while the first page of a server's list is read it shows a
 * spinner there instead. A list read a page at a time loads its next page as its end
 * comes into view or into the keys' reach.
 */
function PickerContent<Item>({
  children,
  empty,
  items,
  itemToStringValue,
  label,
  maxLength,
  onEnd,
  placeholder,
  waiting = false,
}: {
  /** Renders one option as a `PickerItem`. */
  children: (item: Item) => ReactNode;
  /** The one sentence the list shows when it holds no option. */
  empty: string;
  items: readonly Item[];
  /** The words the search field matches an option by. */
  itemToStringValue: (item: Item) => string;
  /** The one word, read from a `menu-` key, that names what is chosen. */
  label: string;
  /** The longest text the search field takes. */
  maxLength?: number | undefined;
  /** Loads the next page as the end of the list comes into reach; left out once the list holds every option. */
  onEnd?: (() => void) | undefined;
  /** What the search field shows while empty, which says what to search for. */
  placeholder: string;
  /** Whether the first page of the list is still being read, which shows a spinner in place of `empty`. */
  waiting?: boolean | undefined;
}) {
  const { search } = usePicker();
  const common = useTranslations("Common");
  const labels = HashMap.fromIterable(
    Arr.map(items, (item) => [item, itemToStringValue(item)] as const)
  );

  return (
    <PopoverContent
      align="start"
      className="max-h-[min(var(--available-height),26rem)] w-(--anchor-width) max-w-(--available-width) min-w-72 gap-0 overflow-hidden p-0 data-[presentation=sheet]:h-[calc(var(--visual-viewport-height,100dvh)-3rem)] data-[presentation=sheet]:max-h-none"
    >
      <PickerLabelsContext value={labels}>
        <Command
          {...(search === undefined
            ? {}
            : {
                filter: false,
                onQueryChange: search.onTextChange,
                query: search.text,
              })}
          {...(onEnd === undefined ? {} : { onLoadMore: onEnd })}
          status={waiting ? "loading" : "idle"}
        >
          <CommandInput
            className="h-9"
            clearLabel={common("clear-search")}
            maxLength={maxLength}
            placeholder={placeholder}
          />
          <PopoverTitle className="text-muted-foreground border-t px-3 pt-2.5 pb-0.5 text-xs font-normal has-[+[data-empty]]:sr-only">
            {label}
          </PopoverTitle>
          <CommandEmpty>{waiting ? <Spinner /> : empty}</CommandEmpty>
          <CommandList className="p-1 [[data-presentation=sheet]_&]:p-2">
            {Arr.map(items, children)}
          </CommandList>
        </Command>
      </PickerLabelsContext>
    </PopoverContent>
  );
}

/**
 * One option of a picker: the icon of its kind, the same icon the sidebar or the page uses for it, the caller's words,
 * and a tick on the chosen one, or the option's own value at its end in the tick's place. Choosing it runs the
 * caller's `onSelect`, by pointer, keys or an agent alike, then closes the picker.
 */
function PickerItem({
  children,
  disabled,
  end,
  icon,
  onSelect,
  selected = false,
  value,
}: {
  /** The words of the option, such as a name and a fact under it. */
  children: ReactNode;
  disabled?: boolean | undefined;
  /**
   * What the option ends with, such as an attempt's score. It stands where the tick would, so the end stays one
   * column; the trigger already names the chosen option.
   */
  end?: ReactNode;
  /** The icon of the option's kind: a Hugeicons icon, or an element such as a flag. */
  icon: ComponentProps<typeof OptionIcon>["icon"];
  /** What choosing the option does. */
  onSelect?: (() => void) | undefined;
  /** Whether the option is the chosen one, which shows its tick. */
  selected?: boolean | undefined;
  /** The option the caller drew this row from, among the picker's `items`. */
  value: unknown;
}) {
  const { setOpen } = usePicker();
  const label = Option.getOrUndefined(
    HashMap.get(use(PickerLabelsContext), value)
  );

  return (
    <CommandItem
      className="group/picker-item rounded-sm"
      data-chosen={selected ? "" : undefined}
      disabled={disabled === true}
      size="default"
      {...(label === undefined ? {} : { label })}
      onSelect={() => {
        onSelect?.();
        setOpen(false);
      }}
    >
      <OptionIcon icon={icon} />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {end ?? (
        <HugeIcons
          className="opacity-0 transition-opacity ease-out group-data-chosen/picker-item:opacity-100"
          icon={Tick01Icon}
        />
      )}
    </CommandItem>
  );
}

export { Picker, PickerContent, PickerItem, PickerTrigger };
