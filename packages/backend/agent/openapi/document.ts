import { OPENAPI_PATHS } from "@repo/backend/agent/openapi/paths";
import { OPENAPI_SCHEMAS } from "@repo/backend/agent/openapi/schema";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_PUBLIC_API_DOCUMENT_VERSION,
} from "@repo/contents/_lib/agent/constants";

const ETAG_CHECKSUM_MODULUS = 2_147_483_647;
const ETAG_CHECKSUM_MULTIPLIER = 31;

/** Canonical OpenAPI 3.1 contract generated from runtime schemas. */
export const NAKAFA_OPENAPI_DOCUMENT = {
  components: {
    schemas: OPENAPI_SCHEMAS,
    securitySchemes: {},
  },
  externalDocs: {
    description: "Nakafa agent-readable documentation",
    url: `${NAKAFA_BASE_URL}/llms.txt`,
  },
  info: {
    contact: {
      email: "nakafaai@gmail.com",
      name: "Nakafa Support",
      url: `${NAKAFA_BASE_URL}/contact`,
    },
    description:
      "Read-only public access to Nakafa's signed educational content. V1 remains immutable while source-grounded Quran semantics are added through V2.",
    license: {
      name: "Nakafa terms",
      url: `${NAKAFA_BASE_URL}/en/terms-of-service`,
    },
    title: "Nakafa Public API",
    version: NAKAFA_PUBLIC_API_DOCUMENT_VERSION,
    "x-version-policy":
      "V1 remains immutable. New Quran semantics and attribution are exposed only through V2.",
  },
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
  openapi: "3.1.1",
  paths: OPENAPI_PATHS,
  security: [],
  servers: [{ description: "Production", url: NAKAFA_API_BASE_URL }],
  tags: [
    {
      description: "Public read-only endpoints that require no user account.",
      name: "Public read API",
    },
  ],
};

/** Stable document bytes used by direct and rewritten endpoints. */
export const NAKAFA_OPENAPI_JSON = JSON.stringify(NAKAFA_OPENAPI_DOCUMENT);

/** Derives a weak cache validator from the exact serialized bytes. */
export function createOpenApiEtag(serializedDocument: string) {
  const bytes = new TextEncoder().encode(serializedDocument);
  let checksum = 0;
  for (const byte of bytes) {
    checksum =
      (checksum * ETAG_CHECKSUM_MULTIPLIER + byte) % ETAG_CHECKSUM_MODULUS;
  }
  const hexadecimal = checksum.toString(16).padStart(8, "0");
  return `W/"nakafa-openapi-${bytes.length.toString(16)}-${hexadecimal}"`;
}

/** Cache validator derived from the current serialized OpenAPI bytes. */
export const NAKAFA_OPENAPI_ETAG = createOpenApiEtag(NAKAFA_OPENAPI_JSON);
