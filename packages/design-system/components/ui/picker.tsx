import type { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { Search02Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@repo/design-system/components/ui/autocomplete";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import {
  HugeIcons,
  OptionIcon,
} from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { cva } from "class-variance-authority";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";

/** Where a picker's list opens: a popover under its trigger on a wide screen, a drawer on a phone. */
type Surface = "drawer" | "popover";

/**
 * A search the server answers: the text of the box, which the caller reads its options by, and its change. The
 * picker shows the caller's options as they come and filters nothing itself.
 */
interface ServerSearch {
  readonly onTextChange: (text: string) => void;
  readonly text: string;
}

/** What every part of a picker reads: where its list opens, how it closes, and the server's search, if any. */
interface PickerState {
  readonly search: ServerSearch | undefined;
  readonly setOpen: (open: boolean) => void;
  readonly surface: Surface;
}

const PickerContext = createContext<PickerState | null>(null);

/** Reads the picker around a part. Every part renders inside `Picker`, so a missing one is a composition error. */
function usePicker() {
  const picker = use(PickerContext);
  if (picker === null) {
    throw new Error("A picker part requires Picker.");
  }
  return picker;
}

const pickerSearchVariants = cva("", {
  variants: {
    surface: {
      drawer: "shrink-0 px-4 pb-3",
      popover: "shrink-0",
    },
  },
});

const pickerInputVariants = cva("", {
  variants: {
    surface: {
      drawer: "",
      popover:
        "focus-visible:border-border rounded-none border-x-0 border-t-0 border-b shadow-none focus-visible:ring-0",
    },
  },
});

const pickerScrollVariants = cva("", {
  variants: {
    surface: {
      drawer: "flex-1",
      popover: "max-h-72",
    },
  },
});

const pickerLabelVariants = cva("text-muted-foreground text-xs", {
  variants: {
    surface: {
      drawer: "px-4 pt-1 pb-1",
      popover: "px-3 pt-2.5 pb-0.5",
    },
  },
});

const pickerListVariants = cva("", {
  variants: {
    surface: {
      drawer: "p-2 not-empty:p-2",
      popover: "p-1 not-empty:p-1",
    },
  },
});

const pickerItemVariants = cva("group/picker-item text-sm sm:text-sm", {
  variants: {
    surface: {
      drawer: "min-h-11 py-2 sm:min-h-11",
      popover: "min-h-8 py-1.5 sm:min-h-8",
    },
  },
});

/**
 * One searchable choice among many: a trigger, and the list it opens with a search field at its top. On a wide
 * screen the list opens in a popover under the trigger; on a phone it opens in a drawer, which closes by its handle,
 * a swipe or a press outside, as every drawer does. Choosing an option closes the picker, and closing it empties a
 * search the server answers, so the next opening starts from the whole list.
 *
 * The screen's width is read through the browser's media query as an external store, so a picker the server renders
 * hydrates as the drawer the server drew, then becomes the popover on a wide screen before the first paint.
 */
function Picker({
  children,
  search,
}: {
  children: ReactNode;
  /** The server's search, for a list too long to send at once. Without it the picker filters its own options. */
  search?: ServerSearch | undefined;
}) {
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp, {});
  const [open, setOpen] = useState(false);
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) {
      search?.onTextChange("");
    }
  };
  const state = {
    search,
    setOpen: change,
    surface: isDesktop ? "popover" : "drawer",
  } satisfies PickerState;

  if (isDesktop) {
    return (
      <PickerContext value={state}>
        <Popover onOpenChange={change} open={open}>
          {children}
        </Popover>
      </PickerContext>
    );
  }
  return (
    <PickerContext value={state}>
      <Drawer onOpenChange={change} open={open}>
        {children}
      </Drawer>
    </PickerContext>
  );
}

/**
 * The button that opens the picker, which shows what is chosen. It renders the caller's element through `render`,
 * such as an outline Button, so the trigger looks like the field or the header button it stands for.
 */
function PickerTrigger(
  props: Omit<
    PopoverPrimitive.Trigger.Props,
    "closeDelay" | "delay" | "handle" | "openOnHover" | "payload"
  >
) {
  const { surface } = usePicker();
  if (surface === "popover") {
    return <PopoverTrigger data-slot="picker-trigger" {...props} />;
  }
  return <DrawerTrigger data-slot="picker-trigger" {...props} />;
}

/**
 * The popover or the drawer the list opens in. The popover is as wide as its trigger, and never narrower than a
 * row of options needs. The drawer stands at one height whatever the list holds, so the search field never moves
 * while the list filters; a keyboard that opens over it leaves the rows room to scroll above it. A press focuses the
 * search field, and a touch focuses the drawer itself, so no keyboard covers the list before the learner asks for it.
 */
