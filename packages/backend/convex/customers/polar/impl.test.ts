import {
  ensureCustomer,
  normalizeStoredCustomer,
} from "@repo/backend/convex/customers/polar/impl";
import {
  type EnsurePolarCustomerInput,
  PolarCustomerEmailConflict,
  PolarCustomerError,
  type PolarCustomerGateway,
  PolarDuplicateEmailError,
  polarCustomerErrorCode,
  polarDuplicateEmailCode,
  type StoredPolarCustomer,
} from "@repo/backend/convex/customers/polar/spec";
import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

const input: EnsurePolarCustomerInput = {
  email: "nakafaai@gmail.com",
  externalId: "auth-user",
  metadata: { userId: "user-1" },
  name: "Nakafa Tekno Kreatif",
};

function unusedGatewayCall() {
  return Effect.die(new Error("Unexpected Polar gateway call."));
}

function createGateway(overrides: Partial<PolarCustomerGateway>) {
  const gateway: PolarCustomerGateway = {
    createCheckoutSession: unusedGatewayCall,
    createCustomer: unusedGatewayCall,
    createCustomerPortalSession: unusedGatewayCall,
    deleteCustomer: unusedGatewayCall,
    findCustomerByEmail: unusedGatewayCall,
    getCustomerByExternalId: unusedGatewayCall,
    getCustomerById: unusedGatewayCall,
    updateCustomer: unusedGatewayCall,
    updateCustomerMetadata: unusedGatewayCall,
  };

  return { ...gateway, ...overrides };
}

