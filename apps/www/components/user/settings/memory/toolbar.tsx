"use client";

import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { MEMORY_LIMIT } from "@repo/backend/confect/nina/memory.spec";
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
  useMemory,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";

/**
 * The head of the list: the search that narrows it in the browser, and the
 * button that opens the editor with a new memory. At the limit the button
 * waits.
 */
export function MemoryToolbar() {
  const t = useTranslations("Memory");
  const query = useMemoryPage((state) => state.query);
  const search = useMemoryPage((state) => state.search);
  const openNew = useMemoryPage((state) => state.openNew);
  const full = useMemory((list) => list.memories.length >= MEMORY_LIMIT);

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
          disabled={full}
          onClick={openNew}
          size="icon"
          title={t("add")}
        >
          <HugeIcons icon={Add01Icon} />
        </Button>
      </div>
    </CardHeader>
  );
}
