import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import { type StoreApi, useStore } from "zustand";

/** The emphasis of the Pro action: the page's one primary on the pricing page, secondary elsewhere. */
export type PricingButtonVariant = "default" | "secondary";

/** The emphasis of the Pro action around a variant of it. */
export const PricingButtonVariantContext =
  createContext<PricingButtonVariant | null>(null);

/** Reads the emphasis of the Pro action around a variant of it. */
export function usePricingButtonVariant() {
  return useRequired(PricingButtonVariantContext, "usePricingButtonVariant");
}

/** Whether the Pro action was pressed before the page knew what the press should do. */
export const PricingPressContext = createContext<StoreApi<boolean> | null>(
  null
);

/** Reads the press the Pro action holds, and the two ways it changes. */
export function usePricingPress() {
  const store = useRequired(PricingPressContext, "usePricingPress");
  return {
    hold: () => store.setState(true, true),
    isHeld: useStore(store),
    release: () => store.setState(false, true),
  };
}
