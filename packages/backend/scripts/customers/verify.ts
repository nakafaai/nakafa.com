import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import {
  callConvex,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex";
import { log, logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime";
import { Effect, Schema } from "effect";

const CUSTOMER_PAGE_SIZE = 100;

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
      "customers/integrity/internal:listUsersForCustomerIntegrity",
      customerIntegrityUserPageSchema
    ),
    collectIntegrityPages(
      prod,
      "customers/integrity/internal:listCustomersForIntegrity",
      customerIntegrityCustomerPageSchema
    ),
    collectIntegrityPages(
      prod,
      "customers/integrity/internal:listActiveSubscriptionsForIntegrity",
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
});

/** Prints the current customer cohesion report for one deployment. */
const main = Effect.fn("customers.verify")(function* () {
  const args = yield* Effect.sync(() => process.argv.slice(2));
  const prod = args.includes("--prod");
  const report = yield* getCustomerIntegrityReport(prod);

  log(
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

  const hasIntegrityIssues =
    report.usersWithoutCustomer.length > 0 ||
    report.orphanCustomers.length > 0 ||
    report.customersWithExternalIdMismatch.length > 0 ||
    report.subscriptionsWithoutLocalCustomer.length > 0;

  yield* Effect.sync(() => {
    process.exitCode = hasIntegrityIssues ? 1 : 0;
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
