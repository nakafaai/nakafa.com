"use client";

import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { CardHeader } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { useTranslations } from "next-intl";
import {
  MEMORY_ADD_ID,
  MEMORY_SEARCH_ID,
} from "@/components/user/settings/memory/focus";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/**
 * The head of the list: the search that narrows it as the learner types, and
 * the button that opens the editor with a new memory. The head decides what it
 * shows by its own width, not the window's, because the card beside the editor
 * panel is as narrow as the card on a phone. From 24rem the button says what it
 * adds, and the longest placeholder, which is German, still has all its room.
 * From 16rem the search shows its icon. Below that the field has the room alone.
 *
 * A search field keeps a slot for its clear button even while it is empty, and
 * the placeholder cannot use it: in a narrow card the German placeholder lost
 * its last letter. The button hides while the placeholder shows and comes back
 * with the first letter.
 */
export function MemoryToolbar() {
  const t = useTranslations("Memory");
  const query = useMemoryPage((state) => state.query);
  const search = useMemoryPage((state) => state.search);
  const openNew = useMemoryPage((state) => state.openNew);

  return (
    <CardHeader className="pb-(--card-spacing)">
      <div className="flex items-center gap-2">
        <InputGroup>
          <InputGroupInput
            aria-label={t("search")}
            className="[&:placeholder-shown::-webkit-search-cancel-button]:hidden"
            id={MEMORY_SEARCH_ID}
            onChange={(event) => search(event.target.value)}
            placeholder={t("search")}
            type="search"
            value={query}
          />
          <InputGroupAddon className="@max-3xs/card-header:hidden">
            <HugeIcons icon={Search01Icon} />
          </InputGroupAddon>
        </InputGroup>
        <Button
          aria-label={t("add")}
          className="@sm/card-header:w-auto w-9"
          id={MEMORY_ADD_ID}
          onClick={openNew}
          title={t("add")}
        >
          <HugeIcons icon={Add01Icon} />
          <span className="@sm/card-header:inline hidden">{t("memory")}</span>
        </Button>
      </div>
    </CardHeader>
  );
}
