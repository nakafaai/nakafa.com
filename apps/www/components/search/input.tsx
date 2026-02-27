"use client";

import { Cancel01Icon, Search02Icon } from "@hugeicons/core-free-icons";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { useSearch } from "@/lib/context/use-search";
import { searchParsers } from "@/lib/nuqs/search";

export function InputSearch() {
  const t = useTranslations("Utils");
  const setQuery = useSearch((state) => state.setQuery);

  const [{ q }, setSearch] = useQueryStates(searchParsers);

  const setValue = useCallback(
    (value: string) => {
      setSearch({ q: value });
      setQuery(value);
    },
    [setSearch, setQuery]
  );

  return (
    <div className="sticky top-20 lg:top-4">
      <Field>
        <FieldLabel className="sr-only" htmlFor="search-input">
          Search
        </FieldLabel>
        <InputGroup className="bg-background">
          <InputGroupInput
            id="search-input"
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("search-bar-placeholder")}
            value={q}
          />
          <InputGroupAddon align="inline-start">
            <HugeIcons className="size-4" icon={Search02Icon} />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className={cn("cursor-pointer opacity-0", q && "opacity-100")}
            onClick={() => setValue("")}
          >
            <HugeIcons className="size-4" icon={Cancel01Icon} />
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </div>
  );
}
