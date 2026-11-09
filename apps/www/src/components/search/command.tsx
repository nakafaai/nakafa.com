import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Option, Result } from "effect";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useDeferredValue,
  useLayoutEffect,
  useState,
  useTransition,
} from "react";
import { useLocale, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { CommandKeys } from "@/components/search/keys";
import {
  type PaletteGroup,
  type PaletteRow,
  SearchRow,
  usePaletteGroups,
} from "@/components/search/rows";
import { SEARCH_TARGET } from "@/lib/routing/target";
import { useSearch } from "@/lib/search/context";
import type { SearchEntry } from "@/lib/search/entry";
import {
  readSearchIndex,
  type SearchIndexUnavailable,
} from "@/lib/search/load";
import { createRecentStore } from "@/lib/search/recent";

/**
 * The global command palette: every page Nakafa publishes in the reader's
 * language, searched in the browser from one static index that the build wrote.
 * The palette mounts when the reader shows intent, so the index is read once,
 * before the press that opens it, and nothing is read per keystroke.
 */
export function SearchCommand() {
  const locale = useLocale();
  return (
    <SearchIndex key={locale}>
      <SearchDialog />
    </SearchIndex>
  );
}

/** What reading the index of the locale settled with. */
type IndexAnswer = Result.Result<
  Effect.Success<ReturnType<typeof readSearchIndex>>,
  SearchIndexUnavailable
>;

/** The read of the locale's index, which the palette's body waits for. */
const SearchIndexContext = createContext<Promise<IndexAnswer> | null>(null);

/**
 * Starts reading the index of one locale, once. It sits above the dialog, so a
 * phone's drawer, whose body leaves when it closes, never reads the index again.
 */
function SearchIndex({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [answer] = useState(() =>
    Effect.runPromise(
      Effect.result(readSearchIndex(window.location.origin, locale))
    )
  );
  return <SearchIndexContext value={answer}>{children}</SearchIndexContext>;
}

/** The dialog, or the phone's drawer, that holds the palette. */
function SearchDialog() {
  const t = useTranslations("Utils");
  const tCommon = useTranslations("Common");
  const { open, setOpen } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
  }));

  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [setOpen]
  );

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandDialogPopup
        description={t("search-description")}
        initialFocus
        portalProps={{ keepMounted: true }}
        title={tCommon("search")}
      >
        <Suspense fallback={<SearchPalette answer={Option.none()} />}>
          <SearchSettled />
        </Suspense>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

/** The palette once the index has settled. */
function SearchSettled() {
  const answer = use(SearchIndexContext);
  if (answer === null) {
    throw new Error("SearchSettled must be used within SearchIndex");
  }
  return <SearchPalette answer={Option.some(use(answer))} />;
}

/** The search box, its groups of rows, and the keys at its foot. */
function SearchPalette({ answer }: { answer: Option.Option<IndexAnswer> }) {
  const t = useTranslations("Utils");
  const tCommon = useTranslations("Common");
  const query = useSearch((state) => state.query);
  const setQuery = useSearch((state) => state.setQuery);
  const setOpen = useSearch((state) => state.setOpen);
  const navigate = useNavigate();
  const [recentStore] = useState(createRecentStore);
  const remember = useStore(recentStore, (state) => state.remember);
  const recent = useStore(recentStore, (state) => state.entries);
  const searched = useDeferredValue(query);
  const [isPending, startTransition] = useTransition();
  const groups = usePaletteGroups({ answer, query: searched, recent });

  /** Opens a row's page, and remembers it when the row is a page of the index. */
  function choose(row: PaletteRow) {
    Option.map(row.entry, (entry: SearchEntry) => remember(entry));
    startTransition(() => {
      setOpen(false);
      if (row.go._tag === "page") {
        navigate({ href: row.go.href });
        return;
      }
      navigate({ ...SEARCH_TARGET, search: { q: row.go.query } });
    });
  }

  return (
    <Command
      filter={null}
      items={groups}
      itemToStringValue={(row: PaletteRow) => row.key}
      loopFocus
      mode="none"
      onValueChange={setQuery}
      value={query}
    >
      <CommandInput
        clearLabel={tCommon("clear-search")}
        placeholder={t("search-placeholder")}
      />
      <CommandPanel>
        <SearchState answer={answer} />
        <CommandList>
          {(group: PaletteGroup) => (
            <CommandGroup items={group.rows} key={group.key}>
              <CommandGroupLabel>{group.label}</CommandGroupLabel>
              <CommandCollection>
                {(row: PaletteRow) => (
                  <CommandItem
                    disabled={isPending}
                    key={row.key}
                    onClick={() => choose(row)}
                    value={row}
                  >
                    <SearchRow row={row} />
                  </CommandItem>
                )}
              </CommandCollection>
            </CommandGroup>
          )}
        </CommandList>
      </CommandPanel>
      <CommandKeys />
    </Command>
  );
}

/**
 * What the panel says over its rows: that the index is on its way, or that it
 * could not be read. A query always keeps its last row, the full search, so a
 * query that matches no page still leads somewhere.
 */
function SearchState({ answer }: { answer: Option.Option<IndexAnswer> }) {
  const t = useTranslations("Utils");
  return (
    <CommandEmpty className="text-muted-foreground text-center text-sm not-empty:flex not-empty:flex-col not-empty:items-center not-empty:justify-center not-empty:gap-2 not-empty:p-7.5">
      {Option.match(answer, {
        onNone: () => (
          <>
            <Spinner className="size-4" />
            <p>{t("search-loading")}</p>
          </>
        ),
        onSome: (settled) =>
          Result.isFailure(settled) && (
            <>
              <HugeIcons className="size-4" icon={InformationCircleIcon} />
              <p>{t("search-unavailable")}</p>
            </>
          ),
      })}
    </CommandEmpty>
  );
}
