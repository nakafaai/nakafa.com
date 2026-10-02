"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link } from "@repo/internationalization/src/navigation";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useMemo, useState } from "react";

type LinkProps = ComponentProps<typeof Link>;
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
  const normalizedHref = useMemo(
    () => normalizeLocalizedInternalHref(href),
    [href]
  );

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
    <Link
      {...props}
      href={normalizedHref}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      prefetch={intentActive || prefetchHref === href ? true : null}
    />
  );
}
