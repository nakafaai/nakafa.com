import { Array as Arr, type Option, Schema } from "effect";

/** The offers Polar sells. Each one is a product on both Polar servers. */
export const PolarOfferKey = Schema.Literals([
  "pro.monthly",
  "pro.yearly",
  "pro.topup",
  "school.seat.month",
  "school.seat.year",
]);
export type PolarOfferKey = typeof PolarOfferKey.Type;

/** One Polar server: production bills real money, sandbox is the test server. */
export const PolarServer = Schema.Literals(["production", "sandbox"]);
type PolarServer = typeof PolarServer.Type;

/**
 * The Polar product of every offer Polar sells, on each server. This is the
 * only place a Polar product ID is written. The server a deployment bills
 * through is read from `POLAR_SERVER` on the server, so the browser never reads
 * it. Prices live in `billing/catalog.ts`, in minor units.
 */
const polarProductIds = {
  "pro.monthly": {
    production: "db602388-ef0c-4a88-92fa-c785f3230c45",
    sandbox: "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
  },
  "pro.yearly": {
    production: "5e5a160f-d382-4637-9ef5-1a812b02cf41",
    sandbox: "9a894035-db37-475e-a016-0d498dccdb36",
  },
  "pro.topup": {
    production: "e3820d2f-59ed-4c63-99cc-682459c6f5b0",
    sandbox: "4afce31b-376c-4de0-853d-1ca3b0139d4c",
  },
  "school.seat.month": {
    production: "87ffc626-b0e3-4c4b-b0f1-5a3563617dee",
    sandbox: "53bf9b74-35bc-4b88-a55a-37320d2c8177",
  },
  "school.seat.year": {
    production: "ac6add57-235c-4ee7-9973-8b9a78aa902c",
    sandbox: "9d8cd8ba-f185-4cd3-8264-728874697bf4",
  },
} as const satisfies Record<PolarOfferKey, Record<PolarServer, string>>;

/** The Polar product of one offer on one server. */
export function polarProductIdFor(
  offer: PolarOfferKey,
  server: PolarServer
): string {
  return polarProductIds[offer][server];
}

/**
 * The offer a Polar product sells, on either server: a webhook names the
 * product of its own server. Another product sells no offer.
 */
export function polarOfferOf(productId: string): Option.Option<PolarOfferKey> {
  return Arr.findFirst(
    PolarOfferKey.literals,
    (offer) =>
      polarProductIds[offer].production === productId ||
      polarProductIds[offer].sandbox === productId
  );
}
