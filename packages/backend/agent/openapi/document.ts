import { OPENAPI_PATHS } from "@repo/backend/agent/openapi/paths";
import { OPENAPI_SCHEMAS } from "@repo/backend/agent/openapi/schema";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_PUBLIC_API_VERSION,
} from "@repo/contents/_lib/agent/constants";

const DOCUMENT_HASH_SEED = 14_695_981_039_346_656_037n;
const DOCUMENT_HASH_FACTOR = 1_099_511_628_211n;
const DOCUMENT_HASH_MODULUS = 18_446_744_073_709_551_557n;

/** Canonical OpenAPI 3.1 contract generated from Nakafa's Effect schemas. */
export const NAKAFA_OPENAPI_DOCUMENT = {
  components: {
    schemas: OPENAPI_SCHEMAS,
    securitySchemes: {},
  },
  externalDocs: {
    description: "Nakafa developer resources",
    url: `${NAKAFA_BASE_URL}/developers/llms.txt`,
  },
  info: {
    contact: {
      email: "nakafaai@gmail.com",
      name: "Nakafa Support",
      url: `${NAKAFA_BASE_URL}/contact`,
    },
    description:
      "Read-only, unauthenticated access to Nakafa's signed educational content. Compatible additions remain in v1. Breaking changes require v2. Deprecated operations include Deprecation, Link, and Sunset response headers with at least 90 days notice before removal.",
    license: {
      name: "Nakafa terms",
      url: `${NAKAFA_BASE_URL}/en/terms-of-service`,
    },
    title: "Nakafa Public API",
    version: NAKAFA_PUBLIC_API_VERSION,
    "x-deprecation-policy": {
      headers: ["Deprecation", "Link", "Sunset"],
      minimum_notice_days: 90,
    },
    "x-version-policy":
      "Compatible additions remain in v1. Breaking changes require v2.",
  },
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
  openapi: "3.1.1",
  paths: OPENAPI_PATHS,
  security: [],
  servers: [{ description: "Production", url: NAKAFA_API_BASE_URL }],
  tags: [
    {
      description: "Public, read-only endpoints that require no user account.",
      name: "Public read API",
    },
  ],
};

/** Stable document bytes used by direct and rewritten OpenAPI endpoints. */
export const NAKAFA_OPENAPI_JSON = JSON.stringify(NAKAFA_OPENAPI_DOCUMENT);

/** Derives a compact weak validator from the exact serialized document bytes. */
export function createOpenApiEtag(serializedDocument: string) {
  const bytes = new TextEncoder().encode(serializedDocument);
  let digest = DOCUMENT_HASH_SEED;
  for (const byte of bytes) {
    digest =
      (digest * DOCUMENT_HASH_FACTOR + BigInt(byte + 1)) %
      DOCUMENT_HASH_MODULUS;
  }
  return `W/"nakafa-openapi-${bytes.length.toString(16)}-${digest.toString(16).padStart(16, "0")}"`;
}

/** Cache validator derived from the current serialized OpenAPI bytes. */
export const NAKAFA_OPENAPI_ETAG = createOpenApiEtag(NAKAFA_OPENAPI_JSON);
