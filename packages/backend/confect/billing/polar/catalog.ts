/**
 * The public Polar catalog: the Pro product of each Polar server and its monthly
 * prices. Browser code imports only this module and reads the server selection
 * through `polarPublicKeys` in `@repo/backend/public`, so no server key is read
 * in the browser.
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

export const monthlyPrices = {
  EUR: {
    amount: 8.99,
    currency: "EUR",
    fractionDigits: 2,
    locale: "de-DE",
  },
  IDR: {
    amount: 79_000,
    currency: "IDR",
    fractionDigits: 0,
    locale: "id-ID",
  },
  USD: {
    amount: 8.99,
    currency: "USD",
    fractionDigits: 2,
    locale: "en-US",
  },
};
