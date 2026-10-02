"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link } from "@repo/internationalization/src/navigation";
import { Predicate } from "effect";
import type { ComponentProps } from "react";

/**
 * A localized app link. A caller that knows its link opens the current page
 * marks it with `aria-current`.
 *
 * @param href - The href of the link
 * @param props - The props of the link
 * @returns A navigation link component
 */
export default function NavigationLink({
  href,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      href={
        Predicate.isString(href) ? normalizeLocalizedInternalHref(href) : href
      }
      {...props}
    />
  );
}
