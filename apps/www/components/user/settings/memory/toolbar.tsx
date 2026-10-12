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
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/**
 * The head of the list: the search that narrows it as the learner types, and
 * the button that opens the editor with a new memory. The head decides what it
 * shows by its own width, not the window's, because the card beside the editor
 * panel is as narrow as the card on a phone. From 24rem the button says what it
 * adds, and the longest placeholder, which is German, still has all its room.
 * From 16rem the search shows its icon. Below that the field has the room alone.
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
