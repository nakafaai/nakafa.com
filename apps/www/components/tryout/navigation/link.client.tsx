"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useRef } from "react";

type NavigationLinkProps = ComponentProps<typeof NavigationLink>;
type TryoutIntentLinkProps = Omit<NavigationLinkProps, "href" | "prefetch"> & {
  href: string;
  onIntent?: () => void;
};

/**
 * Always prefetches the route while warming authenticated destination data
 * once after pointer, keyboard, or touch intent.
 */
export function TryoutIntentLink({
  href,
  onFocus,
  onIntent,
  onMouseEnter,
  onTouchStart,
  ...props
}: TryoutIntentLinkProps) {
  const warmedHref = useRef<string | null>(null);

  /** Invoke destination-specific data warming once for the current href. */
  function markIntent() {
    if (warmedHref.current === href) {
      return;
    }

    warmedHref.current = href;
    onIntent?.();
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
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
    />
  );
}
