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

  function markIntent() {
    setShouldPrefetch(true);
    onIntent?.();
  }

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    markIntent();
    onFocus?.(event);
  }

  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    markIntent();
    onPointerEnter?.(event);
  }

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
