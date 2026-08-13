import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import type { Id, TableNames } from "@repo/backend/convex/_generated/dataModel";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { getFunctionName } from "convex/server";
import {
  Config,
  ConfigProvider,
  Effect,
  Option,
  ParseResult,
  Schema,
} from "effect";

interface CustomerConvexTarget {
  readonly accessToken: string;
  readonly url: string;
}

const ConvexResponseSchema = Schema.Struct({
  errorMessage: Schema.optional(Schema.String),
  status: Schema.Literal("success", "error"),
  value: Schema.optional(Schema.Unknown),
});

class CustomerRuntimeError extends Schema.TaggedError<CustomerRuntimeError>()(
  "CustomerRuntimeError",
  { message: Schema.String }
) {}

/** Validates a Convex document ID while preserving its generated table brand. */
export const ConvexIdSchema = <const TableName extends TableNames>(
  tableName: TableName
) =>
  Schema.String.pipe(
    Schema.filter((value): value is Id<TableName> => value.length > 0, {
      message: () => `Expected ${tableName} document ID`,
    })
  );

/** Builds a decoded mutable array schema for generated Convex return types. */
export const mutableArraySchema = <A, I>(schema: Schema.Schema<A, I, never>) =>
  Schema.mutable(Schema.Array(schema));

/** Builds customer verifier config from the shell and backend-local env file. */
export const loadCustomerEnvProvider = Effect.fn("customers.loadEnvProvider")(
  function* () {
    const env = ConfigProvider.fromEnv();
    const map = yield* readBackendEnv;

    if (map.size === 0) {
      return env;
    }

    return ConfigProvider.orElse(env, () => ConfigProvider.fromMap(map));
  }
);

/** Reads and validates one internal customer-integrity query. */
export const readCustomerQuery = Effect.fn("customers.readQuery")(function* <
  Query extends FunctionReference<
    "query",
    "internal" | "public",
    DefaultFunctionArgs,
    unknown
  >,
  Encoded,
>(
  prod: boolean,
  query: Query,
  args: FunctionArgs<Query>,
  schema: Schema.Schema<FunctionReturnType<Query>, Encoded, never>
) {
  const target = yield* readCustomerConvexTarget(prod);
  const functionPath = yield* Effect.try({
    try: () => getFunctionName(query),
    catch: (error) => runtimeError(error),
  });
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${target.url}/api/query`, {
        body: JSON.stringify({ args, format: "json", path: functionPath }),
        headers: {
          Authorization: `Convex ${target.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    catch: (error) => runtimeError(error),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (error) => runtimeError(error),
    });
    return yield* new CustomerRuntimeError({
      message: `${functionPath}: HTTP ${response.status} ${body}`,
    });
  }

  const json = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (error) => runtimeError(error),
  });
  const envelope = yield* Schema.decodeUnknown(ConvexResponseSchema)(json).pipe(
    Effect.mapError((error) =>
      runtimeError(ParseResult.TreeFormatter.formatErrorSync(error))
    )
  );

  if (envelope.status === "error") {
    return yield* new CustomerRuntimeError({
      message: `${functionPath}: ${envelope.errorMessage ?? "Unknown Convex error"}`,
    });
  }

  return yield* Schema.decodeUnknown(schema)(envelope.value).pipe(
    Effect.mapError((error) =>
      runtimeError(ParseResult.TreeFormatter.formatErrorSync(error))
    )
  );
});

/** Writes one customer verifier result line. */
export function writeCustomerReport(message: string) {
  process.stdout.write(`${message}\n`);
}

/** Writes one customer verifier failure line. */
export function writeCustomerError(message: string) {
  process.stderr.write(`ERROR: ${message}\n`);
}

const readBackendEnv = Effect.gen(function* () {
  const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const envPath = resolve(backendDir, ".env.local");
  const content = yield* Effect.try({
    try: () => readFileSync(envPath, "utf8"),
    catch: () => "",
  });

  if (content === "") {
    return new Map<string, string>();
  }

  return yield* Effect.try({
    try: () =>
      new Map(
        Object.entries(parseEnv(content)).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      ),
    catch: (error) => runtimeError(error),
  });
});

const readCustomerConvexTarget = Effect.fn("customers.readConvexTarget")(
  function* (prod: boolean) {
    const configName = prod ? "CONVEX_PROD_URL" : "CONVEX_URL";
    const url = yield* Config.nonEmptyString(configName).pipe(
      Effect.mapError(
        () => new CustomerRuntimeError({ message: `${configName} is not set.` })
      )
    );
    const deployKey = yield* Config.option(
      Config.nonEmptyString("CONVEX_DEPLOY_KEY")
    );

    if (Option.isSome(deployKey)) {
      return {
        accessToken: deployKey.value,
        url,
      } satisfies CustomerConvexTarget;
    }

    const content = yield* Effect.try({
      try: () =>
        readFileSync(join(homedir(), ".convex", "config.json"), "utf8"),
      catch: () =>
        new CustomerRuntimeError({
          message: "No CONVEX_DEPLOY_KEY and no local Convex login.",
        }),
    });
    const parsed = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: (error) => runtimeError(error),
    });
    const auth = yield* Schema.decodeUnknown(
      Schema.Struct({ accessToken: Schema.optional(Schema.String) })
    )(parsed).pipe(Effect.mapError(runtimeError));

    if (!auth.accessToken) {
      return yield* new CustomerRuntimeError({
        message: "The local Convex login has no access token.",
      });
    }

    return {
      accessToken: auth.accessToken,
      url,
    } satisfies CustomerConvexTarget;
  }
);

function runtimeError(error: unknown) {
  return new CustomerRuntimeError({
    message: error instanceof Error ? error.message : String(error),
  });
}