describe("customers/polar/impl", () => {
  it("normalizes Polar customer metadata to Convex-storable primitive values", async () => {
    const customer = await Effect.runPromise(
      normalizeStoredCustomer({
        email: "nakafaai@gmail.com",
        externalId: null,
        id: "polar-customer",
        metadata: {
          ignored: { nested: true },
          isTeacher: false,
          note: "active",
          score: 10,
        },
        name: null,
      })
    );

    expect(customer).toEqual({
      email: "nakafaai@gmail.com",
      externalId: null,
      id: "polar-customer",
      metadata: {
        isTeacher: false,
        note: "active",
        score: 10,
      },
      name: null,
    });
  });

  it("normalizes missing Polar metadata to an empty record", async () => {
    const customer = await Effect.runPromise(
      normalizeStoredCustomer({
        email: "nakafaai@gmail.com",
        externalId: undefined,
        id: "polar-customer",
        name: undefined,
      })
    );

    expect(customer).toEqual({
      email: "nakafaai@gmail.com",
      externalId: null,
      id: "polar-customer",
      metadata: {},
      name: null,
    });
  });

  it("rejects Polar customers that cannot be linked to an email address", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        normalizeStoredCustomer({
          externalId: null,
          id: "polar-customer",
          metadata: {},
          name: "Missing Email",
        })
      )
    );

    if (Either.isRight(result)) {
      throw new Error("Expected missing email to fail.");
    }

    expect(result.left).toBeInstanceOf(PolarCustomerError);
    expect(result.left.message).toContain("missing a valid email address");
  });

  it("keeps an already-synced local Polar customer without writing updates", async () => {
    let updateCount = 0;
    const gateway = createGateway({
      getCustomerById: () =>
        Effect.succeed({
          email: input.email,
          externalId: input.externalId,
          id: "polar-local",
          metadata: input.metadata,
          name: input.name,
        }),
      updateCustomer: () => {
        updateCount += 1;
        return unusedGatewayCall();
      },
    });

    const customer = await Effect.runPromise(
      ensureCustomer(gateway, {
        ...input,
        localCustomerId: "polar-local",
      })
    );

    expect(customer).toMatchObject({
      externalId: input.externalId,
      id: "polar-local",
    });
    expect(updateCount).toBe(0);
  });

  it("treats omitted input metadata as an empty metadata record", async () => {
    let updateCount = 0;
    const gateway = createGateway({
      getCustomerByExternalId: () =>
        Effect.succeed({
          email: input.email,
          externalId: input.externalId,
          id: "polar-external",
          metadata: {},
          name: input.name,
        }),
      updateCustomer: () => {
        updateCount += 1;
        return unusedGatewayCall();
      },
    });

    const customer = await Effect.runPromise(
      ensureCustomer(gateway, {
        email: input.email,
        externalId: input.externalId,
        name: input.name,
      })
    );

    expect(customer).toMatchObject({
      id: "polar-external",
      metadata: {},
    });
    expect(updateCount).toBe(0);
  });

  it("creates a new customer when no existing Polar identity is found", async () => {
    const gateway = createGateway({
      createCustomer: (next) =>
        Effect.succeed({
          email: next.email,
          externalId: next.externalId,
          id: "polar-created",
          metadata: next.metadata,
          name: next.name,
        }),
      getCustomerByExternalId: () => Effect.succeed(null),
    });

    const customer = await Effect.runPromise(ensureCustomer(gateway, input));

    expect(customer).toMatchObject({
      externalId: input.externalId,
      id: "polar-created",
    });
  });

  it("uses an existing external-id customer before creating a new one", async () => {
    let createCount = 0;
    const gateway = createGateway({
      createCustomer: () => {
        createCount += 1;
        return unusedGatewayCall();
      },
      getCustomerByExternalId: () =>
        Effect.succeed({
          email: input.email,
          externalId: input.externalId,
          id: "polar-external",
          metadata: input.metadata,
          name: input.name,
        }),
    });

    const customer = await Effect.runPromise(ensureCustomer(gateway, input));

    expect(customer).toMatchObject({
      externalId: input.externalId,
      id: "polar-external",
    });
    expect(createCount).toBe(0);
  });

  it("continues lookup when a stored local customer ID no longer exists in Polar", async () => {
    let createCount = 0;
    const gateway = createGateway({
      createCustomer: (next) => {
        createCount += 1;
        return Effect.succeed({
          email: next.email,
          externalId: next.externalId,
          id: "polar-created",
          metadata: next.metadata,
          name: next.name,
        });
      },
      getCustomerByExternalId: () => Effect.succeed(null),
      getCustomerById: () => Effect.succeed(null),
    });

    const customer = await Effect.runPromise(
      ensureCustomer(gateway, {
        ...input,
        localCustomerId: "stale-polar-id",
      })
    );

    expect(customer).toMatchObject({
      id: "polar-created",
    });
    expect(createCount).toBe(1);
  });

  it("relinks an existing email customer when externalId is still unset", async () => {
    const updates: Array<{
      customer: StoredPolarCustomer;
      next: EnsurePolarCustomerInput;
    }> = [];
    const gateway = createGateway({
      createCustomer: () =>
        Effect.fail(
          new PolarDuplicateEmailError({
            code: polarDuplicateEmailCode,
            message: "Duplicate email",
          })
        ),
      findCustomerByEmail: () =>
        Effect.succeed({
          email: "nakafaai@gmail.com",
          externalId: null,
          id: "polar-existing",
          metadata: {},
          name: "Existing Customer",
        }),
      getCustomerByExternalId: () => Effect.succeed(null),
      updateCustomer: (update) => {
        updates.push(update);

        return Effect.succeed({
          email: update.next.email,
          externalId: update.next.externalId,
          id: update.customer.id,
          metadata: update.next.metadata,
          name: update.next.name,
        });
      },
    });

    const customer = await Effect.runPromise(ensureCustomer(gateway, input));

    expect(customer).toMatchObject({
      externalId: "auth-user",
      id: "polar-existing",
    });
    expect(updates).toEqual([
      expect.objectContaining({
        customer: expect.objectContaining({ id: "polar-existing" }),
        next: expect.objectContaining({ externalId: "auth-user" }),
      }),
    ]);
  });

  it("keeps duplicate-email conflicts typed when another externalId owns the customer", async () => {
    const gateway = createGateway({
      createCustomer: () =>
        Effect.fail(
          new PolarDuplicateEmailError({
            code: polarDuplicateEmailCode,
            message: "Duplicate email",
          })
        ),
      findCustomerByEmail: () =>
        Effect.succeed({
          email: "nakafaai@gmail.com",
          externalId: "different-auth",
          id: "polar-existing",
          metadata: {},
          name: "Existing Customer",
        }),
      getCustomerByExternalId: () => Effect.succeed(null),
    });

    const result = await Effect.runPromise(
      Effect.either(ensureCustomer(gateway, input))
    );

    if (Either.isRight(result)) {
      throw new Error("Expected duplicate email ownership to fail.");
    }

    expect(result.left).toBeInstanceOf(PolarCustomerEmailConflict);
    expect(result.left).toMatchObject({
      code: "POLAR_CUSTOMER_EMAIL_CONFLICT",
      existingExternalId: "different-auth",
      polarCustomerId: "polar-existing",
    });
  });

  it("retries external-id lookup after a create race failure", async () => {
    let externalIdLookupCount = 0;
    const gateway = createGateway({
      createCustomer: () =>
        Effect.fail(
          new PolarCustomerError({
            code: polarCustomerErrorCode,
            message: "Create failed",
          })
        ),
      getCustomerByExternalId: () => {
        externalIdLookupCount += 1;

        if (externalIdLookupCount === 1) {
          return Effect.succeed(null);
        }

        return Effect.succeed({
          email: "nakafaai@gmail.com",
          externalId: "auth-user",
          id: "polar-race",
          metadata: { userId: "user-1" },
          name: "Nakafa Tekno Kreatif",
        });
      },
    });

    const customer = await Effect.runPromise(ensureCustomer(gateway, input));

    expect(customer).toMatchObject({
      externalId: "auth-user",
      id: "polar-race",
    });
    expect(externalIdLookupCount).toBe(2);
  });

  it("keeps create failures typed when duplicate-email recovery cannot find a customer", async () => {
    const gateway = createGateway({
      createCustomer: () =>
        Effect.fail(
          new PolarDuplicateEmailError({
            code: polarDuplicateEmailCode,
            message: "Duplicate email",
          })
        ),
      findCustomerByEmail: () => Effect.succeed(null),
      getCustomerByExternalId: () => Effect.succeed(null),
    });

    const result = await Effect.runPromise(
      Effect.either(ensureCustomer(gateway, input))
    );

    if (Either.isRight(result)) {
      throw new Error("Expected unrecovered duplicate email to fail.");
    }

    expect(result.left).toBeInstanceOf(PolarCustomerError);
    expect(result.left).toMatchObject({
      code: polarCustomerErrorCode,
      message: "Duplicate email",
    });
  });
});
