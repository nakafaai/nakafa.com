import { env } from "@repo/backend/convex/_generated/server";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";

export const API_EDGE_SECRET_HEADER = "x-nakafa-api-edge-secret";
export const MCP_EDGE_SECRET_HEADER = "x-nakafa-mcp-edge-secret";
const DEFAULT_MCP_ORIGINS = "https://nakafa.com,https://www.nakafa.com";
type EdgeSecretName = "NAKAFA_API_EDGE_SECRET" | "NAKAFA_MCP_EDGE_SECRET";

/** Reads and compares an edge secret without exposing it to logs or errors. */
export const hasValidEdgeSecret = Effect.fn("agent.hasValidEdgeSecret")(
  function* (
    request: Request,
    environmentName: EdgeSecretName,
    headerName: string
  ) {
    const configured = yield* Effect.sync(() => env[environmentName]);
    if (!configured) {
      return yield* new NakafaAgentDataReadError({
        message: "The public edge authentication boundary is unavailable.",
      });
    }
    const acceptedSecrets = configured
      .split(",")
      .map((secret) => secret.trim());
    if (
      acceptedSecrets.length > 2 ||
      acceptedSecrets.some((secret) => secret.length === 0)
    ) {
      return yield* new NakafaAgentDataReadError({
        message: "The public edge authentication boundary is unavailable.",
      });
    }
    const supplied = request.headers.get(headerName);
    if (!supplied) {
      return false;
    }
    const comparisons = yield* Effect.all(
      acceptedSecrets.map((expected) => constantTimeEqual(expected, supplied))
    );
    return comparisons.some(Boolean);
  }
);

/** Reads exact trusted browser origins from deployment configuration. */
export const readTrustedMcpOrigins = Effect.fn("agent.readTrustedMcpOrigins")(
  function* () {
    const source = yield* Effect.sync(
      () => env.NAKAFA_MCP_ALLOWED_ORIGINS ?? DEFAULT_MCP_ORIGINS
    );
    return source
      .split(",")
      .map((origin) => origin.trim())
      .filter(isTrustedHttpsOrigin);
  }
);

/** Allows absent server origins and exact configured HTTPS browser origins. */
export function hasTrustedMcpOrigin(
  request: Request,
  trustedOrigins: readonly string[]
) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  return trustedOrigins.includes(origin);
}

/** Compares two secret values through fixed-size SHA-256 digests. */
const constantTimeEqual = Effect.fn("agent.constantTimeEqual")(function* (
  expected: string,
  supplied: string
) {
  const [expectedDigest, suppliedDigest] = yield* Effect.tryPromise({
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "The public edge authentication boundary is unavailable.",
      }),
    try: () =>
      Promise.all([
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied)),
      ]),
  });
  const left = new Uint8Array(expectedDigest);
  const right = new Uint8Array(suppliedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  }
  return difference === 0;
});

/** Keeps browser access restricted to explicit HTTPS origins. */
function isTrustedHttpsOrigin(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return url.protocol === "https:" && url.origin === value;
}
