import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const emailSchema = Schema.toStandardSchemaV1(
  Schema.String.pipe(
    Schema.check(
      Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
        message: "Expected a valid email address.",
      })
    )
  )
);
const resendTokenSchema = Schema.toStandardSchemaV1(
  Schema.String.check(Schema.isStartsWith("re_"))
);
export const keys = () =>
  createEnv({
    server: {
      RESEND_FROM: emailSchema,
      RESEND_TOKEN: resendTokenSchema,
    },
    runtimeEnv: {
      RESEND_FROM: process.env.RESEND_FROM,
      RESEND_TOKEN: process.env.RESEND_TOKEN,
    },
  });
