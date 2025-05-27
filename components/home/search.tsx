"use client";

import { SearchInput } from "@/components/shared/search-input";
import { useRouter } from "@/i18n/navigation";
import { useSearch } from "@/lib/context/use-search";
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

  return (
    <SearchInput
      value={query}
      setValue={setQuery}
      loading={isPending}
      action={redirect}
      autoFocus
    />
  );
}
