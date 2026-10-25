import { describe, expect, it } from "@effect/vitest";
import {
  BillingOfferKey,
  billingOffer,
} from "@repo/backend/confect/billing/catalog";
import {
  PolarOfferKey,
  PolarServer,
  polarOfferOf,
  polarProductIdFor,
} from "@repo/backend/confect/billing/polar/catalog";
import { Array as Arr, HashSet, Option } from "effect";

describe("billing/polar/catalog", () => {
  it("names a Polar product for exactly the offers whose rails include Polar", () => {
    const soldOnPolar = Arr.filter(BillingOfferKey.literals, (offer) =>
      Arr.contains(billingOffer(offer).rails, "polar")
    );
    expect(soldOnPolar).toEqual([...PolarOfferKey.literals]);
  });

  it("gives every offer on every server its own product", () => {
    const ids = Arr.flatMap(PolarOfferKey.literals, (offer) =>
      Arr.map(PolarServer.literals, (server) =>
        polarProductIdFor(offer, server)
      )
    );
    expect(HashSet.size(HashSet.fromIterable(ids))).toBe(ids.length);
  });

  it("finds the offer of each product on either server", () => {
    for (const offer of PolarOfferKey.literals) {
      for (const server of PolarServer.literals) {
        expect(polarOfferOf(polarProductIdFor(offer, server))).toEqual(
          Option.some(offer)
        );
      }
    }
  });

  it("finds no offer for a product Nakafa does not sell", () => {
    expect(polarOfferOf("00000000-0000-0000-0000-000000000000")).toEqual(
      Option.none()
    );
  });
});
