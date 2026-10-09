import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { encodePrettyJsonText } from "@repo/utilities/json";
import { type FunctionArgs, getFunctionName } from "convex/server";
import { ConfigProvider, Effect, Schema } from "effect";

const seam = vi.hoisted(() => ({
  callCustomerIntegrityQuery: vi.fn(),
  getCustomerConvexConfig: vi.fn(),
  loadCustomerEnvProvider: vi.fn(),
}));
vi.mock("@repo/backend/scripts/customers/convex", () => seam);

const usersQuery = getFunctionName(
  internal.customers.integrity.internal.listUsersForCustomerIntegrity
);
const customersQuery = getFunctionName(
  internal.customers.integrity.internal.listCustomersForIntegrity
);
const subscriptionsQuery = getFunctionName(
  internal.customers.integrity.internal.listActiveSubscriptionsForIntegrity
);
const originalArgv = process.argv;
const originalExitCode = process.exitCode;

/** The bytes the script writes for a report: two-space JSON and a trailing newline. */
const printedLine = (report: unknown) => `${encodePrettyJsonText(report)}\n`;

const ada = { authId: "auth-1", email: "ada@example.com", userId: "user-1" };
const grace = {
  authId: "auth-2",
  email: "grace@example.com",
  userId: "user-2",
};
const adaCustomer = {
  externalId: "auth-1",
  localCustomerId: "customer-1",
  polarCustomerId: "polar-1",
  userId: "user-1",
};
const driftedCustomer = {
  externalId: "auth-9",
  localCustomerId: "customer-2",
  polarCustomerId: "polar-2",
  userId: "user-1",
};
const orphanCustomer = {
  externalId: null,
  localCustomerId: "customer-3",
  polarCustomerId: "polar-3",
  userId: "user-gone",
};
const adaSubscription = {
  currentPeriodEnd: "2026-11-08T00:00:00.000Z",
  customerId: "polar-1",
  status: "active",
  subscriptionId: "sub-1",
};
const orphanSubscription = {
  currentPeriodEnd: null,
  customerId: "polar-missing",
  status: "active",
  subscriptionId: "sub-2",
};

const cleanReport = {
  customerCount: 1,
  customersWithExternalIdMismatchCount: 0,
  orphanCustomerCount: 0,
  sampleCustomersWithExternalIdMismatch: [],
  sampleOrphanCustomers: [],
  sampleSubscriptionsWithoutLocalCustomer: [],
  sampleUsersWithoutCustomer: [],
  subscriptionsWithoutLocalCustomerCount: 0,
  userCount: 1,
  usersWithoutCustomerCount: 0,
};
const issueReport = {
  customerCount: 3,
  customersWithExternalIdMismatchCount: 1,
  orphanCustomerCount: 1,
  sampleCustomersWithExternalIdMismatch: [driftedCustomer],
  sampleOrphanCustomers: [orphanCustomer],
  sampleSubscriptionsWithoutLocalCustomer: [orphanSubscription],
  sampleUsersWithoutCustomer: [grace],
  subscriptionsWithoutLocalCustomerCount: 1,
  userCount: 2,
  usersWithoutCustomerCount: 1,
};

/** A final page of rows, as a reviewed query returns its last page. */
const lastPage = (rows: readonly unknown[]) => ({
  continueCursor: "end",
  isDone: true,
  page: rows,
});

/** A reviewed query that fails, which the script must report without a partial report. */
class ScriptedQueryError extends Schema.TaggedError<ScriptedQueryError>()(
  "ScriptedQueryError",
  { message: Schema.String }
) {}

/** Scripted answers to the reviewed queries, keyed by function name. */
type Answers = Record<
  string,
  (cursor: string | null) => Effect.Effect<unknown, ScriptedQueryError>
