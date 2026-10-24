import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The intent and the locale of the onboarding page, decoded at the server boundary. */
const OnboardingInput = Schema.Struct({
  intent: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  locale: LocaleSchema,
});

export type OnboardingPageInput = typeof OnboardingInput.Type;

const SchoolStartInput = Schema.Struct({ locale: LocaleSchema });

export type SchoolStartPageInput = typeof SchoolStartInput.Type;

/**
 * Decides the onboarding page of one request on the server. It is a read: a
 * prefetch of the page writes nothing.
 */
export const readOnboardingPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(OnboardingInput))
  .handler(async ({ data }) => {
    const { onboardingPageHandler } = await import("@/lib/entry/page.server");
    return onboardingPageHandler({ data });
  });

/** Decides the school start page of one request on the server. */
export const readSchoolStartPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolStartInput))
  .handler(async ({ data }) => {
    const { schoolStartPageHandler } = await import("@/lib/entry/page.server");
    return schoolStartPageHandler({ data });
  });

/** Records the admission of the signed-in account whose questionnaire has mounted. */
export const admitOnboardingFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { admitOnboardingHandler } = await import("@/lib/entry/page.server");
    return admitOnboardingHandler({ data: undefined });
  }
);
