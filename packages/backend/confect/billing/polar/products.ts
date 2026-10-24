import { proProductIds } from "@repo/backend/confect/billing/polar/catalog";
import { isPolarProduction } from "@repo/backend/confect/billing/polar/environment";

/**
 * The Polar products of the server that runs this code. Convex and server code
 * read it. Browser code reads `catalog` with the public server key instead, so
 * this module never reaches the browser bundle.
 */
export const products = {
  pro: {
    id: isPolarProduction ? proProductIds.production : proProductIds.sandbox,
    slug: "pro",
  },
};
