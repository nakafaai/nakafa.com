/**
 * The public Polar catalog: the Pro product of each Polar server. Browser code
 * imports only this module and reads the server selection through
 * `polarPublicKeys` in `@repo/backend/public`, so no server key is read in the
 * browser. The Pro prices live in `billing/catalog.ts`, in minor units.
 */
export const proProductIds = {
  production: "db602388-ef0c-4a88-92fa-c785f3230c45",
  sandbox: "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
} as const;

/** The Pro product of a Polar server. A missing or unknown server means sandbox, as `polarKeys` decides. */
export function proProductIdFor(server: string | undefined): string {
  return server === "production"
    ? proProductIds.production
    : proProductIds.sandbox;
}
