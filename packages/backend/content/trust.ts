import {
  ACTIVE_SIGNING_KEY_ID,
  makeTrustedKeyResolver,
  TRUSTED_CONTENT_KEYS,
  TrustedKeySchema,
} from "@nakafa/aksara-contracts/signature/trusted";
import { Schema } from "effect";

const agentKeyId = process.env.AKSARA_AGENT_SIGNING_KEY_ID;
const agentPublicKeyPem = process.env.AKSARA_AGENT_SIGNING_PUBLIC_KEY;
const hasAgentKey = agentKeyId !== undefined || agentPublicKeyPem !== undefined;
const agentKey = hasAgentKey
  ? Schema.decodeUnknownSync(TrustedKeySchema)({
      keyId: agentKeyId,
      publicKeyPem: agentPublicKeyPem,
    })
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
