"use client";

import { Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { searchParsers } from "@/lib/nuqs/search";

export function SchoolClassesHeaderSearch() {
  const t = useTranslations("School.Classes");

  const [{ q }, setSearch] = useQueryStates(searchParsers);

  return (
    <InputGroup>
      <InputGroupAddon>
        <HugeIcons icon={Search02Icon} />
      </InputGroupAddon>
      <InputGroupInput
        onChange={(e) => setSearch({ q: e.target.value })}
        placeholder={t("search-placeholder")}
        value={q}
      />
    </InputGroup>
  );
}
