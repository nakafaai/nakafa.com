"use client";

import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { Link } from "@repo/internationalization/src/navigation";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useMemo, useRef, useState } from "react";

type LinkProps = ComponentProps<typeof Link>;
type IntentLinkProps = Omit<LinkProps, "href" | "prefetch"> & {
  href: string;
  onIntent?: () => boolean;
};

/**
 * Preserve the reusable route shell and resolve URL-specific data only after
 * pointer, keyboard, or touch intent.
 *
 * https://nextjs.org/docs/app/guides/runtime-prefetching
 */
export function IntentLink({
  href,
  onClick,
  onFocus,
  onIntent,
  onMouseEnter,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const [prefetchHref, setPrefetchHref] = useState<string | null>(null);
  const warmedHref = useRef<string | null>(null);
  const normalizedHref = useMemo(
    () => normalizeLocalizedInternalHref(href),
    [href]
  );

  function markIntent() {
    setPrefetchHref(href);

    if (warmedHref.current === href) {
      return;
    }

    const warmed = onIntent?.() ?? true;

    if (warmed) {
      warmedHref.current = href;
    }
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
      prefetch={prefetchHref === href ? true : null}
    />
  );
}
