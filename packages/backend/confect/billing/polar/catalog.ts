/**
 * The Polar catalog: the Pro product of each Polar server. The server a deployment
 * bills through is read from `POLAR_SERVER` on the server, so the browser never
 * reads it. The Pro prices live in `billing/catalog.ts`, in minor units.
 */
export const proProductIds = {
  production: "db602388-ef0c-4a88-92fa-c785f3230c45",
  sandbox: "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
} as const;

/** One Polar server: production bills real money, sandbox is the test server. */
type PolarServer = "production" | "sandbox";

/** The Pro product of one Polar server. */
export function proProductIdFor(server: PolarServer): string {
  return server === "production"
    ? proProductIds.production
    : proProductIds.sandbox;
}
