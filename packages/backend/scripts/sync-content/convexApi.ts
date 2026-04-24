import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import type * as z from "zod";
import { logWarning } from "./logging";
import {
  ConvexAuthConfigSchema,
  ConvexResponseSchema,
  SyncResultSchema,
} from "./schemas";
import type { ConvexConfig, SyncOptions, SyncResult } from "./types";

const parseConvexResponse = <T>(
  json: unknown,
  valueSchema: z.ZodType<T>
): T => {
  const response = ConvexResponseSchema.safeParse(json);
  if (!response.success) {
    throw new Error(`Invalid Convex response: ${response.error.message}`);
  }

  if (response.data.status === "error") {
    throw new Error(response.data.errorMessage || "Unknown Convex error");
  }

  const value = valueSchema.safeParse(response.data.value);
  if (!value.success) {
    throw new Error(`Invalid Convex value: ${value.error.message}`);
  }

  return value.data;
};

export const getConvexConfig = (options: SyncOptions = {}): ConvexConfig => {
  const isProd = options.prod;
  const url = isProd ? process.env.CONVEX_PROD_URL : process.env.CONVEX_URL;

  if (!url) {
    if (isProd) {
      throw new Error(
        "CONVEX_PROD_URL not set. Add your production Convex URL to .env.local\n" +
          "Find it in Convex Dashboard -> Settings -> Deployment URL"
      );
    }
    throw new Error("CONVEX_URL not set. Run: npx convex dev");
  }

  const convexConfigPath = path.join(os.homedir(), ".convex", "config.json");
  if (!fs.existsSync(convexConfigPath)) {
    throw new Error("Not authenticated. Run: npx convex dev");
  }

  const configContent = fs.readFileSync(convexConfigPath, "utf8");
  const parsed = ConvexAuthConfigSchema.safeParse(JSON.parse(configContent));

  if (!parsed.success) {
    throw new Error("Invalid Convex config. Run: npx convex dev");
  }

  if (!parsed.data.accessToken) {
    throw new Error("No access token. Run: npx convex dev");
  }

  if (isProd) {
    logWarning(`PRODUCTION MODE: Syncing to ${url}`);
  }

  return { url, accessToken: parsed.data.accessToken };
};

const requestConvex = async <T>(
  config: ConvexConfig,
  endpoint: "action" | "mutation" | "query",
  functionPath: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> => {
  const response = await fetch(`${config.url}/api/${endpoint}`, {
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
  });

  const json = await response.json();
  return parseConvexResponse(json, schema);
};

export const runConvexMutation = (
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>
): Promise<SyncResult> =>
  requestConvex(config, "mutation", functionPath, args, SyncResultSchema);

export const runConvexMutationGeneric = <T>(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> => requestConvex(config, "mutation", functionPath, args, schema);

export const runConvexQuery = <T>(
  config: ConvexConfig,
  functionPath: string,
  schema: z.ZodType<T>
): Promise<T> => requestConvex(config, "query", functionPath, {}, schema);

export const runConvexQueryWithArgs = <T>(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> => requestConvex(config, "query", functionPath, args, schema);

export const runConvexActionWithArgs = <T>(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> => requestConvex(config, "action", functionPath, args, schema);
