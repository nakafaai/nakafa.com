import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { logWarning } from "@repo/backend/scripts/sync-content/logging";
import {
  ConvexAuthConfigSchema,
  ConvexResponseSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  FunctionType,
} from "convex/server";
import { getFunctionName } from "convex/server";
import { Config, Effect, ParseResult, Schema } from "effect";

class ConvexConfigError extends Schema.TaggedError<ConvexConfigError>()(
  "ConvexConfigError",
  {
    message: Schema.String,
  }
) {}

class ConvexAuthError extends Schema.TaggedError<ConvexAuthError>()(
  "ConvexAuthError",
  {
    message: Schema.String,
  }
) {}

class ConvexRequestError extends Schema.TaggedError<ConvexRequestError>()(
  "ConvexRequestError",
  {
    message: Schema.String,
  }
) {}

class ConvexResponseError extends Schema.TaggedError<ConvexResponseError>()(
  "ConvexResponseError",
  {
    message: Schema.String,
  }
) {}

type ScriptFunctionReference<Endpoint extends FunctionType> = FunctionReference<
  Endpoint,
  "internal" | "public",
  DefaultFunctionArgs,
  unknown
>;

/** Formats unknown thrown values for script error messages. */
const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Selects the deployment URL config key for the requested sync target. */
const configName = (options: SyncOptions) =>
  options.prod ? "CONVEX_PROD_URL" : "CONVEX_URL";

/** Explains which Convex URL environment variable is missing. */
const missingConfigMessage = (options: SyncOptions) => {
  if (options.prod) {
    return (
      "CONVEX_PROD_URL not set. Add your production Convex URL to .env.local\n" +
      "Find it in Convex Dashboard -> Settings -> Deployment URL"
    );
  }

  return "CONVEX_URL not set. Run: npx convex dev";
};

/** Renders Effect schema parse failures into a script-friendly string. */
const formatParseError = (error: ParseResult.ParseError) =>
  ParseResult.TreeFormatter.formatErrorSync(error);

/** Decodes the Convex HTTP response envelope and validates its value. */
const parseConvexResponse = <A, I>(
  json: unknown,
  valueSchema: Schema.Schema<A, I, never>,
  functionPath: string
) =>
  Effect.gen(function* () {
    const response = yield* Schema.decodeUnknown(ConvexResponseSchema)(
      json
    ).pipe(
      Effect.mapError(
        (error) =>
          new ConvexResponseError({
            message: `Invalid Convex response: ${formatParseError(error)}`,
          })
      )
    );

    if (response.status === "error") {
      return yield* Effect.fail(
        new ConvexResponseError({
          message: `${functionPath}: ${response.errorMessage || "Unknown Convex error"}`,
        })
      );
    }

    return yield* Schema.decodeUnknown(valueSchema)(response.value).pipe(
      Effect.mapError(
        (error) =>
          new ConvexResponseError({
            message: `Invalid Convex value: ${formatParseError(error)}`,
          })
      )
    );
  });

/** Reads a failed Convex HTTP response body without escaping the typed error model. */
const readFailedResponseBody = Effect.fn("scripts.readFailedResponseBody")(
  function* (response: Response) {
    return yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (error) =>
        new ConvexResponseError({ message: getUnknownMessage(error) }),
    });
  }
);

/** Derives the HTTP path from a generated Convex function reference. */
const getScriptFunctionPath = Effect.fn("scripts.getScriptFunctionPath")(
  function* <Endpoint extends FunctionType>(
    functionReference: ScriptFunctionReference<Endpoint>
  ) {
    return yield* Effect.try({
      try: () => getFunctionName(functionReference),
      catch: (error) =>
        new ConvexConfigError({ message: getUnknownMessage(error) }),
    });
  }
);

/**
 * Calls one typed Convex HTTP endpoint and validates the returned value.
 *
 * Installed `convex@1.40.0` public `ConvexHttpClient` methods only accept
 * public function references, while `setAdminAuth()` and `function()` are
 * internal-only and absent from the public d.ts. This adapter keeps scripts on
 * generated references by deriving paths with Convex `getFunctionName()`.
 */
