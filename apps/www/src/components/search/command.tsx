import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@repo/design-system/components/ui/command";
import { useRequired } from "@repo/design-system/hooks/required";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Effect, Option, Result } from "effect";
import type { ReactNode } from "react";
import {
  createContext,
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
import type { PaletteRow } from "@/components/search/rows";
import { SearchRow, usePaletteGroups } from "@/components/search/rows";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { SEARCH_TARGET } from "@/lib/routing/target";
import { useSearch } from "@/lib/search/context";
import type { SearchEntry } from "@/lib/search/entry";
import type { SearchIndexUnavailable } from "@/lib/search/load";
import { readSearchIndex } from "@/lib/search/load";
import { createRecentStore } from "@/lib/search/recent";

/**
 * The global command palette: every page Nakafa publishes in the reader's
 * language, searched in the browser from one static index that the build wrote.
 * The palette mounts when the reader shows intent, so the index is read once,
 * before the press that opens it, and nothing is read per keystroke. The palette
 * draws only once the index has settled, with its code, so its first frame is
 * its final one: a press that comes first opens it as soon as both are here.
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
 * Starts reading the index of one locale, once, and holds the palette back until
 * it settles. It sits above the dialog and commits before the palette waits, so a
 * phone's drawer, whose body leaves when it closes, never reads the index again.
 */
function SearchIndex({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [answer] = useState(() =>
    Effect.runPromise(Effect.result(readSearchIndex(locale)))
  );
  return (
    <SearchIndexContext value={answer}>
      <Suspense fallback={null}>{children}</Suspense>
    </SearchIndexContext>
  );
}

/** What reading the index settled with; it suspends the caller until then. */
function useIndexAnswer() {
  return use(useRequired(SearchIndexContext, "useIndexAnswer"));
}

/** The dialog, or the phone's drawer, that holds the palette, drawn once the index has settled. */
function SearchDialog() {
  useIndexAnswer();
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
        keepMounted
        title={tCommon("search")}
      >
        <SearchPalette />
      </CommandDialogPopup>
    </CommandDialog>
  );
}

/** The search box, its groups of rows, and the keys at its foot. */
function SearchPalette() {
  const answer = useIndexAnswer();
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
    <Command filter={false} onQueryChange={setQuery} query={query}>
      <CommandInput
        clearLabel={tCommon("clear-search")}
        placeholder={t("search-placeholder")}
      />
      <CommandPanel>
        {Result.isFailure(answer) ||
        (searched.trim() !== "" &&
          Arr.every(groups, (group) => group.key === "full")) ? (
          <SearchMissed />
        ) : null}
        <CommandList>
          {Arr.map(groups, (group) => (
            <CommandGroup key={group.key}>
              <CommandGroupLabel>{group.label}</CommandGroupLabel>
              {Arr.map(group.items, (row) => (
                <CommandItem
                  disabled={isPending}
                  key={row.key}
                  onSelect={() => choose(row)}
                  value={`${group.key}:${row.key}`}
                >
                  <SearchRow row={row} />
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandPanel>
      <CommandKeys />
    </Command>
  );
}

/**
 * What the panel says when a query finds nothing, or the index could not be read: Nina shrugs over it, and the
 * full search stays under her as the row that still leads somewhere.
 */
function SearchMissed() {
  const answer = useIndexAnswer();
  const t = useTranslations("Utils");
  const failed = Result.isFailure(answer);

  return (
    <EmptyState
      frame="table"
      {...(failed ? { role: "alert" as const } : {})}
      scene={<EmptyNina act="shrugging" />}
      title={t(failed ? "search-unavailable" : "search-not-found")}
    />
  );
}
