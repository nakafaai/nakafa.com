"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type {
  ComponentProps,
  FocusEvent,
  PointerEvent,
  TouchEvent,
} from "react";
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
  onPointerEnter,
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
  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    markIntent();
    onPointerEnter?.(event);
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
      onPointerEnter={handlePointerEnter}
      onTouchStart={handleTouchStart}
      prefetch={shouldPrefetch}
    />
  );
}
