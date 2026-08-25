import {
  type AgentEdgeContract,
  NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { env } from "@repo/backend/convex/_generated/server";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Schema, SchemaGetter } from "effect";

const LOOPBACK_MCP_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const TrustedMcpOriginSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty()),
  Schema.check(
    Schema.makeFilter(isTrustedMcpOriginSource, {
      message: "Expected an exact HTTPS or loopback HTTP origin.",
    })
  ),
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((source) => new URL(source).origin),
    encode: SchemaGetter.transform((origin) => origin),
  })
);
const TrustedMcpOriginsSchema = Schema.Array(TrustedMcpOriginSchema).pipe(
  Schema.check(Schema.isMinLength(1))
);

/** Reads and compares an edge secret without exposing it to logs or errors. */
export const hasValidEdgeSecret = Effect.fn("agent.hasValidEdgeSecret")(
  function* (request: Request, contract: AgentEdgeContract) {
    const configured = yield* Effect.sync(
      () => env[contract.secretEnvironment]
    );
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
    const supplied = request.headers.get(contract.secretHeader);
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
      () => env[NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT]
    );
    const encoded = source?.split(",") ?? NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS;
    const origins = yield* Schema.decodeEffect(TrustedMcpOriginsSchema)(
      encoded
    ).pipe(
      Effect.mapError(
        () =>
          new NakafaAgentDataReadError({
            message: "The MCP browser Origin boundary is unavailable.",
          })
      )
    );
    return [...new Set(origins)];
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

/** Keeps browser access restricted to HTTPS or explicit loopback origins. */
function isTrustedMcpOriginSource(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  if (
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return false;
  }
  if (url.protocol === "https:") {
    return true;
  }
  if (url.protocol !== "http:") {
    return false;
  }
  return LOOPBACK_MCP_HOSTS.has(url.hostname);
}
