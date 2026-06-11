"use client";

import { Cancel01Icon, Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Group } from "@repo/design-system/components/ui/group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { searchParsers } from "@/lib/nuqs/search";

export function SchoolClassesMaterialsSearch() {
  const t = useTranslations("School.Classes");

  const [{ q }, setSearch] = useQueryStates(searchParsers);

  return (
    <Group className="w-full">
      <InputGroup>
        <InputGroupInput
          onChange={(e) => setSearch({ q: e.target.value })}
          placeholder={t("modules-search-placeholder")}
          value={q}
        />
        <InputGroupAddon>
          <HugeIcons icon={Search02Icon} />
        </InputGroupAddon>
        <InputGroupAddon
          align="inline-end"
          className={cn(
            "opacity-0 transition-opacity ease-out",
            !!q && "opacity-100"
          )}
        >
          <Button
            onClick={() => setSearch({ q: "" })}
            size="icon-xs"
            variant="ghost"
          >
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">Clear search</span>
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </Group>
  );
}
