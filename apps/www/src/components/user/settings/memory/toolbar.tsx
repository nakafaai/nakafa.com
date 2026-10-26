import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { CardHeader } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SearchField } from "@repo/design-system/components/ui/search";
import { useTranslations } from "use-intl";
import {
  MEMORY_ADD_ID,
  MEMORY_SEARCH_ID,
} from "@/components/user/settings/memory/focus";
import { warmMemoryEditor } from "@/components/user/settings/memory/module";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/**
 * The head of the list: the search that narrows it as the learner types, and
 * the button that opens the editor with a new memory. The head decides what it
 * shows by its own width, not the window's, because the card beside the editor
 * panel is as narrow as the card on a phone. From 24rem the button says what it
 * adds, and the longest placeholder, which is German, still has all its room.
 * The search is the design system's field, whose clear button shows only once
 * the field holds text, so the browser draws no control of its own.
 */
export function MemoryToolbar() {
  const t = useTranslations("Memory");
  const query = useMemoryPage((state) => state.query);
  const search = useMemoryPage((state) => state.search);
  const openNew = useMemoryPage((state) => state.openNew);

  return (
    <CardHeader className="pb-(--card-spacing)">
      <div className="flex items-center gap-2">
        <SearchField
          id={MEMORY_SEARCH_ID}
          onValueChange={search}
          placeholder={t("search")}
          value={query}
        />
        <Button
          aria-label={t("add")}
          className="@sm/card-header:w-auto w-9"
          id={MEMORY_ADD_ID}
          onClick={openNew}
          onFocus={warmMemoryEditor}
          onPointerDown={warmMemoryEditor}
          onPointerEnter={warmMemoryEditor}
          title={t("add")}
        >
          <HugeIcons icon={Add01Icon} />
          <span className="@sm/card-header:inline hidden">{t("memory")}</span>
        </Button>
      </div>
    </CardHeader>
  );
}
