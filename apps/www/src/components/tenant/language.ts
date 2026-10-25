import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** Saves the language of a school host from the account menu. */
export const saveSchoolLanguage = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(LocaleSchema))
  .handler(async (options) => {
    const { saveSchoolLanguageHandler } = await import(
      "@/components/tenant/language.server"
    );
    return saveSchoolLanguageHandler(options);
  });
