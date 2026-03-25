import { isPolarProduction } from "@repo/backend/convex/utils/polar/config";

/**
 * Public-safe Polar product configuration.
 * This file must stay free of secret environment access so client code can
 * safely import product IDs and slugs.
 */
export const products = {
  pro: {
    id: isPolarProduction
      ? "db602388-ef0c-4a88-92fa-c785f3230c45"
      : "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
    slug: "pro",
  },
};
