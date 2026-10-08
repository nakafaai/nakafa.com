import { beforeEach, describe, expect, it } from "@effect/vitest";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import type {
  EnsurePolarCustomerInput,
  PolarCheckoutInput,
  PolarCustomerErrorUnion,
  PolarDuplicateEmailError,
  StoredPolarCustomer,
} from "@repo/backend/confect/customers/polar/spec";
import { ConfigProvider, Effect, Record as Rec } from "effect";

const polarFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.stubGlobal("fetch", polarFetch);

const configured = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromEnv({ env: { POLAR_ACCESS_TOKEN: "polar_test" } })
);
const customerWire = {
  email: "learner@example.com",
  external_id: "user-1",
  id: "customer-1",
  metadata: { userId: "user-1" },
  name: "Learner",
};
const customer = {
  email: "learner@example.com",
  externalId: "user-1",
  id: "customer-1",
  metadata: { userId: "user-1" },
  name: "Learner",
};
const next: EnsurePolarCustomerInput = {
  email: "learner@example.com",
  externalId: "user-1",
  metadata: { userId: "user-1" },
  name: "Learner",
};
const stored: StoredPolarCustomer = { ...customer };
const checkout: PolarCheckoutInput = {
  customerId: "customer-1",
  customerIpAddress: null,
  locale: "en",
  productIds: ["pro"],
  successUrl: "https://example.com/success",
};
const operations: ReadonlyArray<{
  readonly code: string;
  readonly effect: Effect.Effect<
    unknown,
    PolarCustomerErrorUnion | PolarDuplicateEmailError
  >;
}> = [
  {
    code: "POLAR_CHECKOUT_ERROR",
    effect: polarGateway.createCheckoutSession(checkout),
  },
  { code: "POLAR_CUSTOMER_ERROR", effect: polarGateway.createCustomer(next) },
  {
    code: "POLAR_PORTAL_ERROR",
    effect: polarGateway.createCustomerPortalSession("customer-1"),
  },
  {
    code: "POLAR_DELETE_ERROR",
    effect: polarGateway.deleteCustomer("customer-1"),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    effect: polarGateway.findCustomerByEmail("learner@example.com"),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    effect: polarGateway.getCustomerByExternalId("user-1"),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    effect: polarGateway.getCustomerById("customer-1"),
  },
  {
    code: "POLAR_UPDATE_ERROR",
    effect: polarGateway.updateCustomer({ customer: stored, next }),
  },
  {
    code: "POLAR_UPDATE_ERROR",
    effect: polarGateway.updateCustomerMetadata({
      polarCustomerId: "customer-1",
      metadata: { consent: true },
    }),
  },
];

function reply(status: number, body?: unknown) {
  return body === undefined
    ? new Response(null, { status })
    : Response.json(body, { status });
}

/** The request the SDK sent for one fetch call, read as the wire saw it. */
function sentRequest(index: number) {
  const [input, init] = polarFetch.mock.calls[index];
  return new Request(input, init);
}

function sentBody(index: number) {
  return Effect.promise(() => sentRequest(index).json());
}

