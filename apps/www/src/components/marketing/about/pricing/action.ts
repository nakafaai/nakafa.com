import { createContext, use } from "react";
import { type StoreApi, useStore } from "zustand";

/** The emphasis of the Pro action: the page's one primary on the pricing page, secondary elsewhere. */
export type PricingButtonVariant = "default" | "secondary";

/** The emphasis of the Pro action around a variant of it. */
export const PricingButtonVariantContext =
  createContext<PricingButtonVariant | null>(null);

/** Reads the emphasis of the Pro action around a variant of it. */
export function usePricingButtonVariant() {
  const variant = use(PricingButtonVariantContext);
  if (variant === null) {
    throw new Error(
      "usePricingButtonVariant must be used within PricingButton"
    );
  }
  return variant;
}

/** Whether the Pro action was pressed before the page knew what the press should do. */
export const PricingPressContext = createContext<StoreApi<boolean> | null>(
  null
);

/** Reads the press the Pro action holds, and the two ways it changes. */
export function usePricingPress() {
  const store = use(PricingPressContext);
  if (store === null) {
    throw new Error("usePricingPress must be used within PricingButton");
  }
  return {
    hold: () => store.setState(true, true),
    isHeld: useStore(store),
    release: () => store.setState(false, true),
  };
}
