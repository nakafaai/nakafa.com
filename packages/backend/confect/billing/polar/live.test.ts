import { beforeEach, describe, expect, it } from "@effect/vitest";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import { ConfigProvider, Effect } from "effect";

const polarFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.stubGlobal("fetch", polarFetch);

const customerWire = {
  email: "learner@example.com",
  external_id: "user-1",
  id: "cust_1",
  name: "Learner",
  type: "individual",
};

const identity = {
  email: "learner@example.com",
  externalId: "user-1",
  name: "Learner",
};

/** A Polar response with a status, and a JSON body when the test gives one. */
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

/** The error an effect failed with, so each test can assert its tag. */
const failureOf = <A, E extends { readonly _tag: string }>(
  effect: Effect.Effect<A, E>
) => Effect.map(Effect.flip(effect), (error) => error._tag);

describe("billing/polar/live", () => {
  beforeEach(() => polarFetch.mockReset());

  it.effect(
    "creates a checkout session for the customer and returns its URL",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(201, { url: "https://checkout.polar.sh/session" })
        );
        expect(
          yield* polarGateway.createCheckoutSession({
            customerId: "cust_1",
            customerIpAddress: null,
            locale: "en",
            productIds: ["product_1"],
            successUrl: "https://nakafa.com/done",
          })
        ).toEqual({ url: "https://checkout.polar.sh/session" });
        const request = sentRequest(0);
        expect(request.method).toBe("POST");
        expect(new URL(request.url).pathname).toBe("/v1/checkouts/");
        expect(yield* Effect.promise(() => request.json())).toMatchObject({
          customer_id: "cust_1",
          locale: "en",
          products: ["product_1"],
        });
      })
  );

  it.effect("maps a failed checkout to the checkout error", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
      expect(
        yield* failureOf(
          polarGateway.createCheckoutSession({
            customerId: "cust_1",
            customerIpAddress: null,
            locale: "en",
            productIds: ["product_1"],
            successUrl: "https://nakafa.com/done",
          })
        )
      ).toBe("PolarCheckoutError");
    })
  );

  it.effect("creates an individual customer keyed by the Nakafa user ID", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(201, customerWire));
      expect(yield* polarGateway.createCustomer(identity)).toEqual({
        billingCountry: null,
        email: "learner@example.com",
        externalId: "user-1",
        id: "cust_1",
        name: "Learner",
      });
      expect(yield* Effect.promise(() => sentRequest(0).json())).toMatchObject({
        external_id: "user-1",
        type: "individual",
      });
    })
  );

  it.effect("maps a customer whose email is taken to the duplicate error", () =>
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
      expect(yield* failureOf(polarGateway.createCustomer(identity))).toBe(
        "PolarDuplicateEmailError"
      );
    })
  );

  it.effect(
    "maps any other failed customer creation to the customer error",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
        expect(yield* failureOf(polarGateway.createCustomer(identity))).toBe(
          "PolarCustomerError"
        );
      })
  );

  it.effect("opens a customer portal session and returns its URL", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(
        reply(201, { customer_portal_url: "https://polar.sh/portal" })
      );
      expect(yield* polarGateway.createCustomerPortalSession("cust_1")).toEqual(
        {
          url: "https://polar.sh/portal",
        }
      );
      expect(yield* Effect.promise(() => sentRequest(0).json())).toEqual({
        customer_id: "cust_1",
      });
    })
  );

  it.effect("maps a failed portal session to the portal error", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
      expect(
        yield* failureOf(polarGateway.createCustomerPortalSession("cust_1"))
      ).toBe("PolarPortalError");
    })
  );

  it.effect(
    "deletes and anonymizes a customer, and treats a customer Polar no longer holds as deleted",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(reply(204));
        expect(yield* polarGateway.deleteCustomer("cust_1")).toBeNull();
        expect(new URL(sentRequest(0).url).searchParams.get("anonymize")).toBe(
          "true"
        );
        polarFetch.mockResolvedValueOnce(reply(404, { detail: "Not found" }));
        expect(yield* polarGateway.deleteCustomer("cust_gone")).toBeNull();
      })
  );

  it.effect("maps a failed customer deletion to the delete error", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
      expect(yield* failureOf(polarGateway.deleteCustomer("cust_1"))).toBe(
        "PolarDeleteError"
      );
    })
  );

  it.effect(
    "loads the customer of a Nakafa user ID, and returns none for a user Polar does not know",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        expect(yield* polarGateway.getCustomerByExternalId("user-1")).toEqual({
          billingCountry: null,
          email: "learner@example.com",
          externalId: "user-1",
          id: "cust_1",
          name: "Learner",
        });
        expect(new URL(sentRequest(0).url).pathname).toBe(
          "/v1/customers/external/user-1"
        );
        polarFetch.mockResolvedValueOnce(reply(404, { detail: "Not found" }));
        expect(
          yield* polarGateway.getCustomerByExternalId("user-2")
        ).toBeNull();
      })
  );

  it.effect(
    "reads a customer by its Polar ID with its billing country, and reads an absent customer as none",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(200, {
            ...customerWire,
            billing_address: { country: "ID" },
          })
        );
        expect(yield* polarGateway.getCustomer("cust_1")).toEqual({
          billingCountry: "ID",
          email: "learner@example.com",
          externalId: "user-1",
          id: "cust_1",
          name: "Learner",
        });
        expect(new URL(sentRequest(0).url).pathname).toBe(
          "/v1/customers/cust_1"
        );
        polarFetch.mockResolvedValueOnce(reply(404, { detail: "Not found" }));
        expect(yield* polarGateway.getCustomer("cust_2")).toBeNull();
      })
  );

  it.effect("maps a failed customer read to the customer error", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
      expect(yield* failureOf(polarGateway.getCustomer("cust_1"))).toBe(
        "PolarCustomerError"
      );
    })
  );

  it.effect(
    "lists one page of the subscriptions that hold access or owe a payment, with the last page",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(200, {
            items: [{ id: "sub_1" }],
            pagination: { max_page: 3, total_count: 250 },
          })
        );
        expect(yield* polarGateway.listSubscriptions(2, 100)).toEqual({
          items: [{ id: "sub_1" }],
          maxPage: 3,
        });
        const url = new URL(sentRequest(0).url);
        expect(url.searchParams.get("page")).toBe("2");
        expect(url.searchParams.get("limit")).toBe("100");
        expect(url.searchParams.getAll("status")).toEqual([
          "active",
          "trialing",
          "past_due",
          "unpaid",
        ]);
      })
  );

  it.effect("maps a failed subscription listing to the listing error", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
      expect(yield* failureOf(polarGateway.listSubscriptions(1, 100))).toBe(
        "PolarSubscriptionListError"
      );
    })
  );

  it.effect(
    "finds the customer that holds an email address, none when no customer does, and maps a failed search to the customer error",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(
          reply(200, {
            items: [customerWire],
            pagination: { max_page: 1, total_count: 1 },
          })
        );
        expect(
          yield* polarGateway.findCustomerByEmail("learner@example.com")
        ).toEqual({
          billingCountry: null,
          email: "learner@example.com",
          externalId: "user-1",
          id: "cust_1",
          name: "Learner",
        });
        const url = new URL(sentRequest(0).url);
        expect(url.searchParams.get("email")).toBe("learner@example.com");
        expect(url.searchParams.get("limit")).toBe("1");
        polarFetch.mockResolvedValueOnce(
          reply(200, { items: [], pagination: { max_page: 0, total_count: 0 } })
        );
        expect(
          yield* polarGateway.findCustomerByEmail("nobody@example.com")
        ).toBeNull();
        polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
        expect(
          yield* failureOf(
            polarGateway.findCustomerByEmail("learner@example.com")
          )
        ).toBe("PolarCustomerError");
      })
  );

  it.effect("maps a failed customer lookup to the customer error", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
      expect(
        yield* failureOf(polarGateway.getCustomerByExternalId("user-1"))
      ).toBe("PolarCustomerError");
    })
  );

  it.effect(
    "syncs a customer's email and name, and maps a failed sync to the update error",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(reply(200, customerWire));
        expect(
          yield* polarGateway.updateCustomer({
            customerId: "cust_1",
            identity,
          })
        ).toMatchObject({ id: "cust_1" });
        expect(
          yield* Effect.promise(() => sentRequest(0).json())
        ).toMatchObject({
          email: "learner@example.com",
          external_id: "user-1",
          name: "Learner",
        });
        polarFetch.mockResolvedValueOnce(reply(500, { detail: "down" }));
        expect(
          yield* failureOf(
            polarGateway.updateCustomer({ customerId: "cust_1", identity })
          )
        ).toBe("PolarUpdateError");
      })
  );

  it.effect(
    "fails every operation as its own error when no Polar access token is configured",
    () =>
      Effect.gen(function* () {
        const withoutToken = Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: {} })
        );
        expect(
          yield* failureOf(
            polarGateway.createCustomer(identity).pipe(withoutToken)
          )
        ).toBe("PolarCustomerError");
        expect(
          yield* failureOf(
            polarGateway.deleteCustomer("cust_1").pipe(withoutToken)
          )
        ).toBe("PolarDeleteError");
        expect(polarFetch).not.toHaveBeenCalled();
      })
  );
});

