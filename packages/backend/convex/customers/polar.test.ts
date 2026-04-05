import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockCustomersCreate,
  mockCustomersGet,
  mockCustomersGetExternal,
  mockCustomersList,
  mockCustomersUpdate,
} = vi.hoisted(() => ({
  mockCustomersCreate: vi.fn(),
  mockCustomersGet: vi.fn(),
  mockCustomersGetExternal: vi.fn(),
  mockCustomersList: vi.fn(),
  mockCustomersUpdate: vi.fn(),
}));

vi.mock("@repo/backend/convex/utils/polar/client", () => ({
  polarClient: {},
}));
vi.mock("@polar-sh/sdk/funcs/checkoutsCreate.js", () => ({
  checkoutsCreate: vi.fn(),
}));
vi.mock("@polar-sh/sdk/funcs/customerSessionsCreate.js", () => ({
  customerSessionsCreate: vi.fn(),
}));
vi.mock("@polar-sh/sdk/funcs/customersCreate.js", () => ({
  customersCreate: mockCustomersCreate,
}));
vi.mock("@polar-sh/sdk/funcs/customersDelete.js", () => ({
  customersDelete: vi.fn(),
}));
vi.mock("@polar-sh/sdk/funcs/customersGet.js", () => ({
  customersGet: mockCustomersGet,
}));
vi.mock("@polar-sh/sdk/funcs/customersGetExternal.js", () => ({
  customersGetExternal: mockCustomersGetExternal,
}));
vi.mock("@polar-sh/sdk/funcs/customersList.js", () => ({
  customersList: mockCustomersList,
}));
vi.mock("@polar-sh/sdk/funcs/customersUpdate.js", () => ({
  customersUpdate: mockCustomersUpdate,
}));

import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror.js";
import { ensurePolarCustomer } from "@repo/backend/convex/customers/polar";

/** Builds the exact Polar duplicate-email validation error used by reconciliation. */
function createDuplicateEmailError() {
  return new HTTPValidationError(
    {
      detail: [
        {
          input: "nakafaai@gmail.com",
          loc: ["body", "email"],
          msg: "A customer with this email address already exists.",
          type: "value_error",
        },
      ],
    },
    {
      body: "{}",
      request: new Request("https://example.com"),
      response: new Response("{}", {
        headers: {
          "content-type": "application/json",
        },
        status: 422,
      }),
    }
  );
}

/** Builds the exact Polar missing-customer error used by external-id fallback. */
function createMissingPolarCustomerError() {
  return new PolarError("missing", {
    body: "{}",
    request: new Request("https://example.com"),
    response: new Response("{}", {
      headers: {
        "content-type": "application/json",
      },
      status: 404,
    }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("customers/polar", () => {
  it("relinks an existing email customer when externalId is still unset", async () => {
    mockCustomersGetExternal.mockRejectedValueOnce(
      createMissingPolarCustomerError()
    );
    mockCustomersCreate.mockResolvedValueOnce({
      error: createDuplicateEmailError(),
      ok: false,
    });
    mockCustomersList.mockResolvedValueOnce({
      ok: true,
      value: {
        result: {
          items: [
            {
              email: "nakafaai@gmail.com",
              externalId: null,
              id: "polar-existing",
              metadata: {},
              name: "Existing Customer",
            },
          ],
        },
      },
    });
    mockCustomersUpdate.mockResolvedValueOnce({
      ok: true,
      value: {
        email: "nakafaai@gmail.com",
        externalId: "auth-user",
        id: "polar-existing",
        metadata: { userId: "user-1" },
        name: "Nakafa Tekno Kreatif",
      },
    });

    const customer = await ensurePolarCustomer({
      email: "nakafaai@gmail.com",
      externalId: "auth-user",
      metadata: { userId: "user-1" },
      name: "Nakafa Tekno Kreatif",
    });

    expect(customer).toMatchObject({
      externalId: "auth-user",
      id: "polar-existing",
    });
    expect(mockCustomersUpdate).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        customerUpdate: expect.objectContaining({
          externalId: "auth-user",
        }),
        id: "polar-existing",
      })
    );
  });

  it("throws a specific conflict when the email is already owned by another externalId", async () => {
    mockCustomersGetExternal.mockRejectedValueOnce(
      createMissingPolarCustomerError()
    );
    mockCustomersCreate.mockResolvedValueOnce({
      error: createDuplicateEmailError(),
      ok: false,
    });
    mockCustomersList.mockResolvedValueOnce({
      ok: true,
      value: {
        result: {
          items: [
            {
              email: "nakafaai@gmail.com",
              externalId: "different-auth",
              id: "polar-existing",
              metadata: {},
              name: "Existing Customer",
            },
          ],
        },
      },
    });

    let thrown: unknown;

    try {
      await ensurePolarCustomer({
        email: "nakafaai@gmail.com",
        externalId: "auth-user",
        metadata: { userId: "user-1" },
        name: "Nakafa Tekno Kreatif",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConvexError);
    expect((thrown as { data?: unknown }).data).toMatchObject({
      code: "POLAR_CUSTOMER_EMAIL_CONFLICT",
    });
  });
});
