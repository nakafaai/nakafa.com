"use client";

import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import { SearchIcon, XIcon } from "lucide-react";
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
          <SearchIcon />
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
            <XIcon />
            <span className="sr-only">Clear search</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </ButtonGroup>
  );
}
