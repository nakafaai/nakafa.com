import { createContext, type RefObject } from "react";

/**
 * Where the design system's anchored popups render: menus, selects, popovers, tooltips, hover
 * cards and autocomplete lists. Each reads the element the nearest provider names when it opens,
 * and the document body when the ref is empty or no provider wraps it.
 *
 * A visual card shown across the screen names itself. The browser's full screen draws nothing
 * outside the card, and the card returns to the page once focus leaves it, so a popup portaled to
 * the body could neither show nor be used there. The value is a ref, so a provider never changes
 * it after hydration.
 */
export const PortalContainer = createContext<
  RefObject<HTMLElement | null> | undefined
>(undefined);
