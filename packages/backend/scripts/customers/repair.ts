import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
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
import { Effect } from "effect";

const CUSTOMER_PAGE_SIZE = 100;
const DEFAULT_REPAIR_LIMIT = 25;

type PageItem<Query extends Ref.AnyQuery> =
  Ref.Returns<Query> extends { readonly page: readonly (infer Item)[] }
    ? Item
    : never;

type RepairCustomerUserId = Ref.Args<
  typeof refs.internal.customers.actions.internalFunctions.repairCustomer
>["userId"];

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
  function* <Query extends Ref.AnyQuery>(
    prod: boolean,
    ref: Query,
    getArgs: (cursor: string | null) => Ref.Args<Query>
  ) {
    const config = yield* getConvexConfig({ prod });
    const rows: PageItem<Query>[] = [];
    let continueCursor: string | null = null;

    while (true) {
      const result: Ref.Returns<Query> = yield* callConvex(
        config,
        "query",
        ref,
        getArgs(continueCursor)
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
      refs.internal.customers.queries.internalFunctions.maintenance
        .listUsersForCustomerIntegrity,
      (cursor) => ({
        paginationOpts: { cursor, numItems: CUSTOMER_PAGE_SIZE },
      })
    ),
    collectIntegrityPages(
      prod,
      refs.internal.customers.queries.internalFunctions.maintenance
        .listCustomersForIntegrity,
      (cursor) => ({
        paginationOpts: { cursor, numItems: CUSTOMER_PAGE_SIZE },
      })
    ),
    collectIntegrityPages(
      prod,
      refs.internal.customers.queries.internalFunctions.maintenance
        .listActiveSubscriptionsForIntegrity,
      (cursor) => ({
        paginationOpts: { cursor, numItems: CUSTOMER_PAGE_SIZE },
      })
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
  function* (prod: boolean, userId: RepairCustomerUserId) {
    const config = yield* getConvexConfig({ prod });

    return yield* callConvex(
      config,
      "action",
      refs.internal.customers.actions.internalFunctions.repairCustomer,
      { userId }
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
    refs.internal.customers.actions.internalFunctions.cleanupStalePolarCustomer,
    { existingExternalId, polarCustomerId }
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