const callConvexFunction = Effect.fn("scripts.callConvexFunction")(function* <
  Endpoint extends FunctionType,
  TFunction extends ScriptFunctionReference<Endpoint>,
  Encoded,
>(
  config: ConvexConfig,
  endpoint: Endpoint,
  functionReference: TFunction,
  args: FunctionArgs<TFunction>,
  schema: Schema.Schema<FunctionReturnType<TFunction>, Encoded, never>
) {
  const functionPath = yield* getScriptFunctionPath(functionReference);
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${config.url}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${config.accessToken}`,
        },
        body: JSON.stringify({
          path: functionPath,
          args,
          format: "json",
        }),
      }),
    catch: (error) =>
      new ConvexRequestError({ message: getUnknownMessage(error) }),
  });

  if (!response.ok) {
    const body = yield* readFailedResponseBody(response);
    return yield* Effect.fail(
      new ConvexRequestError({
        message: `${functionPath}: HTTP ${response.status} ${body}`,
      })
    );
  }

  const json = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (error) =>
      new ConvexResponseError({ message: getUnknownMessage(error) }),
  });

  return yield* parseConvexResponse(json, schema, functionPath);
});

/**
 * Reads the target Convex deployment URL and local auth token for script calls.
 *
 * References:
 * - Effect Config: https://effect.website/docs/configuration/
 * - Convex HTTP API endpoint shape: https://docs.convex.dev/http-api/
 */
export const getConvexConfig = Effect.fn("scripts.getConvexConfig")(function* (
  options: SyncOptions = {}
) {
  const name = configName(options);
  const url = yield* Config.nonEmptyString(name).pipe(
    Effect.mapError(
      () => new ConvexConfigError({ message: missingConfigMessage(options) })
    )
  );
  const configPath = join(homedir(), ".convex", "config.json");
  const content = yield* Effect.try({
    try: () => readFileSync(configPath, "utf8"),
    catch: () =>
      new ConvexAuthError({
        message: "Not authenticated. Run: npx convex dev",
      }),
  });
  const json = yield* Effect.try({
    try: () => JSON.parse(content),
    catch: () =>
      new ConvexAuthError({
        message: "Invalid Convex config. Run: npx convex dev",
      }),
  });
  const parsed = yield* Schema.decodeUnknown(ConvexAuthConfigSchema)(json).pipe(
    Effect.mapError(
      () =>
        new ConvexAuthError({
          message: "Invalid Convex config. Run: npx convex dev",
        })
    )
  );

  if (!parsed.accessToken) {
    return yield* Effect.fail(
      new ConvexAuthError({
        message: "No access token. Run: npx convex dev",
      })
    );
  }

  if (options.prod) {
    logWarning(`PRODUCTION MODE: Syncing to ${url}`);
  }

  return { accessToken: parsed.accessToken, url };
});

/**
 * Calls one generated Convex mutation reference from backend scripts.
 *
 * The reference is the source of truth for the HTTP path, argument type, and
 * return type; the schema keeps runtime validation at the deployment seam.
 */
export const callConvexMutation = Effect.fn("scripts.callConvexMutation")(
  function* <TFunction extends ScriptFunctionReference<"mutation">, Encoded>(
    config: ConvexConfig,
    mutation: TFunction,
    args: FunctionArgs<TFunction>,
    schema: Schema.Schema<FunctionReturnType<TFunction>, Encoded, never>
  ) {
    return yield* callConvexFunction(
      config,
      "mutation",
      mutation,
      args,
      schema
    );
  }
);

/**
 * Calls one generated Convex action reference from backend scripts.
 *
 * The reference is the source of truth for the HTTP path, argument type, and
 * return type; the schema keeps runtime validation at the deployment seam.
 */
export const callConvexAction = Effect.fn("scripts.callConvexAction")(
  function* <TFunction extends ScriptFunctionReference<"action">, Encoded>(
    config: ConvexConfig,
    action: TFunction,
    args: FunctionArgs<TFunction>,
    schema: Schema.Schema<FunctionReturnType<TFunction>, Encoded, never>
  ) {
    return yield* callConvexFunction(config, "action", action, args, schema);
  }
);

/**
 * Calls one generated Convex query reference from backend scripts.
 *
 * The reference is the source of truth for the HTTP path, argument type, and
 * return type; the schema keeps runtime validation at the deployment seam.
 */
export const callConvexQuery = Effect.fn("scripts.callConvexQuery")(function* <
  TFunction extends ScriptFunctionReference<"query">,
  Encoded,
>(
  config: ConvexConfig,
  query: TFunction,
  args: FunctionArgs<TFunction>,
  schema: Schema.Schema<FunctionReturnType<TFunction>, Encoded, never>
) {
  return yield* callConvexFunction(config, "query", query, args, schema);
});
