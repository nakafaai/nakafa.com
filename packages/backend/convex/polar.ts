import { Polar } from "@polar-sh/sdk";

const isProduction = process.env.POLAR_SERVER === "production";
const server = isProduction ? "production" : "sandbox";

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  // Use 'sandbox' if you're using the Polar Sandbox environment
  // Remember that access tokens, products, etc. are completely separated between environments.
  // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
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
