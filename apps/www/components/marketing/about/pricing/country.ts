import { createContext } from "react";

/**
 * The country code of the request that prices the plans. The route provides
 * it from the request, and without a provider the plans show the default
 * price list.
 */
export const PricingCountryContext = createContext<string | null>(null);