describe("live Polar gateway", () => {
  beforeEach(() => polarFetch.mockReset());

  it.effect(
    "sends each customer call as its snake_case Polar request and maps the response",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(201, { url: "https://checkout.polar.sh/session" })
        );
        expect(yield* polarGateway.createCheckoutSession(checkout)).toEqual({
          url: "https://checkout.polar.sh/session",
        });
        expect(sentRequest(0).method).toBe("POST");
        expect(new URL(sentRequest(0).url).pathname).toBe("/v1/checkouts/");
        expect(yield* sentBody(0)).toEqual({
          allow_discount_codes: true,
          allow_trial: true,
          customer_id: "customer-1",
          customer_ip_address: null,
          is_business_customer: false,
          locale: "en",
          products: ["pro"],
          require_billing_address: false,
          success_url: "https://example.com/success",
        });

        polarFetch.mockResolvedValueOnce(
          reply(201, { customer_portal_url: "https://polar.sh/portal" })
        );
        expect(
          yield* polarGateway.createCustomerPortalSession("customer-1")
        ).toEqual({ url: "https://polar.sh/portal" });
        expect(new URL(sentRequest(1).url).pathname).toBe(
          "/v1/customer-sessions/"
        );
        expect(yield* sentBody(1)).toEqual({ customer_id: "customer-1" });

        polarFetch.mockResolvedValueOnce(reply(201, customerWire));
        expect(yield* polarGateway.createCustomer(next)).toEqual(customer);
        expect(yield* sentBody(2)).toEqual({
          email: "learner@example.com",
          external_id: "user-1",
          metadata: { userId: "user-1" },
          name: "Learner",
          type: "individual",
        });

        polarFetch.mockResolvedValueOnce(
          reply(200, { items: [customerWire], pagination: {} })
        );
        expect(
          yield* polarGateway.findCustomerByEmail("learner@example.com")
        ).toEqual(customer);
        expect(
          Rec.fromEntries(new URL(sentRequest(3).url).searchParams.entries())
        ).toEqual({ email: "learner@example.com", limit: "1", page: "1" });

        polarFetch.mockResolvedValueOnce(
          reply(200, { items: [], pagination: {} })
        );
        expect(
          yield* polarGateway.findCustomerByEmail("learner@example.com")
        ).toBeNull();

        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        expect(yield* polarGateway.getCustomerByExternalId("user-1")).toEqual(
          customer
        );
        expect(new URL(sentRequest(5).url).pathname).toBe(
          "/v1/customers/external/user-1"
        );

        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        expect(yield* polarGateway.getCustomerById("customer-1")).toEqual(
          customer
        );
        expect(new URL(sentRequest(6).url).pathname).toBe(
          "/v1/customers/customer-1"
        );

        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        expect(
          yield* polarGateway.updateCustomer({
            customer: stored,
            next: { ...next, name: "Updated" },
          })
        ).toEqual(customer);
        expect(sentRequest(7).method).toBe("PATCH");
        expect(yield* sentBody(7)).toEqual({
          email: "learner@example.com",
          external_id: "user-1",
          metadata: { userId: "user-1" },
          name: "Updated",
        });

        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        expect(
          yield* polarGateway.updateCustomerMetadata({
            polarCustomerId: "customer-1",
            metadata: { consent: true },
          })
        ).toEqual(customer);
        expect(yield* sentBody(8)).toEqual({ metadata: { consent: true } });

        polarFetch.mockResolvedValueOnce(reply(204));
        expect(yield* polarGateway.deleteCustomer("customer-1")).toBeNull();
        expect(sentRequest(9).method).toBe("DELETE");
        expect(new URL(sentRequest(9).url).search).toBe("?anonymize=true");
      }).pipe(configured)
  );

  it.effect(
    "leaves out the optional fields a caller did not set and sends the ones it did",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(201, { url: "https://checkout.polar.sh/session" })
        );
        yield* polarGateway.createCheckoutSession({
          ...checkout,
          embedOrigin: "https://nakafa.com",
          subscriptionId: "subscription-1",
        });
        expect(yield* sentBody(0)).toMatchObject({
          embed_origin: "https://nakafa.com",
          subscription_id: "subscription-1",
        });

        polarFetch.mockResolvedValueOnce(reply(201, customerWire));
        yield* polarGateway.createCustomer({
          email: "learner@example.com",
          externalId: "user-1",
          name: "Learner",
        });
        expect(yield* sentBody(1)).not.toHaveProperty("metadata");

        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        yield* polarGateway.updateCustomer({
          customer: stored,
          next: {
            email: "learner@example.com",
            externalId: "user-1",
            name: "Learner",
          },
        });
        expect(yield* sentBody(2)).not.toHaveProperty("metadata");
      }).pipe(configured)
  );

  it.effect(
    "keeps rejected and failed provider calls in each operation's typed error channel",
    () =>
      Effect.gen(function* () {
        for (const operation of operations) {
          polarFetch.mockResolvedValueOnce(
            reply(500, { detail: "provider unavailable" })
          );
          expect(yield* operation.effect.pipe(Effect.flip)).toMatchObject({
            code: operation.code,
            cause: expect.objectContaining({ statusCode: 500 }),
            message: expect.not.stringContaining("provider unavailable"),
          });
          polarFetch.mockRejectedValueOnce(new TypeError("connection lost"));
          expect(yield* operation.effect.pipe(Effect.flip)).toMatchObject({
            code: operation.code,
            cause: expect.objectContaining({
              message: expect.stringContaining("connection lost"),
            }),
            message: expect.not.stringContaining("connection lost"),
          });
        }
      }).pipe(configured)
  );

  it.effect(
    "rejects missing configuration before making any provider call",
    () =>
      Effect.gen(function* () {
        for (const operation of operations) {
          expect(yield* operation.effect.pipe(Effect.flip)).toMatchObject({
            code: operation.code,
            message: expect.not.stringContaining("polar_test"),
          });
        }
        expect(polarFetch).not.toHaveBeenCalled();
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: {} })
        )
      )
  );

  it.effect(
    "treats only a provider 404 as an absent or already deleted customer",
    () =>
      Effect.gen(function* () {
        const lookups: readonly Effect.Effect<
          unknown,
          PolarCustomerErrorUnion
        >[] = [
          polarGateway.getCustomerById("customer-1"),
          polarGateway.getCustomerByExternalId("user-1"),
          polarGateway.deleteCustomer("customer-1"),
        ];
        for (const lookup of lookups) {
          polarFetch.mockResolvedValueOnce(
            reply(404, { error: "ResourceNotFound", detail: "Not found" })
          );
          expect(yield* lookup).toBeNull();
          polarFetch.mockResolvedValueOnce(
            reply(403, { detail: "access denied" })
          );
          expect(yield* lookup.pipe(Effect.flip)).toMatchObject({
            cause: expect.objectContaining({ statusCode: 403 }),
          });
        }
        polarFetch.mockResolvedValueOnce(reply(404, { detail: "Not found" }));
        expect(
          yield* polarGateway
            .findCustomerByEmail("learner@example.com")
            .pipe(Effect.flip)
        ).toMatchObject({ code: "POLAR_CUSTOMER_ERROR" });
      }).pipe(configured)
  );

  it.effect(
    "recognizes the exact duplicate-email conflict without reclassifying unrelated validation errors",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(422, {
            detail: [
              {
                loc: ["body", "email"],
                msg: "A customer with this email address already exists.",
                type: "value_error",
              },
            ],
          })
        );
        expect(
          yield* polarGateway.createCustomer(next).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PolarDuplicateEmailError",
          code: "POLAR_DUPLICATE_EMAIL",
        });
        for (const body of [
          {},
          {
            detail: [
              {
                loc: ["email"],
                msg: "A customer with this email address already exists.",
                type: "value_error",
              },
            ],
          },
          {
            detail: [
              {
                loc: ["query", "email"],
                msg: "invalid email",
                type: "value_error",
              },
            ],
          },
          {
            detail: [
              {
                loc: ["body", "name"],
                msg: "invalid name",
                type: "value_error",
              },
            ],
          },
          {
            detail: [
              {
                loc: ["body", "email"],
                msg: "invalid email",
                type: "value_error",
              },
            ],
          },
        ]) {
          polarFetch.mockResolvedValueOnce(reply(422, body));
          expect(
            yield* polarGateway.createCustomer(next).pipe(Effect.flip)
          ).toMatchObject({ _tag: "PolarCustomerError" });
        }
      }).pipe(configured)
  );

  it.effect(
    "fails a provider payload that breaks the customer contract as a typed request failure",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(200, { id: "customer-1", name: "Learner" })
        );
        expect(
          yield* polarGateway.getCustomerById("customer-1").pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PolarCustomerError",
          code: "POLAR_CUSTOMER_ERROR",
          cause: expect.objectContaining({ _tag: "PolarPayloadError" }),
        });
      }).pipe(configured)
  );
});
