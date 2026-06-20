import { internal } from "@repo/backend/convex/_generated/api";
import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import { log, logError } from "@repo/backend/scripts/sync-content/cli/logging";
import {
  ConvexIdSchema,
  mutableArraySchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import {
  callConvexQuery,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex/client";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime/files";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
} from "convex/server";
import { Effect, Schema } from "effect";

const CUSTOMER_PAGE_SIZE = 100;

interface PageResult {
  continueCursor: string;
  isDone: boolean;
  page: unknown[];
}

type CustomerIntegrityQuery = FunctionReference<
  "query",
  "internal" | "public",
  { paginationOpts: PaginationOptions },
  PageResult
>;

type PageRow<TFunction extends CustomerIntegrityQuery> =
  FunctionReturnType<TFunction>["page"][number];

const customerIntegrityUserPageSchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(
      Schema.Struct({
        authId: Schema.String,
        email: Schema.String,
        userId: ConvexIdSchema("users"),
      })
    ),
  })
);

const customerIntegrityCustomerPageSchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(
      Schema.Struct({
        externalId: Schema.NullOr(Schema.String),
        localCustomerId: ConvexIdSchema("customers"),
        polarCustomerId: Schema.String,
        userId: ConvexIdSchema("users"),
      })
    ),
  })
);

const customerIntegritySubscriptionPageSchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(
      Schema.Struct({
        currentPeriodEnd: Schema.NullOr(Schema.String),
        customerId: Schema.String,
        status: Schema.String,
        subscriptionId: Schema.String,
      })
    ),
  })
);

/** Reads every page from one bounded internal customer-integrity query. */
const collectIntegrityPages = Effect.fn("customers.collectIntegrityPages")(
  function* <TFunction extends CustomerIntegrityQuery, Encoded>(
    prod: boolean,
    query: TFunction,
    schema: Schema.Schema<FunctionReturnType<TFunction>, Encoded, never>
  ) {
    const config = yield* getConvexConfig({ prod });
    const rows: PageRow<TFunction>[] = [];
    let continueCursor: string | null = null;

    while (true) {
      const args: FunctionArgs<TFunction> = {
        paginationOpts: {
          cursor: continueCursor,
          numItems: CUSTOMER_PAGE_SIZE,
        },
      };
      const result = yield* callConvexQuery(config, query, args, schema);

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
      internal.customers.integrity.internal.listUsersForCustomerIntegrity,
      customerIntegrityUserPageSchema
    ),
    collectIntegrityPages(
      prod,
      internal.customers.integrity.internal.listCustomersForIntegrity,
      customerIntegrityCustomerPageSchema
    ),
    collectIntegrityPages(
      prod,
      internal.customers.integrity.internal.listActiveSubscriptionsForIntegrity,
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
