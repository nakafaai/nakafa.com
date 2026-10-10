"use client";

import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { MEMORY_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { useTranslations } from "next-intl";
import {
  useMemory,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";

/**
 * Holds the search that narrows the list in the browser and the button that
 * opens the editor of a new memory. At the limit the button waits, and a plain
 * sentence says why.
 */
export function MemoryToolbar() {
  const t = useTranslations("Memory");
  const query = useMemoryPage((state) => state.query);
  const search = useMemoryPage((state) => state.search);
  const openNew = useMemoryPage((state) => state.openNew);
  const full = useMemory((list) => list.memories.length >= MEMORY_LIMIT);

  return (
    <CardContent>
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
          className="max-sm:size-9 max-sm:px-0 max-sm:has-[>svg]:px-0"
          disabled={full}
          onClick={openNew}
        >
          <HugeIcons icon={Add01Icon} />
          <span className="max-sm:sr-only">{t("add")}</span>
        </Button>
      </div>
      {full ? (
        <p className="text-muted-foreground text-sm">
          {t("limit", { count: MEMORY_LIMIT })}
        </p>
      ) : null}
    </CardContent>
  );
}