>;
const cleanAnswers: Answers = {
  [usersQuery]: () => Effect.succeed(lastPage([ada])),
  [customersQuery]: () => Effect.succeed(lastPage([adaCustomer])),
  [subscriptionsQuery]: () => Effect.succeed(lastPage([adaSubscription])),
};
const issueAnswers: Answers = {
  [usersQuery]: (cursor) =>
    Effect.succeed(
      cursor === null
        ? { continueCursor: "users-page-2", isDone: false, page: [ada] }
        : lastPage([grace])
    ),
  [customersQuery]: () =>
    Effect.succeed(lastPage([adaCustomer, driftedCustomer, orphanCustomer])),
  [subscriptionsQuery]: () =>
    Effect.succeed(lastPage([adaSubscription, orphanSubscription])),
};
const failingAnswers: Answers = {
  ...cleanAnswers,
  [customersQuery]: () =>
    Effect.fail(
      new ScriptedQueryError({
        message: `${customersQuery}: HTTP 500 unavailable`,
      })
    ),
};

/** Answers each reviewed query from the script, decoding its page through the schema the script passed. */
const answerQueries =
  (answers: Answers) =>
  (
    _config: unknown,
    query: Parameters<typeof getFunctionName>[0],
    args: FunctionArgs<
      typeof internal.customers.integrity.internal.listUsersForCustomerIntegrity
    >,
    schema: Schema.Codec<unknown>
  ) =>
    answers[getFunctionName(query)](args.paginationOpts.cursor).pipe(
      Effect.flatMap((page) => Schema.decodeUnknownEffect(schema)(page))
    );

/** Captures what the script prints, leaving the test runner's own streams alone. */
const captureOutput = () => ({
  stderr: vi.spyOn(process.stderr, "write").mockReturnValue(true),
  stdout: vi.spyOn(process.stdout, "write").mockReturnValue(true),
});

/** Loads the script, which runs its audit as it loads, and waits for the exit code it sets. */
const runScript = (args: readonly string[], answers: Answers) =>
  Effect.gen(function* () {
    process.argv = ["node", "verify", ...args];
    seam.callCustomerIntegrityQuery.mockImplementation(answerQueries(answers));
    yield* Effect.promise(
      () => import("@repo/backend/scripts/customers/verify")
    );
    yield* Effect.promise(() =>
      vi.waitFor(() => {
        expect(process.exitCode).toBeDefined();
      })
    );
  });

beforeEach(() => {
  vi.resetModules();
  process.exitCode = undefined;
  seam.loadCustomerEnvProvider.mockReturnValue(
    Effect.succeed(ConfigProvider.fromEnvRecord({}))
  );
  seam.getCustomerConvexConfig.mockReturnValue(
    Effect.succeed({
      accessToken: "verify-token",
      url: "https://verify.example",
    })
  );
});
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("customer integrity verification script", () => {
  it.effect("prints a clean report for production and exits zero", () =>
    Effect.gen(function* () {
      const output = captureOutput();
      yield* runScript(["--prod"], cleanAnswers);
      expect(seam.getCustomerConvexConfig).toHaveBeenCalledWith(true);
      expect(output.stdout).toHaveBeenCalledExactlyOnceWith(
        printedLine(cleanReport)
      );
      expect(output.stderr).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(0);
    })
  );

  it.effect("pages through users and prints each integrity finding", () =>
    Effect.gen(function* () {
      const output = captureOutput();
      yield* runScript([], issueAnswers);
      expect(seam.callCustomerIntegrityQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { paginationOpts: { cursor: "users-page-2", numItems: 100 } },
        expect.anything()
      );
      expect(output.stdout).toHaveBeenCalledExactlyOnceWith(
        printedLine(issueReport)
      );
      expect(output.stderr).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    })
  );

  it.effect("prints no partial report when an integrity query fails", () =>
    Effect.gen(function* () {
      const output = captureOutput();
      yield* runScript([], failingAnswers);
      expect(output.stdout).not.toHaveBeenCalled();
      expect(output.stderr).toHaveBeenCalledExactlyOnceWith(
        `ERROR: ${customersQuery}: HTTP 500 unavailable\n`
      );
      expect(process.exitCode).toBe(1);
    })
  );
});
