"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { useSearch } from "@/lib/context/use-search";
import { searchParsers } from "@/lib/nuqs/search";

export function InputSearch() {
  const setQuery = useSearch((state) => state.setQuery);

  const [{ q }, setSearch] = useQueryStates(searchParsers);

  const setValue = useCallback(
    (value: string) => {
      setSearch({ q: value });
      setQuery(value);
    },
    [setSearch, setQuery]
  );

  return <SearchInput autoFocus setValue={setValue} value={q} />;
}