describe("billing/polar/live responses", () => {
  beforeEach(() => polarFetch.mockReset());

  it.effect("refuses a checkout response that carries no URL", () =>
    Effect.gen(function* () {
      polarFetch.mockResolvedValueOnce(reply(201, {}));
      expect(
        yield* failureOf(
          polarGateway.createCheckoutSession({
            customerId: "cust_1",
            customerIpAddress: null,
            locale: "en",
            productIds: ["product_1"],
            successUrl: "https://nakafa.com/done",
          })
        )
      ).toBe("PolarCheckoutError");
    })
  );
});

describe("billing/polar/live duplicate check", () => {
  beforeEach(() => polarFetch.mockReset());

  it.effect.each([
    [
      {
        loc: ["body", "email"],
        msg: "Another validation message.",
        type: "value_error",
      },
    ],
    [
      {
        loc: ["query", "email"],
        msg: "A customer with this email address already exists.",
        type: "value_error",
      },
    ],
  ])(
    "keeps a validation error that does not name a taken email as a customer error",
    ([detail]) =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(reply(422, { detail: [detail] }));
        expect(yield* failureOf(polarGateway.createCustomer(identity))).toBe(
          "PolarCustomerError"
        );
      })
  );

  it.effect(
    "keeps a validation error without details as a customer error",
    () =>
      Effect.gen(function* () {
        polarFetch.mockResolvedValueOnce(reply(422, {}));
        expect(yield* failureOf(polarGateway.createCustomer(identity))).toBe(
          "PolarCustomerError"
        );
      })
  );
});
