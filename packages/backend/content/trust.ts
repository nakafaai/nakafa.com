import { ConvexConfigProvider } from "@confect/server";
import {
  ACTIVE_SIGNING_KEY_ID,
  makeTrustedKeyResolver,
  TRUSTED_CONTENT_KEYS,
  TrustedKeySchema,
} from "@nakafa/aksara-contracts/signature/trusted";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Config, Effect, Option, Schema } from "effect";

const TRAILING_DOT = /\.$/;
const CLOUD_HOST = /^[a-z0-9-]+\.convex\.cloud$/;
const AgentTrustSchema = Schema.Struct({
  key: TrustedKeySchema,
  target: Schema.URLFromString,
  vercel: Schema.UndefinedOr(Schema.String),
}).check(
  Schema.makeFilter(({ target, vercel }) => {
    if (
      vercel === "production" ||
      target.username.length > 0 ||
      target.password.length > 0
    ) {
      return false;
    }
    const hostname = target.hostname.replace(TRAILING_DOT, "");
    if (hostname === `${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`) {
      return false;
    }
    return (
      (target.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(hostname)) ||
      (target.protocol === "https:" && CLOUD_HOST.test(hostname))
    );
  })
);
// The Convex provider reads each exact name, because Convex does not expose
// process.env for enumeration, which ConfigProvider.fromEnv requires.
const agentEnvironment = Effect.runSync(
  Config.all({
    keyId: Config.option(Config.String("AKSARA_AGENT_SIGNING_KEY_ID")),
    publicKeyPem: Config.option(
      Config.String("AKSARA_AGENT_SIGNING_PUBLIC_KEY")
    ),
    cloudUrl: Config.option(Config.String("CONVEX_CLOUD_URL")),
    convexUrl: Config.option(Config.String("NEXT_PUBLIC_CONVEX_URL")),
    vercel: Config.option(Config.String("VERCEL_ENV")),
  }).parse(ConvexConfigProvider.make())
);
const hasAgentKey =
  Option.isSome(agentEnvironment.keyId) ||
  Option.isSome(agentEnvironment.publicKeyPem);
const agentKey = hasAgentKey
  ? // Convex and Next load this immutable trust configuration at module startup.
    // Synchronous schema validation fails before any publication or artifact read.
    Schema.decodeUnknownSync(AgentTrustSchema)({
      key: {
        keyId: Option.getOrUndefined(agentEnvironment.keyId),
        publicKeyPem: Option.getOrUndefined(agentEnvironment.publicKeyPem),
      },
      target:
        Option.getOrUndefined(agentEnvironment.cloudUrl) ??
        Option.getOrUndefined(agentEnvironment.convexUrl),
      vercel: Option.getOrUndefined(agentEnvironment.vercel),
    }).key
  : undefined;
const trustedContentKeys =
  agentKey === undefined
    ? TRUSTED_CONTENT_KEYS
    : [...TRUSTED_CONTENT_KEYS, agentKey];

/** Selects the only key identity accepted for new publications. */
export const activeContentSigningKeyId =
  agentKey?.keyId ?? ACTIVE_SIGNING_KEY_ID;

/** Resolves only content keys retained by the reviewed contracts package. */
export const contentKeyResolver = makeTrustedKeyResolver(trustedContentKeys);
