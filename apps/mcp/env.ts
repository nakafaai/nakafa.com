import { convexKeys } from "@repo/backend/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const optionalStringSchema = Schema.standardSchemaV1(
  Schema.UndefinedOr(Schema.String)
);

export const env = createEnv({
  extends: [convexKeys()],
  server: {
    MCP_ALLOWED_ORIGINS: optionalStringSchema,
  },
  runtimeEnv: {
    MCP_ALLOWED_ORIGINS: process.env.MCP_ALLOWED_ORIGINS,
  },
});
