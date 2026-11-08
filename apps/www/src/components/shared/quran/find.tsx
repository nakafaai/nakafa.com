import { Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { readChunk } from "@repo/design-system/lib/lazy";
import { Effect } from "effect";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useTableFilters } from "@/components/shared/table/toolbar";

/** The code of the search's list, which no surah page needs before the reader turns to the search. */
type JumpModule = typeof import("@/components/shared/quran/jump");

/** Loads the search's list. */
const loadJump = () =>
  Effect.runPromise(readChunk(() => import("@/components/shared/quran/jump")));

/**
 * The search of a surah page's header, beside its actions. The box draws at once
 * and its list loads as the reader turns to it: a pointer over it or a focus on
 * it on a wide screen, a press of the search button on a phone. What the reader
 * types before the list arrives stays in the box, which the list then takes.
 */
export function QuranSurahFind() {
  const t = useTranslations("Holy");
  const search = useTableFilters((state) => state.search);
  const setSearch = useTableFilters((state) => state.setSearch);
  const box = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{
    readonly focus: boolean;
    readonly jump: JumpModule;
  } | null>(null);
  const [phone, setPhone] = useState(false);

  function load() {
    loadJump().then((jump) =>
      setLoaded({ focus: document.activeElement === box.current, jump })
    );
  }

  return (
    <div className="flex">
      <div className="hidden w-56 lg:flex xl:w-64">
        {loaded === null ? (
          <InputGroup>
            <InputGroupAddon>
              <HugeIcons icon={Search01Icon} />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("search-surah")}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={load}
              onPointerEnter={load}
              placeholder={t("search-surah")}
              ref={box}
              value={search}
            />
          </InputGroup>
        ) : (
          <loaded.jump.QuranSurahJump autoFocus={loaded.focus} />
        )}
      </div>
      {phone && loaded !== null ? (
        <loaded.jump.QuranSurahJumpButton />
      ) : (
        <Button
          aria-label={t("search-surah")}
          className="lg:hidden"
          onClick={() => {
            setPhone(true);
            load();
          }}
          size="icon"
          type="button"
          variant="outline"
        >
          <HugeIcons icon={Search01Icon} />
        </Button>
      )}
    </div>
  );
}
