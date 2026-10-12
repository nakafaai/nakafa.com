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
 * the button that opens the editor with a new memory. The button says what it
 * adds where there is room for a word, and is the plus alone on a phone.
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
          <InputGroupAddon>
            <HugeIcons icon={Search01Icon} />
          </InputGroupAddon>
        </InputGroup>
        <Button
          aria-label={t("add")}
          className="w-9 sm:w-auto"
          onClick={openNew}
          title={t("add")}
        >
          <HugeIcons icon={Add01Icon} />
          <span className="hidden sm:inline">{t("memory")}</span>
        </Button>
      </div>
    </CardHeader>
  );
}
