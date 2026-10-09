import { convexKeys, convexSiteKeys } from "@repo/backend/keys";
import { InvalidEnvironmentError } from "@repo/utilities/env";
import { Config, ConfigProvider, Effect, Schema } from "effect";

const previewChildConfig = {
  NEXT_PUBLIC_AKSARA_PREVIEW_CHILD: Config.schema(
    Schema.UndefinedOr(Schema.Literals(["true", "false"])),
    "NEXT_PUBLIC_AKSARA_PREVIEW_CHILD"
  ),
};
const previewChildValues = {
  NEXT_PUBLIC_AKSARA_PREVIEW_CHILD:
    process.env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD,
} satisfies Record<keyof typeof previewChildConfig, string | undefined>;
const previewChildEnv = Effect.runSync(
  Config.all(previewChildConfig)
    .parse(
      ConfigProvider.fromUnknown(previewChildValues, {
        preserveEmptyStrings: true,
      })
    )
    .pipe(
      Effect.mapError(
        (error) => new InvalidEnvironmentError({ details: error.message })
      )
    )
);

/**
 * Public values that browser components and server code both read. This module
 * reads no server key, so a client bundle never evaluates one.
 */
export const clientEnv = {
  ...convexKeys(),
  ...convexSiteKeys(),
  ...previewChildEnv,
};
