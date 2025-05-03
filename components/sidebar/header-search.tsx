"use client";

import { usePathname } from "@/i18n/navigation";
import { SearchBar } from "./search-bar";

export function HeaderSearch() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/search") {
    return null;
  }

  return <SearchBar />;
}
