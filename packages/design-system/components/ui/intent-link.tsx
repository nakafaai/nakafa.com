"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  type NavigationLinkProps,
  SchoolLink,
  usePathname,
} from "@repo/internationalization/src/navigation";

type IntentLinkProps = Omit<NavigationLinkProps, "href" | "preload"> & {
  href: string;
  intentActive?: boolean;
  /**
   * Whether `href` is a localized app path, which gets the reader's locale
   * prefix. A school host's paths carry no locale, so its links pass `false`
   * and render through the school's navigation, which writes none.
   */
  localized?: boolean | undefined;
};

/**
 * Prefetches the route's shared App Shell while the link is visible, and the
 * link's own cached content once the reader shows intent: a hover, keyboard
 * focus, or a touch. Grids, lists, and links inside content use it, so only
 * the links a reader is about to open cost a per-link prefetch.
 *
 * A click adds nothing: hover, focus, or touch always comes first, and the
 * navigation a click starts fetches whatever the prefetch has not.
 *
 * It renders through NavigationLink, so a link to the page on screen keeps
 * `aria-current="page"`. A link that is not localized renders through the
 * school's navigation and marks the page on screen the same way.
 *
 * https://nextjs.org/docs/app/guides/optimizing-prefetching#trade-offs
 */
export function IntentLink({
  href,
  intentActive = false,
  localized = true,
  ...props
}: IntentLinkProps) {
  const pathname = usePathname();
  const preload = intentActive ? "render" : "intent";

  if (!localized) {
    return (
      <SchoolLink
        aria-current={href === pathname ? "page" : undefined}
        {...props}
        href={href}
        preload={preload}
      />
    );
  }

  return <NavigationLink {...props} href={href} preload={preload} />;
}
