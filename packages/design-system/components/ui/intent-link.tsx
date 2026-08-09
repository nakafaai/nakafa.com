"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link } from "@repo/internationalization/src/navigation";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useMemo, useState } from "react";

type LinkProps = ComponentProps<typeof Link>;
type IntentLinkProps = Omit<LinkProps, "href" | "prefetch"> & {
  href: string;
  intentActive?: boolean;
  onIntent?: () => void;
};

/**
 * Preserve the reusable route shell and resolve URL-specific data only after
 * pointer, keyboard, or touch intent.
 *
 * https://nextjs.org/docs/app/guides/runtime-prefetching
 */
export function IntentLink({
  href,
  intentActive = false,
  onClick,
  onFocus,
  onIntent,
  onMouseEnter,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const [prefetchHref, setPrefetchHref] = useState<string | null>(null);
  const normalizedHref = useMemo(
    () => normalizeLocalizedInternalHref(href),
    [href]
  );

  function markIntent() {
    setPrefetchHref(href);
    onIntent?.();
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    markIntent();
    onClick?.(event);
  }

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    markIntent();
    onFocus?.(event);
  }

  function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
    markIntent();
    onMouseEnter?.(event);
  }

  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    markIntent();
    onTouchStart?.(event);
  }

  return (
    <Link
      {...props}
      href={normalizedHref}
      onClick={handleClick}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      prefetch={intentActive || prefetchHref === href ? true : null}
    />
  );
}
