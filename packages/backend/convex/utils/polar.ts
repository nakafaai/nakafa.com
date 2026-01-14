import { PolarCore } from "@polar-sh/sdk/core.js";

/** Polar API Access Token from environment */
export const polarAccessToken = process.env.POLAR_ACCESS_TOKEN ?? "";

/** Webhook secret for verifying Polar events */
export const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "";

/** Whether running in production mode */
export const isProduction =
  process.env.NEXT_PUBLIC_POLAR_SERVER === "production";

/** Polar API environment (production or sandbox) */
export const server = isProduction ? "production" : "sandbox";

/**
 * Shared Polar SDK client instance.
 * Configured with environment-specific token and server URL.
 */
export const polarClient = new PolarCore({
  accessToken: polarAccessToken,
  server,
});

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
