import { getProductsForServer } from "@repo/backend/confect/modules/commerce/polar/products";
import { env } from "@/env";

/** Public Polar products for the app build target. */
export const products = getProductsForServer(env.NEXT_PUBLIC_POLAR_SERVER);
