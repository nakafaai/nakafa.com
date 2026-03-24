import { PolarCore } from "@polar-sh/sdk/core.js";
import { ConvexError } from "convex/values";

/** Whether running in production mode */
const isProduction = process.env.NEXT_PUBLIC_POLAR_SERVER === "production";

/** Polar API environment (production or sandbox) */
const server = isProduction ? "production" : "sandbox";

/**
 * Read one required Polar environment variable and fail closed when it is not
 * configured.
 */
function requirePolarEnv(name: "POLAR_ACCESS_TOKEN" | "POLAR_WEBHOOK_SECRET") {
  const value = process.env[name];

  if (value) {
    return value;
  }

  throw new ConvexError({
    code: "POLAR_ENV_MISSING",
    message: `Missing required Polar environment variable: ${name}`,
  });
}

/**
 * Shared Polar SDK client instance.
 * Polar's own SDK docs describe instantiating one client at application start
 * and reusing it across calls.
 */
export const polarClient = new PolarCore({
  accessToken: requirePolarEnv("POLAR_ACCESS_TOKEN"),
  server,
});

/**
 * Return the Polar webhook secret used to verify incoming webhook signatures.
 */
export const polarWebhookSecret = requirePolarEnv("POLAR_WEBHOOK_SECRET");

/**
 * Product configuration map.
 * Contains IDs and slugs for Polar products in different environments.
 */
export const products = {
  pro: {
    id: isProduction
      ? "db602388-ef0c-4a88-92fa-c785f3230c45"
      : "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
    slug: "pro",
  },
};
