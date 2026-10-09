import { InvalidEnvironmentError } from "@repo/next-config/env";
import { Result, Schema } from "effect";

const appUrlSchema = Schema.Struct({
  NEXT_PUBLIC_APP_URL: Schema.NonEmptyString,
});
/**
 * Defines the public app origin that client and server absolute URL builders
 * share. This module is browser-safe: it reads no server key. It decodes
 * synchronously, because it runs on every render of a client component and must
 * not start an Effect runtime.
 */
export const appUrlKeys = () => {
  const values = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  } satisfies Record<keyof typeof appUrlSchema.Type, string | undefined>;
  return Result.getOrThrowWith(
    Schema.decodeUnknownResult(appUrlSchema)(values),
    (error) => new InvalidEnvironmentError({ details: error.message })
  );
};
