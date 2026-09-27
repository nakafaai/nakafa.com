import { beforeEach, describe, expect, it } from "@effect/vitest";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import type {
  PolarCustomerErrorUnion,
  PolarDuplicateEmailError,
} from "@repo/backend/confect/customers/polar/spec";
import { ConfigProvider, Effect } from "effect";

const sdk = vi.hoisted(() => ({
  checkout: vi.fn(),
  portal: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  external: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@polar-sh/sdk/funcs/checkoutsCreate", () => ({
  checkoutsCreate: sdk.checkout,
}));
vi.mock("@polar-sh/sdk/funcs/customerSessionsCreate", () => ({
  customerSessionsCreate: sdk.portal,
}));
vi.mock("@polar-sh/sdk/funcs/customersCreate", () => ({
  customersCreate: sdk.create,
}));
vi.mock("@polar-sh/sdk/funcs/customersDelete", () => ({
  customersDelete: sdk.delete,
}));
vi.mock("@polar-sh/sdk/funcs/customersGet", () => ({ customersGet: sdk.get }));
vi.mock("@polar-sh/sdk/funcs/customersGetExternal", () => ({
  customersGetExternal: sdk.external,
}));
vi.mock("@polar-sh/sdk/funcs/customersList", () => ({
  customersList: sdk.list,
}));
vi.mock("@polar-sh/sdk/funcs/customersUpdate", () => ({
  customersUpdate: sdk.update,
}));

const customer = {
  id: "customer-1",
  externalId: "user-1",
  email: "learner@example.com",
  name: "Learner",
  metadata: { userId: "user-1" },
};
const checkout = {
  customerId: customer.id,
  customerIpAddress: null,
  locale: "en" as const,
  productIds: ["pro"],
  successUrl: "https://example.com/success",
};
const configured = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromEnv({ env: { POLAR_ACCESS_TOKEN: "polar_test" } })
);
const operations: ReadonlyArray<{
  code: string;
  mock: typeof sdk.create;
  effect: Effect.Effect<
    unknown,
    PolarCustomerErrorUnion | PolarDuplicateEmailError
  >;
}> = [
  {
    code: "POLAR_CHECKOUT_ERROR",
    mock: sdk.checkout,
    effect: polarGateway.createCheckoutSession(checkout),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    mock: sdk.create,
    effect: polarGateway.createCustomer(customer),
  },
  {
    code: "POLAR_PORTAL_ERROR",
    mock: sdk.portal,
    effect: polarGateway.createCustomerPortalSession(customer.id),
  },
  {
    code: "POLAR_DELETE_ERROR",
    mock: sdk.delete,
    effect: polarGateway.deleteCustomer(customer.id),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    mock: sdk.list,
    effect: polarGateway.findCustomerByEmail(customer.email),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    mock: sdk.external,
    effect: polarGateway.getCustomerByExternalId(customer.externalId),
  },
  {
    code: "POLAR_CUSTOMER_ERROR",
    mock: sdk.get,
    effect: polarGateway.getCustomerById(customer.id),
  },
  {
    code: "POLAR_UPDATE_ERROR",
    mock: sdk.update,
    effect: polarGateway.updateCustomer({ customer, next: customer }),
  },
  {
    code: "POLAR_UPDATE_ERROR",
    mock: sdk.update,
    effect: polarGateway.updateCustomerMetadata({
      polarCustomerId: customer.id,
      metadata: customer.metadata,
    }),
  },
];

function responseMeta(status: number) {
  return {
    response: new Response(null, { status }),
    request: new Request("https://api.polar.sh/v1/customers"),
    body: "",
  };
}

