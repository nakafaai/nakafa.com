"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import { useTransition } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { useSearch } from "@/lib/context/use-search";

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
      action={redirect}
      loading={isPending}
      setValue={setQuery}
      value={query}
    />
  );
}
