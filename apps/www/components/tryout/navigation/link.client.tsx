"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useRef } from "react";

type NavigationLinkProps = ComponentProps<typeof NavigationLink>;
type TryoutIntentLinkProps = Omit<NavigationLinkProps, "href" | "prefetch"> & {
  href: string;
  onIntent?: () => boolean;
};

/**
 * Preserves Next's default route prefetch while warming authenticated
 * destination data once after pointer, keyboard, or touch intent.
 */
export function TryoutIntentLink({
  href,
  onClick,
  onFocus,
  onIntent,
  onMouseEnter,
  onTouchStart,
  ...props
}: TryoutIntentLinkProps) {
  const warmedHref = useRef<string | null>(null);

  /** Retry destination data warming until it succeeds for the current href. */
  function markIntent() {
    if (warmedHref.current === href) {
      return;
    }

    const warmed = onIntent?.() ?? true;

    if (warmed) {
      warmedHref.current = href;
    }
  }

  /** Retry unresolved data warming before the route navigation commits. */
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    markIntent();
    onClick?.(event);
  }

  /** Record keyboard focus as navigation intent. */
  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    markIntent();
    onFocus?.(event);
  }

  /** Record pointer hover as navigation intent. */
  function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
    markIntent();
    onMouseEnter?.(event);
  }

  /** Record touch contact as navigation intent. */
  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    markIntent();
    onTouchStart?.(event);
  }

  return (
    <NavigationLink
      {...props}
      href={href}
      onClick={handleClick}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
    />
  );
}
