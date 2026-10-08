"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useState } from "react";

type LinkProps = ComponentProps<typeof NavigationLink>;
type IntentLinkProps = Omit<LinkProps, "href" | "prefetch"> & {
  href: string;
  intentActive?: boolean;
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
 * `aria-current="page"`.
 *
 * https://nextjs.org/docs/app/guides/optimizing-prefetching#trade-offs
 */
export function IntentLink({
  href,
  intentActive = false,
  onFocus,
  onMouseEnter,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const [prefetchHref, setPrefetchHref] = useState<string | null>(null);

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    setPrefetchHref(href);
    onFocus?.(event);
  }

  function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
    setPrefetchHref(href);
    onMouseEnter?.(event);
  }

  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    setPrefetchHref(href);
    onTouchStart?.(event);
  }

  return (
    <NavigationLink
      {...props}
      href={href}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      prefetch={intentActive || prefetchHref === href ? true : "auto"}
    />
  );
}
