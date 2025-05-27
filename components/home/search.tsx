"use client";

import { SearchInput } from "@/components/shared/search-input";
import { useRouter } from "@/i18n/navigation";
import { useSearch } from "@/lib/context/use-search";
import { useCallback, useTransition } from "react";
import { useDebounceCallback } from "usehooks-ts";

export function HomeSearch() {
  const router = useRouter();

  const { query, setQuery } = useSearch((state) => ({
    query: state.query,
    setQuery: state.setQuery,
  }));

  const [isPending, startTransition] = useTransition();

  const redirect = useCallback(() => {
    startTransition(() => {
      router.push(`/search?q=${query}`);
    });
  }, [router, query]);

  const debouncedRedirect = useDebounceCallback(redirect, 300);

  return (
    <SearchInput
      value={query}
      setValue={(value) => {
        setQuery(value);
        if (value) {
          debouncedRedirect();
        }
      }}
      loading={isPending}
      action={redirect}
      autoFocus
    />
  );
}
