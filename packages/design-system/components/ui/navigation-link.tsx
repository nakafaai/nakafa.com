"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import { Predicate } from "effect";
import type { ComponentProps } from "react";

/**
 * A localized app link that marks itself as the current page when it leads to
 * the page on screen. The match is exact, so a section link stays unmarked on
 * the section's nested pages, and a caller can still set `aria-current`.
 *
 * @param href - The href of the link
 * @param props - The props of the link
 * @returns A navigation link component
 */
export default function NavigationLink({
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const target = Predicate.isString(href)
    ? normalizeLocalizedInternalHref(href)
    : href;

  return (
    <Link
      aria-current={target === pathname ? "page" : undefined}
      href={target}
      {...props}
    />
  );
}
