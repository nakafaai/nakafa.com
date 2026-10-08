import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id, TableNames } from "@repo/backend/convex/_generated/dataModel";
import {
  callCustomerIntegrityQuery,
  getCustomerConvexConfig,
  loadCustomerEnvProvider,
} from "@repo/backend/scripts/customers/convex";
import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  HashMap,
  MutableList,
  Option,
  Schema,
  Struct,
  Tuple,
} from "effect";

const CUSTOMER_PAGE_SIZE = 100;
const PrettyJsonSchema = Schema.fromJsonString(Schema.Unknown, { space: 2 });
const writeLine = (message: string) => {
  process.stdout.write(`${message}\n`);
};
const writeError = (message: string) => {
  process.stderr.write(`ERROR: ${message}\n`);
};
const ConvexIdSchema = <const TableName extends TableNames>(
  tableName: TableName
) =>
  Schema.declare<Id<TableName>>(
    (value): value is Id<TableName> =>
      typeof value === "string" && value.length > 0,
    { description: `Expected ${tableName} document ID` }
  );
const mutableArraySchema = <A, I>(schema: Schema.Codec<A, I, never, never>) =>
  Schema.mutable(Schema.Array(schema));
const PageResultSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(Schema.Unknown),
});
type PageResult = typeof PageResultSchema.Type;
const PaginationArgsSchema = Schema.Struct({
  paginationOpts: Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    numItems: Schema.Finite,
    endCursor: Schema.optionalKey(Schema.NullOr(Schema.String)),
    maximumRowsRead: Schema.optionalKey(Schema.Finite),
    maximumBytesRead: Schema.optionalKey(Schema.Finite),
  }),
});
type CustomerIntegrityQuery = FunctionReference<
  "query",
  "internal" | "public",
  typeof PaginationArgsSchema.Type,
  PageResult
>;
type PageRow<TFunction extends CustomerIntegrityQuery> =
  FunctionReturnType<TFunction>["page"][number];
const customerIntegrityUserPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: mutableArraySchema(
    Schema.Struct({
      authId: Schema.String,
      email: Schema.String,
      userId: ConvexIdSchema("users"),
    })
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const customerIntegrityCustomerPageSchema = Schema.Struct({
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
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const customerIntegritySubscriptionPageSchema = Schema.Struct({
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
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Reads every page from one bounded internal customer-integrity query. */
const collectIntegrityPages = Effect.fn("customers.collectIntegrityPages")(
  function* <TFunction extends CustomerIntegrityQuery, Encoded>(
    prod: boolean,
    query: TFunction,
    schema: Schema.Codec<FunctionReturnType<TFunction>, Encoded, never, never>
  ) {
    const config = yield* getCustomerConvexConfig(prod);
    const rows = MutableList.make<PageRow<TFunction>>();
    let continueCursor: string | null = null;
    while (true) {
      const args: FunctionArgs<TFunction> = {
        paginationOpts: {
          cursor: continueCursor,
          numItems: CUSTOMER_PAGE_SIZE,
        },
      };
      const result = yield* callCustomerIntegrityQuery(
        config,
        query,
        args,
        schema
      );
      MutableList.appendAll(rows, result.page);
      if (result.isDone) {
        return MutableList.toArray(rows);
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
  const usersById = HashMap.fromIterable(
    Arr.map(users, (user) => Tuple.make(user.userId, user))
  );
  const customerByUserId = HashMap.fromIterable(
    Arr.map(customers, (customer) => Tuple.make(customer.userId, customer))
  );
  const customerByPolarId = HashMap.fromIterable(
    Arr.map(customers, (customer) =>
      Tuple.make(customer.polarCustomerId, customer)
    )
  );
  const usersWithoutCustomer = Arr.filter(
    users,
    (user) => !HashMap.has(customerByUserId, user.userId)
  );
  const orphanCustomers = Arr.filter(
    customers,
    (customer) => !HashMap.has(usersById, customer.userId)
  );
  const customersWithExternalIdMismatch = Arr.filter(customers, (customer) =>
    Option.exists(
      HashMap.get(usersById, customer.userId),
      (user) => customer.externalId !== user.authId
    )
  );
  const subscriptionsWithoutLocalCustomer = Arr.filter(
    subscriptions,
    (subscription) => !HashMap.has(customerByPolarId, subscription.customerId)
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
  const json = yield* Schema.encodeEffect(PrettyJsonSchema)({
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
  }).pipe(Effect.orDie);
  writeLine(json);
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
    const provider = yield* loadCustomerEnvProvider();
    yield* main().pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider)
    );
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        writeError(formatScriptCause(cause));
        process.exitCode = 1;
      })
    ),
    Effect.provide(nodeServicesLayer)
  )
);
