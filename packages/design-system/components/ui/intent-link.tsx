"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link } from "@repo/internationalization/src/navigation";
import type { ComponentProps, FocusEvent, PointerEvent } from "react";
import { useMemo, useState } from "react";

type LinkProps = ComponentProps<typeof Link>;
type IntentLinkProps = Omit<LinkProps, "href" | "prefetch"> & {
  href: string;
  intentActive?: boolean;
};

/**
 * Prefetches the route's shared App Shell while the link is visible, and its
 * URL-specific content from the earliest sign the reader means to open it:
 * a hover, keyboard focus, or the start of a press or touch.
 *
 * A click never changes the prefetch. The link already prefetches by the time
 * a press ends, and a click that comes first still navigates at once, with
 * whatever the prefetch has fetched so far, or none of it.
 *
 * https://nextjs.org/docs/app/guides/optimizing-prefetching#trade-offs
 */
export function IntentLink({
  href,
  intentActive = false,
  onFocus,
  onPointerDown,
  onPointerEnter,
  ...props
}: IntentLinkProps) {
  const [intentHref, setIntentHref] = useState<string | null>(null);
  const normalizedHref = useMemo(
    () => normalizeLocalizedInternalHref(href),
    [href]
  );

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    setIntentHref(href);
    onFocus?.(event);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    setIntentHref(href);
    onPointerDown?.(event);
  }

  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    setIntentHref(href);
    onPointerEnter?.(event);
  }

  return (
    <Link
      {...props}
      href={normalizedHref}
      onFocus={handleFocus}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      prefetch={intentActive || intentHref === href ? true : null}
    />
  );
}
