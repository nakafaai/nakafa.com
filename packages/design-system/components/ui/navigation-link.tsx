"use client";

import { isInternalHref } from "@repo/internationalization/src/href";
import {
  Link,
  type NavigationLinkProps,
  useCurrentLocale,
  usePathname,
} from "@repo/internationalization/src/navigation";
import { canonicalPathOf } from "@repo/internationalization/src/target";

/**
 * A localized app link that marks itself as the current page when it leads to
 * the page on screen. The match is exact, so a section link stays unmarked on
 * the section's nested pages, and a caller can still set `aria-current`.
 *
 * @param props - The props of the link
 * @returns A navigation link component
 */
export default function NavigationLink({
  href,
  ...props
}: NavigationLinkProps) {
  const pathname = usePathname();
  const locale = useCurrentLocale();
  const isCurrent =
    isInternalHref(href) && canonicalPathOf(href, locale) === pathname;

  return (
    <Link
      aria-current={isCurrent ? "page" : undefined}
      href={href}
      {...props}
    />
  );
}
