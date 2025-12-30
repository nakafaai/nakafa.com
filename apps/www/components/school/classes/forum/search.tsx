"use client";

import { Cancel01Icon, Search02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { searchParsers } from "@/lib/nuqs/search";

export function SchoolClassesForumSearch() {
  const t = useTranslations("School.Classes");

  const [{ q }, setSearch] = useQueryStates(searchParsers);

  return (
    <ButtonGroup className="w-full">
      <InputGroup>
        <InputGroupAddon>
          <HugeIcons icon={Search02Icon} />
        </InputGroupAddon>
        <InputGroupInput
          onChange={(e) => setSearch({ q: e.target.value })}
          placeholder={t("forum-search-placeholder")}
          value={q}
        />
        <InputGroupAddon
          align="inline-end"
          className={cn(
            "opacity-0 transition-opacity ease-out",
            !!q && "opacity-100"
          )}
        >
          <InputGroupButton onClick={() => setSearch({ q: "" })} size="icon-xs">
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">Clear search</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </ButtonGroup>
  );
}
