import {
  ACTIVE_SIGNING_KEY_ID,
  makeTrustedKeyResolver,
  TRUSTED_CONTENT_KEYS,
  TrustedKeySchema,
} from "@nakafa/aksara-contracts/signature/trusted";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { agentTrustKeys } from "@repo/backend/keys";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { Array as Arr, Schema } from "effect";

const TRAILING_DOT = /\.$/;
const CLOUD_HOST = /^[a-z0-9-]+\.convex\.cloud$/;
const AgentTrustSchema = Schema.Struct({
  key: TrustedKeySchema,
  stage: Schema.UndefinedOr(Schema.String),
  target: Schema.URLFromString,
}).check(
  Schema.makeFilter(({ stage, target }) => {
    if (
      stage === PRODUCTION_DEPLOY_STAGE ||
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
        Arr.contains(["127.0.0.1", "localhost", "[::1]"], hostname)) ||
      (target.protocol === "https:" && CLOUD_HOST.test(hostname))
    );
  })
);
const agentEnvironment = agentTrustKeys();
const hasAgentKey =
  agentEnvironment.AKSARA_AGENT_SIGNING_KEY_ID !== undefined ||
  agentEnvironment.AKSARA_AGENT_SIGNING_PUBLIC_KEY !== undefined;
const agentKey = hasAgentKey
  ? // Convex and the app load this immutable trust configuration at module startup.
    // Synchronous schema validation fails before any publication or artifact read.
    Schema.decodeUnknownSync(AgentTrustSchema)({
      key: {
        keyId: agentEnvironment.AKSARA_AGENT_SIGNING_KEY_ID,
        publicKeyPem: agentEnvironment.AKSARA_AGENT_SIGNING_PUBLIC_KEY,
      },
      stage: agentEnvironment.NAKAFA_DEPLOY_STAGE,
      target:
        agentEnvironment.CONVEX_CLOUD_URL ?? agentEnvironment.VITE_CONVEX_URL,
    }).key
  : undefined;
export const trustedContentKeys =
  agentKey === undefined
    ? TRUSTED_CONTENT_KEYS
    : [...TRUSTED_CONTENT_KEYS, agentKey];

/** Selects the only key identity accepted for new publications. */
export const activeContentSigningKeyId =
  agentKey?.keyId ?? ACTIVE_SIGNING_KEY_ID;

/** Resolves only content keys retained by the reviewed contracts package. */
export const contentKeyResolver = makeTrustedKeyResolver(trustedContentKeys);
