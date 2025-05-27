"use client";

import { SearchInput } from "@/components/shared/search-input";
import { useRouter } from "@/i18n/navigation";
import { useSearch } from "@/lib/context/use-search";
import { useDebouncedCallback } from "@mantine/hooks";
import { useTransition } from "react";

export function HomeSearch() {
  const router = useRouter();

  const { query, setQuery } = useSearch((state) => ({
    query: state.query,
    setQuery: state.setQuery,
  }));

  const [isPending, startTransition] = useTransition();

  const redirect = () => {
    startTransition(() => {
      router.push(`/search?q=${query}`);
    });
  };

  const debouncedRedirect = useDebouncedCallback(redirect, 500);

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
