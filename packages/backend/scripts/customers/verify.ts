import {
  getConvexConfig,
  runConvexQueryWithArgs,
} from "@repo/backend/scripts/sync-content/convexApi";
import { loadEnvFile } from "@repo/backend/scripts/sync-content/runtime";
import * as z from "zod";

const CUSTOMER_PAGE_SIZE = 100;

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
  const usersWithoutCustomer = users.filter(
    (user) => !customerByUserId.has(user.userId)
  );
  const orphanCustomers = customers.filter(
    (customer) => !usersById.has(customer.userId)
  );
  const customersWithExternalIdMismatch = customers.filter((customer) => {
    const user = usersById.get(customer.userId);

    if (!user) {
      return false;
    }

    return customer.externalId !== user.authId;
  });
  const subscriptionsWithoutLocalCustomer = subscriptions.filter(
    (subscription) => !customerByPolarId.has(subscription.customerId)
  );

  return {
    customerCount: customers.length,
    customersWithExternalIdMismatch,
    orphanCustomers,
    subscriptionsWithoutLocalCustomer,
    userCount: users.length,
    usersWithoutCustomer,
  };
}

/** Prints the current customer cohesion report for one deployment. */
async function main() {
  loadEnvFile();

  const prod = process.argv.includes("--prod");
  const report = await getCustomerIntegrityReport(prod);

  console.log(
    JSON.stringify(
      {
        customerCount: report.customerCount,
        customersWithExternalIdMismatchCount:
          report.customersWithExternalIdMismatch.length,
        orphanCustomerCount: report.orphanCustomers.length,
        sampleCustomersWithExternalIdMismatch:
          report.customersWithExternalIdMismatch.slice(0, 10),
        sampleOrphanCustomers: report.orphanCustomers.slice(0, 10),
        sampleSubscriptionsWithoutLocalCustomer:
          report.subscriptionsWithoutLocalCustomer.slice(0, 10),
        sampleUsersWithoutCustomer: report.usersWithoutCustomer.slice(0, 10),
        subscriptionsWithoutLocalCustomerCount:
          report.subscriptionsWithoutLocalCustomer.length,
        userCount: report.userCount,
        usersWithoutCustomerCount: report.usersWithoutCustomer.length,
      },
      null,
      2
    )
  );

  process.exit(
    report.usersWithoutCustomer.length > 0 ||
      report.orphanCustomers.length > 0 ||
      report.customersWithExternalIdMismatch.length > 0 ||
      report.subscriptionsWithoutLocalCustomer.length > 0
      ? 1
      : 0
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
