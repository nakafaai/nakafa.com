import { CardContent } from "@repo/design-system/components/ui/card";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { useEffect, useEffectEvent } from "react";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import {
  isSearching,
  MEMORY_FILL,
  MEMORY_PAGE,
  withoutHidden,
} from "@/components/user/settings/memory/list";
import {
  useMemory,
  useMemoryPage,
  useShownMemories,
} from "@/components/user/settings/memory/provider";
import { MemoryWindow } from "@/components/user/settings/memory/window";

/**
 * The body of the list: the loaded memories that match the search, newest
 * first, without the ones the learner deleted before the server stored them.
 * The browser's own filter is the whole search, so it can only find what is
 * loaded. While the search box holds text, the rest loads, and a row that
 * matches appears as its page arrives. With nothing to list, the body says why
 * once it can: the learner has no memory, or every memory is loaded and none
 * matches.
 */
export function MemoryRows() {
  const query = useMemoryPage((state) => state.query);
  const hidden = useMemoryPage((state) => state.hidden);
  const { fetched, loaded, more, whole } = useMemory((reading) => reading);
  const listed = withoutHidden(loaded, hidden);
  const shown = useShownMemories();

  return (
    <CardContent className="border-t px-0">
      {Arr.isReadonlyArrayNonEmpty(shown) ? (
        <MemoryWindow memories={shown} />
      ) : (
        <MemoryEmpty
          empty={Arr.isReadonlyArrayEmpty(listed) && whole}
          whole={whole}
        />
      )}
      {more ? (
        <MemoryMore
          fetched={fetched}
          more={more}
          searching={isSearching(query)}
        />
      ) : null}
    </CardContent>
  );
}

/**
 * Asks for the next page when more can load. Without a search it waits for the
 * end of the list to come into view. With one it asks at once, and again each
 * time a page has arrived, until every memory is loaded, because a memory that
 * is not loaded cannot match.
 *
 * Both start again for each page that arrives, counted by what arrived and not
 * by what the list shows: a page of only ended situations adds no row, so the
 * end of the list stays in view and the count of rows stays the same, and
 * neither would ask for the page after it.
 */
function MemoryMore({
  fetched,
  more,
  searching,
}: {
  fetched: number;
  more: (count: number) => void;
  searching: boolean;
}) {
  return searching ? (
    <MemoryFill key={fetched} more={more} />
  ) : (
    <Intersection key={fetched} onIntersect={() => more(MEMORY_PAGE)} />
  );
}

/** Loads the next page as soon as it mounts. It mounts again for each page that arrives. */
function MemoryFill({ more }: { more: (count: number) => void }) {
  const load = useEffectEvent(more);

  useEffect(() => {
    load(MEMORY_FILL);
  }, []);

  return null;
}

/**
 * Says that there is nothing to list: no memory yet, or none that matches the
 * search. While pages are still loading for a search it says nothing yet, but
 * keeps the room the message takes, so the card does not shrink and grow.
 */
function MemoryEmpty({ empty, whole }: { empty: boolean; whole: boolean }) {
  const t = useTranslations("Memory");

  return (
    <div
      className="data-waiting:invisible"
      data-waiting={whole ? undefined : ""}
    >
      <EmptyState
        description={empty ? t("empty-description") : undefined}
        frame="table"
        scene={<EmptyNina act={empty ? "relaxed" : "searching"} />}
        title={empty ? t("empty") : t("no-result")}
      />
    </div>
  );
}
