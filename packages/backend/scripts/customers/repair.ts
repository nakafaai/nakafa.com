import {
  formatScriptCause,
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import {
  callConvex,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex";
import { log, logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime";
import { Effect, Schema } from "effect";

const CUSTOMER_PAGE_SIZE = 100;
const DEFAULT_REPAIR_LIMIT = 25;

interface PageResult<T> {
  continueCursor: string;
  isDone: boolean;
  page: readonly T[];
}

const customerIntegrityUserPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(
    Schema.Struct({
      authId: Schema.String,
      email: Schema.String,
      userId: Schema.String,
    })
  ),
});

const customerIntegrityCustomerPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(
    Schema.Struct({
      externalId: Schema.NullOr(Schema.String),
      localCustomerId: Schema.String,
      polarCustomerId: Schema.String,
      userId: Schema.String,
    })
  ),
});

const customerIntegritySubscriptionPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(
    Schema.Struct({
      currentPeriodEnd: Schema.NullOr(Schema.String),
      customerId: Schema.String,
      status: Schema.String,
      subscriptionId: Schema.String,
    })
  ),
});

const repairCustomerResultSchema = Schema.Union(
  Schema.Struct({
    localCustomerId: Schema.String,
    status: Schema.Literal("synced"),
  }),
  Schema.Struct({
    existingExternalId: Schema.NullOr(Schema.String),
    polarCustomerId: Schema.String,
    status: Schema.Literal("conflict"),
  })
);

/** Parses one optional numeric CLI flag. */
const getOptionalNumericFlag = Effect.fn("customers.getOptionalNumericFlag")(
  function* (args: readonly string[], flag: string) {
    const index = args.indexOf(flag);

    if (index === -1) {
      return null;
    }

    const rawValue = args[index + 1];

    if (!rawValue) {
      return yield* Effect.fail(
        new ScriptFailureError({ message: `Missing value for ${flag}` })
      );
    }

    const value = Number(rawValue);

    if (!Number.isInteger(value) || value <= 0) {
      return yield* Effect.fail(
        new ScriptFailureError({
          message: `${flag} must be a positive integer.`,
        })
      );
    }

    return value;
  }
);

/** Parses one optional string CLI flag. */
const getOptionalStringFlag = Effect.fn("customers.getOptionalStringFlag")(
  function* (args: readonly string[], flag: string) {
    const index = args.indexOf(flag);

    if (index === -1) {
      return null;
    }

    const value = args[index + 1];

    if (!value) {
      return yield* Effect.fail(
        new ScriptFailureError({ message: `Missing value for ${flag}` })
      );
    }

    return value;
  }
);

/** Reads every page from one bounded internal customer-integrity query. */
const collectIntegrityPages = Effect.fn("customers.collectIntegrityPages")(
  function* <T>(
    prod: boolean,
    functionPath: string,
    schema: Schema.Schema<PageResult<T>>
  ) {
    const config = yield* getConvexConfig({ prod });
    const rows: T[] = [];
    let continueCursor: string | null = null;

    while (true) {
      const result: PageResult<T> = yield* callConvex(
        config,
        "query",
        functionPath,
        {
          paginationOpts: {
            cursor: continueCursor,
            numItems: CUSTOMER_PAGE_SIZE,
          },
        },
        schema
      );

      rows.push(...result.page);

      if (result.isDone) {
        return rows;
      }

      continueCursor = result.continueCursor;
    }
  }
);

/** Builds the current customer cohesion report from live Convex data. */
const getCustomerIntegrityReport = Effect.fn(
  "customers.getCustomerIntegrityReport"
)(function* (prod: boolean) {
  const [users, customers, subscriptions] = yield* Effect.all([
    collectIntegrityPages(
      prod,
      "customers/queries/internal/maintenance:listUsersForCustomerIntegrity",
      customerIntegrityUserPageSchema
    ),
    collectIntegrityPages(
      prod,
      "customers/queries/internal/maintenance:listCustomersForIntegrity",
      customerIntegrityCustomerPageSchema
    ),
    collectIntegrityPages(
      prod,
      "customers/queries/internal/maintenance:listActiveSubscriptionsForIntegrity",
      customerIntegritySubscriptionPageSchema
    ),
  ]);
  const usersById = new Map(users.map((user) => [user.userId, user]));
  const customerByUserId = new Map(
    customers.map((customer) => [customer.userId, customer])
  );
  const customerByPolarId = new Map(
    customers.map((customer) => [customer.polarCustomerId, customer])
  );

  return {
    activeSubscriptions: subscriptions,
    customers,
    orphanCustomers: customers.filter(
      (customer) => !usersById.has(customer.userId)
    ),
    subscriptionsWithoutLocalCustomer: subscriptions.filter(
      (subscription) => !customerByPolarId.has(subscription.customerId)
    ),
    users,
    usersWithoutCustomer: users.filter(
      (user) => !customerByUserId.has(user.userId)
    ),
  };
});

