import * as z from "zod";
import {
  getConvexConfig,
  runConvexActionWithArgs,
  runConvexQueryWithArgs,
} from "../sync-content/convexApi";
import { loadEnvFile } from "../sync-content/runtime";

const CUSTOMER_PAGE_SIZE = 100;
const DEFAULT_REPAIR_LIMIT = 25;

const customerIntegrityUserPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  page: z.array(
    z.object({
      authId: z.string(),
      email: z.string(),
      userId: z.string(),
    })
  ),
});

const customerIntegrityCustomerPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  page: z.array(
    z.object({
      externalId: z.string().nullable(),
      localCustomerId: z.string(),
      polarCustomerId: z.string(),
      userId: z.string(),
    })
  ),
});

const customerIntegritySubscriptionPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  page: z.array(
    z.object({
      currentPeriodEnd: z.string().nullable(),
      customerId: z.string(),
      status: z.string(),
      subscriptionId: z.string(),
    })
  ),
});

const nullSchema = z.null();
const repairCustomerResultSchema = z.union([
  z.object({
    localCustomerId: z.string(),
    status: z.literal("synced"),
  }),
  z.object({
    existingExternalId: z.string().nullable(),
    polarCustomerId: z.string(),
    status: z.literal("conflict"),
  }),
]);

/** Parses one optional numeric CLI flag. */
function getOptionalNumericFlag(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return null;
  }

  const rawValue = process.argv[index + 1];

  if (!rawValue) {
    throw new Error(`Missing value for ${flag}`);
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
}

/** Parses one optional string CLI flag. */
function getOptionalStringFlag(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];

  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

/** Reads every page from one bounded internal customer-integrity query. */
async function collectIntegrityPages<T>(
  prod: boolean,
  functionPath: string,
  schema: z.ZodType<{
    continueCursor: string;
    isDone: boolean;
    page: T[];
  }>
) {
  const config = getConvexConfig({ prod });
  const rows: T[] = [];
  let continueCursor: string | null = null;

  while (true) {
    const result: {
      continueCursor: string;
      isDone: boolean;
      page: T[];
    } = await runConvexQueryWithArgs(
      config,
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

/** Builds the current customer cohesion report from live Convex data. */
async function getCustomerIntegrityReport(prod: boolean) {
  const [users, customers, subscriptions] = await Promise.all([
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
}

/** Repairs one user by rerunning the backend-owned customer sync action. */
async function repairCustomerForUser(prod: boolean, userId: string) {
  const config = getConvexConfig({ prod });

  return await runConvexActionWithArgs(
    config,
    "customers/actions/internal:repairCustomer",
    { userId },
    repairCustomerResultSchema
  );
}

/** Deletes one safe stale Polar customer from Polar and the local database. */
async function cleanupStalePolarCustomer(
  prod: boolean,
  {
    existingExternalId,
    polarCustomerId,
  }: {
    existingExternalId: string | null;
    polarCustomerId: string;
  }
) {
  const config = getConvexConfig({ prod });

  return await runConvexActionWithArgs(
    config,
    "customers/actions/internal:cleanupStalePolarCustomer",
    { existingExternalId, polarCustomerId },
    nullSchema
  );
}

/** Repairs missing customer rows and optionally cleans safe stale Polar customers. */
async function main() {
  loadEnvFile();

  const prod = process.argv.includes("--prod");
  const force = process.argv.includes("--force");
  const cleanupOrphans = process.argv.includes("--cleanup-orphans");
  const limit = getOptionalNumericFlag("--limit") ?? DEFAULT_REPAIR_LIMIT;
  const userId = getOptionalStringFlag("--user");
  const report = await getCustomerIntegrityReport(prod);
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
    console.log(
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
    await cleanupStalePolarCustomer(prod, {
      existingExternalId: orphan.externalId,
      polarCustomerId: orphan.polarCustomerId,
    });
    deletedOrphans.push(orphan.polarCustomerId);
  }

  const repaired: string[] = [];
  const failed: Array<{ error: string; userId: string }> = [];

  for (const user of usersToRepair) {
    try {
      const result = await repairCustomerForUser(prod, user.userId);

      if (result.status === "conflict" && cleanupOrphans) {
        await cleanupStalePolarCustomer(prod, {
          existingExternalId: result.existingExternalId,
          polarCustomerId: result.polarCustomerId,
        });

        const retried = await repairCustomerForUser(prod, user.userId);

        if (retried.status === "conflict") {
          throw new Error(
            `Customer conflict remained after cleanup for ${user.userId}`
          );
        }
      }

      repaired.push(user.userId);
    } catch (error) {
      failed.push({
        error: String(error),
        userId: user.userId,
      });
    }
  }

  const nextReport = await getCustomerIntegrityReport(prod);

  console.log(
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

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
