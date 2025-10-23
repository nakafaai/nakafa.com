import { Polar } from "@polar-sh/sdk";

export const polarAccessToken = process.env.POLAR_ACCESS_TOKEN ?? "";
export const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "";
export const isProduction = process.env.POLAR_SERVER === "production";
export const server = isProduction ? "production" : "sandbox";

export const polarClient = new Polar({
  accessToken: polarAccessToken,
  server,
});

export const products = {
  pro: {
    id: isProduction
      ? "db602388-ef0c-4a88-92fa-c785f3230c45"
      : "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
    slug: "pro",
  },
};
