import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  grantRole,
  invitePerson,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const polarGateway = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createCustomer: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  findCustomerByEmail: vi.fn(),
  getCustomerByExternalId: vi.fn(),
  updateCustomer: vi.fn(),
}));
vi.mock("@repo/backend/confect/billing/polar/live", () => ({ polarGateway }));

const nf = slugOf("nf");
const other = slugOf("other");
const { checkout } = refs.public.billing.polar.school;
const siswa = Schema.decodeSync(Email)("siswa@other.example.test");

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
  polarGateway.getCustomerByExternalId.mockReturnValue(Effect.succeed(null));
  polarGateway.createCustomer.mockReturnValue(
    Effect.succeed({
      email: "owner@example.com",
      externalId: "owner",
      id: "polar-owner",
      name: "Owner",
    })
  );
  polarGateway.createCheckoutSession.mockReturnValue(
    Effect.succeed({ url: "https://sandbox.polar.sh/checkout/school" })
  );
});

describe("billing/polar/school", () => {
  it.effect(
    "starts the Polar checkout of a school's unpaid seats for its Owner, as a business, back to its billing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = yield* fixture.run(
          invitePerson(fixture.tenants.other, siswa)
        );
        yield* fixture.run(
          grantRole(fixture.tenants.other, personId, "student", {
            kind: "tenant",
          })
        );
        const started = yield* fixture.as("otherOwner").action(checkout, {
          locale: "de",
          offer: "school.seat.year",
          slug: other,
        });
        expect(started).toEqual({
          url: "https://sandbox.polar.sh/checkout/school",
        });
        expect(polarGateway.createCheckoutSession).toHaveBeenCalledWith({
          customerId: "polar-owner",
          customerIpAddress: null,
          locale: "de",
          productIds: [polarProductIdFor("school.seat.year", "sandbox")],
          school: { seats: 1, tenantId: fixture.tenants.other },
          successUrl: "http://localhost:3000/school/other/settings/billing",
        });
      })
  );

  it.effect(
    "refuses an offer the school's rail does not sell, and a viewer who may not pay",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const unsold = yield* fixture
          .as("owner")
          .action(checkout, {
            locale: "id",
            offer: "school.seat.month",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(unsold._tag).toBe("CheckoutOfferUnavailable");
        const teacher = yield* fixture
          .as("teacher")
          .action(checkout, {
            locale: "id",
            offer: "school.seat.year",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(teacher._tag).toBe("AccessDenied");
        expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
      })
  );
});
