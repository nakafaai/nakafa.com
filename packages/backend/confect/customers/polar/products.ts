import {
  monthlyPrices,
  proProductIds,
} from "@repo/backend/confect/customers/polar/catalog";
import { isPolarProduction } from "@repo/backend/confect/customers/polar/environment";

/**
 * The Polar products of the server that runs this code. Convex and server code
 * read it. Browser code reads `catalog` with the public server key instead, so
 * this module never reaches the browser bundle.
 */
export const products = {
  pro: {
    id: isPolarProduction ? proProductIds.production : proProductIds.sandbox,
    monthlyPrices,
    slug: "pro",
  },
};
