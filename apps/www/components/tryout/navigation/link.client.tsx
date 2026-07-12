"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useState } from "react";

type NavigationLinkProps = ComponentProps<typeof NavigationLink>;
type TryoutIntentLinkProps = Omit<NavigationLinkProps, "prefetch"> & {
  onIntent?: () => void;
};

/**
 * Fully prefetches one try-out destination only after pointer, keyboard, or
 * touch intent, avoiding eager route and Convex work for every visible item.
 */
export function TryoutIntentLink({
  onFocus,
  onIntent,
  onMouseEnter,
  onTouchStart,
  ...props
}: TryoutIntentLinkProps) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false);

  /** Enable route prefetch and invoke destination-specific data warming. */
  function markIntent() {
    setShouldPrefetch(true);
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
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      prefetch={shouldPrefetch ? null : false}
    />
  );
}
