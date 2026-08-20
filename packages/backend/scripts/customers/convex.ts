import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { getFunctionName } from "convex/server";
import { Config, ConfigProvider, Effect, Option, Schema } from "effect";

interface CustomerConvexConfig {
  accessToken: string;
  url: string;
}
type CustomerIntegrityQuery = FunctionReference<
  "query",
  "internal" | "public",
  DefaultFunctionArgs,
  unknown
>;
const ConvexAuthConfigSchema = Schema.Struct({
  accessToken: Schema.optional(Schema.String),
});
const ConvexResponseSchema = Schema.Struct({
  errorMessage: Schema.optional(Schema.String),
  status: Schema.Literals(["success", "error"]),
  value: Schema.optional(Schema.Unknown),
});
class CustomerConvexConfigError extends Schema.TaggedError<CustomerConvexConfigError>()(
  "CustomerConvexConfigError",
  { message: Schema.String }
) {}
class CustomerConvexAuthError extends Schema.TaggedError<CustomerConvexAuthError>()(
  "CustomerConvexAuthError",
  { message: Schema.String }
) {}
class CustomerConvexRequestError extends Schema.TaggedError<CustomerConvexRequestError>()(
  "CustomerConvexRequestError",
  { message: Schema.String }
) {}
class CustomerConvexResponseError extends Schema.TaggedError<CustomerConvexResponseError>()(
  "CustomerConvexResponseError",
  { message: Schema.String }
) {}
const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const backendEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
  ".env.local"
);
const readBackendEnv = Effect.fn("customers.readBackendEnv")(function* () {
  if (!existsSync(backendEnvPath)) {
    return new Map<string, string>();
  }
  const content = yield* Effect.try({
    try: () => readFileSync(backendEnvPath, "utf8"),
    catch: (error) =>
      new CustomerConvexConfigError({ message: getUnknownMessage(error) }),
  });
  const parsed = yield* Effect.try({
    try: () => parseEnv(content),
    catch: (error) =>
      new CustomerConvexConfigError({ message: getUnknownMessage(error) }),
  });
  const values = new Map<string, string>();
  for (const [name, value] of Object.entries(parsed)) {
    if (value !== undefined) {
      values.set(name, value);
    }
  }
  return values;
});
/** Loads backend-local Convex configuration with shell variables taking priority. */
export const loadCustomerEnvProvider = Effect.fn(
  "customers.loadCustomerEnvProvider"
)(function* () {
  const shell = ConfigProvider.fromEnv();
  const backend = yield* readBackendEnv();
  return ConfigProvider.orElse(
    shell,
    ConfigProvider.fromEnvRecord(Object.fromEntries(backend))
  );
});
const getConvexUrl = Effect.fn("customers.getConvexUrl")(function* (
  prod: boolean
) {
  const name = prod ? "CONVEX_PROD_URL" : "CONVEX_URL";
  return yield* Config.nonEmptyString(name).pipe(
    Effect.mapError(
      () =>
        new CustomerConvexConfigError({
          message: `${name} is not configured for customer verification`,
        })
    )
  );
});
const getLocalAccessToken = Effect.fn("customers.getLocalAccessToken")(
  function* () {
    const configPath = resolve(homedir(), ".convex", "config.json");
    const content = yield* Effect.try({
      try: () => readFileSync(configPath, "utf8"),
      catch: () =>
        new CustomerConvexAuthError({
          message:
            "No CONVEX_DEPLOY_KEY and no local Convex login are available",
        }),
    });
    const json = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: () =>
        new CustomerConvexAuthError({
          message: "The local Convex configuration is invalid",
        }),
    });
    const config = yield* Schema.decodeUnknownEffect(ConvexAuthConfigSchema)(
      json
    ).pipe(
      Effect.mapError(
        () =>
          new CustomerConvexAuthError({
            message: "The local Convex configuration is invalid",
          })
      )
    );
    if (!config.accessToken) {
      return yield* new CustomerConvexAuthError({
        message: "The local Convex configuration has no access token",
      });
    }
    return config.accessToken;
  }
);
/** Resolves the exact Convex deployment and admin credential for one audit. */
export const getCustomerConvexConfig = Effect.fn(
  "customers.getCustomerConvexConfig"
)(function* (prod: boolean) {
  const url = yield* getConvexUrl(prod);
  const deployKey = yield* Config.option(
    Config.nonEmptyString("CONVEX_DEPLOY_KEY")
  );
  if (Option.isSome(deployKey)) {
    return { accessToken: deployKey.value, url };
  }
  const accessToken = yield* getLocalAccessToken();
  return { accessToken, url };
});
const parseResponse = <A, I>(
  body: unknown,
  valueSchema: Schema.Codec<A, I, never, never>,
  functionPath: string
) =>
  Effect.gen(function* () {
    const response = yield* Schema.decodeUnknownEffect(ConvexResponseSchema)(
      body
    ).pipe(
      Effect.mapError(
        (error) =>
          new CustomerConvexResponseError({
            message: `Invalid Convex response: ${error.message}`,
          })
      )
    );
    if (response.status === "error") {
      return yield* new CustomerConvexResponseError({
        message: `${functionPath}: ${response.errorMessage ?? "Unknown Convex error"}`,
      });
    }
    return yield* Schema.decodeUnknownEffect(valueSchema)(response.value).pipe(
      Effect.mapError(
        (error) =>
          new CustomerConvexResponseError({
            message: `Invalid Convex value: ${error.message}`,
          })
      )
    );
  });
/** Calls one generated customer-integrity query through Convex's admin HTTP API. */
export const callCustomerIntegrityQuery = Effect.fn(
  "customers.callCustomerIntegrityQuery"
)(function* <TQuery extends CustomerIntegrityQuery, Encoded>(
  config: CustomerConvexConfig,
  query: TQuery,
  args: FunctionArgs<TQuery>,
  schema: Schema.Codec<FunctionReturnType<TQuery>, Encoded, never, never>
) {
  const functionPath = yield* Effect.try({
    try: () => getFunctionName(query),
    catch: (error) =>
      new CustomerConvexConfigError({ message: getUnknownMessage(error) }),
  });
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${config.url}/api/query`, {
        body: JSON.stringify({ args, format: "json", path: functionPath }),
        headers: {
          Authorization: `Convex ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    catch: (error) =>
      new CustomerConvexRequestError({ message: getUnknownMessage(error) }),
  });
  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (error) =>
        new CustomerConvexResponseError({ message: getUnknownMessage(error) }),
    });
    return yield* new CustomerConvexRequestError({
      message: `${functionPath}: HTTP ${response.status} ${body}`,
    });
  }
  const body = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (error) =>
      new CustomerConvexResponseError({ message: getUnknownMessage(error) }),
  });
  return yield* parseResponse(body, schema, functionPath);
});
