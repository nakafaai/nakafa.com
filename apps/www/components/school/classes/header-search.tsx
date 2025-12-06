"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { searchParsers } from "@/lib/nuqs/search";

export function SchoolClassesHeaderSearch() {
  const t = useTranslations("School.Classes");

  const [{ q }, setSearch] = useQueryStates(searchParsers);

  return (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        onChange={(e) => setSearch({ q: e.target.value })}
        placeholder={t("search-placeholder")}
        value={q}
      />
    </InputGroup>
  );
}
