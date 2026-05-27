import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import { Ref } from "@confect/core";
import { logWarning } from "@repo/backend/scripts/sync-content/logging";
import {
  ConvexAuthConfigSchema,
  ConvexResponseSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
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

const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const configName = (options: SyncOptions) =>
  options.prod ? "CONVEX_PROD_URL" : "CONVEX_URL";

const missingConfigMessage = (options: SyncOptions) => {
  if (options.prod) {
    return (
      "CONVEX_PROD_URL not set. Add your production Convex URL to .env.local\n" +
      "Find it in Convex Dashboard -> Settings -> Deployment URL"
    );
  }

  return "CONVEX_URL not set. Run: npx convex dev";
};

const formatParseError = (error: ParseResult.ParseError) =>
  ParseResult.TreeFormatter.formatErrorSync(error);

const parseConvexResponse = (json: unknown) =>
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
          message: response.errorMessage || "Unknown Convex error",
        })
      );
    }

    return response.value;
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
  const configPath = path.join(os.homedir(), ".convex", "config.json");
  const content = yield* Effect.try({
    try: () => fs.readFileSync(configPath, "utf8"),
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
 * Calls one Convex HTTP endpoint from backend scripts and validates the value.
 *
 * References:
 * - Effect async errors: https://effect.website/docs/getting-started/running-effects/
 * - Convex function calls over HTTP: https://docs.convex.dev/http-api/
 */
export const callConvex = Effect.fn("scripts.callConvex")(function* <A, I>(
  config: ConvexConfig,
  endpoint: "action" | "mutation" | "query",
  ref: Ref.Any,
  args: Ref.Args<Ref.Any>,
  schema: Schema.Schema<A, I, never>
) {
  const encodedArgs = yield* Ref.encodeArgs(ref, args).pipe(
    Effect.mapError(
      (error) =>
        new ConvexRequestError({
          message: `Invalid Convex args: ${formatParseError(error)}`,
        })
    )
  );
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${config.url}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${config.accessToken}`,
        },
        body: JSON.stringify({
          path: Ref.getConvexFunctionName(ref),
          args: encodedArgs,
          format: "json",
        }),
      }),
    catch: (error) =>
      new ConvexRequestError({ message: getUnknownMessage(error) }),
  });
  const json = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (error) =>
      new ConvexResponseError({ message: getUnknownMessage(error) }),
  });

  const value = yield* parseConvexResponse(json);
  const decodedValue = yield* Ref.decodeReturns(ref, value).pipe(
    Effect.mapError(
      (error) =>
        new ConvexResponseError({
          message: `Invalid Convex value: ${formatParseError(error)}`,
        })
    )
  );
  return yield* Schema.decodeUnknown(schema)(decodedValue).pipe(
    Effect.mapError(
      (error) =>
        new ConvexResponseError({
          message: `Invalid Convex value: ${formatParseError(error)}`,
        })
    )
  );
});