function PickerSurface({ children }: { children: ReactNode }) {
  const { surface } = usePicker();
  const body = useRef<HTMLDivElement>(null);

  if (surface === "popover") {
    return (
      <PopoverContent
        align="start"
        className="w-(--anchor-width) max-w-(--available-width) min-w-72 gap-0 p-0"
      >
        {children}
      </PopoverContent>
    );
  }
  return (
    <DrawerPrimitive.VirtualKeyboardProvider>
      <DrawerContent
        className="[--drawer-content-height:calc(100dvh-6rem)]"
        initialFocus={(type) => (type === "touch" ? body.current : true)}
      >
        <div
          className="flex min-h-0 flex-1 flex-col outline-none"
          ref={body}
          tabIndex={-1}
        >
          {children}
        </div>
      </DrawerContent>
    </DrawerPrimitive.VirtualKeyboardProvider>
  );
}

/** The one word over the options that names what is chosen, which also names the popover or the drawer. */
function PickerLabel({ children }: { children: string }) {
  const { surface } = usePicker();
  if (surface === "popover") {
    return (
      <PopoverPrimitive.Title className={pickerLabelVariants({ surface })}>
        {children}
      </PopoverPrimitive.Title>
    );
  }
  return (
    <DrawerPrimitive.Title className={pickerLabelVariants({ surface })}>
      {children}
    </DrawerPrimitive.Title>
  );
}

/**
 * The list a picker opens: the search field at the top, then the label and the options under it. The options are
 * the caller's rows, one `PickerItem` each. A list with no option says so in one sentence, in the middle of the
 * list, and while the first page of a server's list is read it shows a spinner instead. A list read a page at a
 * time loads its next page as its end comes into view.
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
  /** The text the search field matches an option by, and reads aloud for it. */
  itemToStringValue: (item: Item) => string;
  /** The one word, read from a `menu-` key, that names what is chosen. */
  label: string;
  /** The longest text the search field takes. */
  maxLength?: number | undefined;
  /** Loads the next page as the end of the list comes into view; left out once the list holds every option. */
  onEnd?: (() => void) | undefined;
  /** What the search field shows while empty, which says what to search for. */
  placeholder: string;
  /** Whether the first page of the list is still being read, which shows a spinner in place of `empty`. */
  waiting?: boolean | undefined;
}) {
  const { search, surface } = usePicker();
  const common = useTranslations("Common");

  return (
    <PickerSurface>
      <Autocomplete
        autoHighlight="always"
        filter={search === undefined ? undefined : null}
        inline
        items={items}
        itemToStringValue={itemToStringValue}
        keepHighlight
        onValueChange={search?.onTextChange}
        open
        value={search?.text}
      >
        <div className={pickerSearchVariants({ surface })}>
          <AutocompleteInput
            className={pickerInputVariants({ surface })}
            clearLabel={common("clear-search")}
            enterKeyHint="search"
            maxLength={maxLength}
            placeholder={placeholder}
            showClear
            size={surface === "drawer" ? "lg" : "default"}
            startAddon={<HugeIcons className="size-4" icon={Search02Icon} />}
          />
        </div>
        <ScrollArea
          axis="vertical"
          className={pickerScrollVariants({ surface })}
          scrollFade
        >
          <PickerLabel>{label}</PickerLabel>
          <AutocompleteList
            className={pickerListVariants({ surface })}
            scrollArea={false}
          >
            {children}
          </AutocompleteList>
          <AutocompleteEmpty className="not-empty:flex not-empty:justify-center not-empty:px-4 not-empty:py-6">
            {waiting ? <Spinner className="size-4" /> : empty}
          </AutocompleteEmpty>
          {onEnd === undefined ? null : <Intersection onIntersect={onEnd} />}
        </ScrollArea>
      </Autocomplete>
    </PickerSurface>
  );
}

/**
 * One option of a picker: the icon of its kind, the same icon the sidebar or the page uses for it, the caller's words,
 * and a tick on the chosen one. Choosing it runs the caller's `onClick`, then closes the picker.
 */
function PickerItem({
  children,
  icon,
  onClick,
  selected = false,
  ...props
}: Pick<AutocompletePrimitive.Item.Props, "disabled" | "onClick" | "value"> & {
  /** The words of the option, such as a name and a fact under it. */
  children: ReactNode;
  /** The icon of the option's kind: a Hugeicons icon, or an element such as a flag. */
  icon: ComponentProps<typeof OptionIcon>["icon"];
  /** Whether the option is the chosen one, which shows its tick. */
  selected?: boolean | undefined;
}) {
  const { setOpen, surface } = usePicker();

  return (
    <AutocompleteItem
      className={pickerItemVariants({ surface })}
      data-chosen={selected ? "" : undefined}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      {...props}
    >
      <OptionIcon icon={icon} />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <HugeIcons
        className="size-4 opacity-0 transition-opacity ease-out group-data-chosen/picker-item:opacity-100"
        icon={Tick01Icon}
      />
    </AutocompleteItem>
  );
}

export { Picker, PickerContent, PickerItem, PickerTrigger };