describe("live Polar gateway", () => {
  beforeEach(() => vi.resetAllMocks());

  it.effect(
    "projects checkout and portal URLs and preserves customer identity at the SDK boundary",
    () =>
      Effect.gen(function* () {
        sdk.checkout.mockResolvedValue({
          ok: true,
          value: { url: "https://checkout.polar.sh/session" },
        });
        sdk.portal.mockResolvedValue({
          ok: true,
          value: { customerPortalUrl: "https://polar.sh/portal" },
        });
        sdk.create.mockResolvedValue({ ok: true, value: customer });
        sdk.get.mockResolvedValue({ ok: true, value: customer });
        sdk.external.mockResolvedValue({ ok: true, value: customer });
        sdk.list.mockResolvedValue({
          ok: true,
          value: { result: { items: [customer] } },
        });
        sdk.update.mockResolvedValue({ ok: true, value: customer });
        sdk.delete.mockResolvedValue({ ok: true, value: undefined });
        expect(yield* polarGateway.createCheckoutSession(checkout)).toEqual({
          url: "https://checkout.polar.sh/session",
        });
        expect(sdk.checkout).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            products: ["pro"],
            customerId: customer.id,
            allowDiscountCodes: true,
          })
        );
        expect(
          yield* polarGateway.createCustomerPortalSession(customer.id)
        ).toEqual({ url: "https://polar.sh/portal" });
        expect(sdk.portal).toHaveBeenCalledWith(expect.anything(), {
          customerId: customer.id,
        });
        expect(yield* polarGateway.createCustomer(customer)).toEqual(customer);
        expect(sdk.create).toHaveBeenCalledWith(expect.anything(), {
          email: customer.email,
          externalId: customer.externalId,
          metadata: customer.metadata,
          name: customer.name,
        });
        expect(yield* polarGateway.getCustomerById(customer.id)).toEqual(
          customer
        );
        expect(
          yield* polarGateway.getCustomerByExternalId(customer.externalId)
        ).toEqual(customer);
        expect(yield* polarGateway.findCustomerByEmail(customer.email)).toEqual(
          customer
        );
        expect(sdk.list).toHaveBeenCalledWith(expect.anything(), {
          email: customer.email,
          limit: 1,
        });
        sdk.list.mockResolvedValueOnce({
          ok: true,
          value: { result: { items: [] } },
        });
        expect(
          yield* polarGateway.findCustomerByEmail(customer.email)
        ).toBeNull();
        expect(
          yield* polarGateway.updateCustomer({
            customer,
            next: { ...customer, name: "Updated" },
          })
        ).toEqual(customer);
        expect(sdk.update).toHaveBeenLastCalledWith(expect.anything(), {
          id: customer.id,
          customerUpdate: {
            email: customer.email,
            externalId: customer.externalId,
            metadata: customer.metadata,
            name: "Updated",
          },
        });
        expect(
          yield* polarGateway.updateCustomerMetadata({
            polarCustomerId: customer.id,
            metadata: { consent: true },
          })
        ).toEqual(customer);
        expect(sdk.update).toHaveBeenLastCalledWith(expect.anything(), {
          id: customer.id,
          customerUpdate: { metadata: { consent: true } },
        });
        expect(yield* polarGateway.deleteCustomer(customer.id)).toBeNull();
        expect(sdk.delete).toHaveBeenCalledWith(expect.anything(), {
          id: customer.id,
          anonymize: true,
        });
      }).pipe(configured)
  );

  it.effect(
    "keeps returned and rejected provider failures in each operation's typed error channel",
    () =>
      Effect.gen(function* () {
        for (const operation of operations) {
          operation.mock.mockResolvedValueOnce({
            ok: false,
            error: new Error("provider unavailable"),
          });
          expect(yield* operation.effect.pipe(Effect.flip)).toMatchObject({
            code: operation.code,
            cause: expect.objectContaining({ message: "provider unavailable" }),
            message: expect.not.stringContaining("provider unavailable"),
          });
          operation.mock.mockRejectedValueOnce(new Error("connection lost"));
          expect(yield* operation.effect.pipe(Effect.flip)).toMatchObject({
            code: operation.code,
            cause: expect.objectContaining({ message: "connection lost" }),
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
          expect(operation.mock).not.toHaveBeenCalled();
        }
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
        for (const { mock, effect: operation } of operations.filter(
          ({ mock }) =>
            mock === sdk.get || mock === sdk.external || mock === sdk.delete
        )) {
          const missing = new PolarError("missing", responseMeta(404));
          mock.mockResolvedValueOnce({ ok: false, error: missing });
          expect(yield* operation).toBeNull();
          mock.mockRejectedValueOnce(missing);
          expect(yield* operation).toBeNull();
          mock.mockResolvedValueOnce({
            ok: false,
            error: new PolarError("access denied", responseMeta(403)),
          });
          expect(yield* operation.pipe(Effect.flip)).toMatchObject({
            cause: expect.objectContaining({ message: "access denied" }),
            message: expect.not.stringContaining("access denied"),
          });
        }
      }).pipe(configured)
  );

  it.effect(
    "recognizes the exact duplicate-email conflict without reclassifying unrelated validation errors",
    () =>
      Effect.gen(function* () {
        const duplicate = new HTTPValidationError(
          {
            detail: [
              {
                loc: ["body", "email"],
                msg: "A customer with this email address already exists.",
                type: "value_error",
              },
            ],
          },
          responseMeta(422)
        );
        sdk.create.mockResolvedValueOnce({ ok: false, error: duplicate });
        expect(
          yield* polarGateway.createCustomer(customer).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PolarDuplicateEmailError",
          code: "POLAR_DUPLICATE_EMAIL",
        });
        sdk.create.mockRejectedValueOnce(duplicate);
        expect(
          yield* polarGateway.createCustomer(customer).pipe(Effect.flip)
        ).toMatchObject({ _tag: "PolarDuplicateEmailError" });
        for (const detail of [
          undefined,
          [
            {
              loc: ["email"],
              msg: duplicate.detail?.[0]?.msg ?? "",
              type: "value_error",
            },
          ],
          [
            {
              loc: ["query", "email"],
              msg: "invalid email",
              type: "value_error",
            },
          ],
          [{ loc: ["body", "name"], msg: "invalid name", type: "value_error" }],
          [
            {
              loc: ["body", "email"],
              msg: "invalid email",
              type: "value_error",
            },
          ],
        ]) {
          sdk.create.mockResolvedValueOnce({
            ok: false,
            error: new HTTPValidationError({ detail }, responseMeta(422)),
          });
          expect(
            yield* polarGateway.createCustomer(customer).pipe(Effect.flip)
          ).toMatchObject({ _tag: "PolarCustomerError" });
        }
      }).pipe(configured)
  );
});