/** Repairs one user by rerunning the backend-owned customer sync action. */
const repairCustomerForUser = Effect.fn("customers.repairCustomerForUser")(
  function* (prod: boolean, userId: string) {
    const config = yield* getConvexConfig({ prod });

    return yield* callConvex(
      config,
      "action",
      "customers/actions/internal:repairCustomer",
      { userId },
      repairCustomerResultSchema
    );
  }
);

/** Deletes one safe stale Polar customer from Polar and the local database. */
const cleanupStalePolarCustomer = Effect.fn(
  "customers.cleanupStalePolarCustomer"
)(function* (
  prod: boolean,
  {
    existingExternalId,
    polarCustomerId,
  }: {
    existingExternalId: string | null;
    polarCustomerId: string;
  }
) {
  const config = yield* getConvexConfig({ prod });

  return yield* callConvex(
    config,
    "action",
    "customers/actions/internal:cleanupStalePolarCustomer",
    { existingExternalId, polarCustomerId },
    Schema.Null
  );
});

/** Repairs missing customer rows and optionally cleans safe stale Polar customers. */
const main = Effect.fn("customers.repair")(function* () {
  const args = yield* Effect.sync(() => process.argv.slice(2));
  const prod = args.includes("--prod");
  const force = args.includes("--force");
  const cleanupOrphans = args.includes("--cleanup-orphans");
  const limit =
    (yield* getOptionalNumericFlag(args, "--limit")) ?? DEFAULT_REPAIR_LIMIT;
  const userId = yield* getOptionalStringFlag(args, "--user");
  const report = yield* getCustomerIntegrityReport(prod);
  const usersToRepair = userId
    ? report.usersWithoutCustomer.filter((user) => user.userId === userId)
    : report.usersWithoutCustomer.slice(0, limit);
  const safeOrphans = cleanupOrphans
    ? report.orphanCustomers.filter(
        (customer) =>
          !report.activeSubscriptions.some(
            (subscription) =>
              subscription.customerId === customer.polarCustomerId
          )
      )
    : [];

  if (!force) {
    log(
      JSON.stringify(
        {
          cleanupOrphans,
          dryRun: true,
          prod,
          repairUserIds: usersToRepair.map((user) => user.userId),
          safeOrphanPolarCustomerIds: safeOrphans.map(
            (customer) => customer.polarCustomerId
          ),
          subscriptionsWithoutLocalCustomerCount:
            report.subscriptionsWithoutLocalCustomer.length,
          usersWithoutCustomerCount: report.usersWithoutCustomer.length,
        },
        null,
        2
      )
    );
    return;
  }

  const deletedOrphans: string[] = [];

  for (const orphan of safeOrphans) {
    yield* cleanupStalePolarCustomer(prod, {
      existingExternalId: orphan.externalId,
      polarCustomerId: orphan.polarCustomerId,
    });
    deletedOrphans.push(orphan.polarCustomerId);
  }

  const repaired: string[] = [];
  const failed: Array<{ error: string; userId: string }> = [];

  for (const user of usersToRepair) {
    const repairResult = yield* Effect.either(
      Effect.gen(function* () {
        const result = yield* repairCustomerForUser(prod, user.userId);

        if (result.status === "conflict" && cleanupOrphans) {
          yield* cleanupStalePolarCustomer(prod, {
            existingExternalId: result.existingExternalId,
            polarCustomerId: result.polarCustomerId,
          });

          const retried = yield* repairCustomerForUser(prod, user.userId);

          if (retried.status === "conflict") {
            return yield* Effect.fail(
              new ScriptFailureError({
                message: `Customer conflict remained after cleanup for ${user.userId}`,
              })
            );
          }
        }

        return user.userId;
      })
    );

    if (repairResult._tag === "Left") {
      failed.push({
        error: getUnknownMessage(repairResult.left),
        userId: user.userId,
      });
    } else {
      repaired.push(repairResult.right);
    }
  }

  const nextReport = yield* getCustomerIntegrityReport(prod);

  log(
    JSON.stringify(
      {
        deletedOrphans,
        failed,
        prod,
        repaired,
        remainingOrphanCustomerCount: nextReport.orphanCustomers.length,
        remainingSubscriptionsWithoutLocalCustomerCount:
          nextReport.subscriptionsWithoutLocalCustomer.length,
        remainingUsersWithoutCustomerCount:
          nextReport.usersWithoutCustomer.length,
      },
      null,
      2
    )
  );

  yield* Effect.sync(() => {
    process.exitCode = failed.length > 0 ? 1 : 0;
  });
});

Effect.runPromise(
  Effect.gen(function* () {
    const provider = yield* loadEnvProvider();
    yield* main().pipe(Effect.withConfigProvider(provider));
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        logError(formatScriptCause(cause));
        process.exitCode = 1;
      })
    )
  )
);
