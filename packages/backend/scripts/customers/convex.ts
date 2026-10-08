import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { FetchClient } from "@repo/utilities/http/client";
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
  FileSystem,
  Option,
  Path,
  Schema,
} from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
} from "effect/http";

const CustomerConvexConfigSchema = Schema.Struct({
  accessToken: Schema.String,
  url: Schema.String,
});
type CustomerConvexConfig = typeof CustomerConvexConfigSchema.Type;
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
/** Reports why Convex's answer could not be read, in the words of its cause. */
const toResponseError = (error: HttpClientError.HttpClientError) =>
  new CustomerConvexResponseError({
    message: getUnknownMessage(error.reason.cause),
  });
const toConfigError = (error: unknown) =>
  new CustomerConvexConfigError({ message: getUnknownMessage(error) });
/** Decodes UTF-8 and keeps a byte order mark, as Node's utf8 file reads did. */
const decodeUtf8 = (bytes: Uint8Array) =>
  new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
const readBackendEnv = Effect.fn("customers.readBackendEnv")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const backendEnvPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
    ".env.local"
  );
  // A path that cannot be checked counts as absent, as existsSync reported it.
  const exists = yield* fileSystem
    .exists(backendEnvPath)
    .pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return {};
  }
  const bytes = yield* fileSystem
    .readFile(backendEnvPath)
    .pipe(Effect.mapError(toConfigError));
  const content = decodeUtf8(bytes);
  const parsed = yield* Effect.try({
    try: () => parseEnv(content),
    catch: toConfigError,
  });
  return parsed;
});
/** Loads backend-local Convex configuration with shell variables taking priority. */
export const loadCustomerEnvProvider = Effect.fn(
  "customers.loadCustomerEnvProvider"
)(function* () {
  const shell = ConfigProvider.fromEnv();
  const backend = yield* readBackendEnv();
  return ConfigProvider.orElse(shell, ConfigProvider.fromEnvRecord(backend));
});
const getConvexUrl = Effect.fn("customers.getConvexUrl")(function* (
  prod: boolean
) {
  const name = prod ? "CONVEX_PROD_URL" : "CONVEX_URL";
  return yield* Config.NonEmptyString(name).pipe(
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
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const configPath = path.resolve(homedir(), ".convex", "config.json");
    const bytes = yield* fileSystem.readFile(configPath).pipe(
      Effect.mapError(
        () =>
          new CustomerConvexAuthError({
            message:
              "No CONVEX_DEPLOY_KEY and no local Convex login are available",
          })
      )
    );
    const config = yield* Schema.decodeEffect(
      Schema.fromJsonString(ConvexAuthConfigSchema)
    )(decodeUtf8(bytes)).pipe(
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
    Config.NonEmptyString("CONVEX_DEPLOY_KEY")
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
  const client = yield* HttpClient.HttpClient;
  const response = yield* HttpClientRequest.post(
    `${config.url}/api/query`
  ).pipe(
    HttpClientRequest.setHeader(
      "Authorization",
      `Convex ${config.accessToken}`
    ),
    HttpClientRequest.bodyJsonUnsafe({
      args,
      format: "json",
      path: functionPath,
    }),
    client.execute,
    Effect.mapError(
      (error) =>
        new CustomerConvexRequestError({
          message: getUnknownMessage(error.reason.cause),
        })
    )
  );
  if (response.status < 200 || response.status >= 300) {
    const body = yield* response.text.pipe(Effect.mapError(toResponseError));
    return yield* new CustomerConvexRequestError({
      message: `${functionPath}: HTTP ${response.status} ${body}`,
    });
  }
  const body = yield* response.json.pipe(Effect.mapError(toResponseError));
  return yield* parseResponse(body, schema, functionPath);
}, Effect.provide(FetchClient));
