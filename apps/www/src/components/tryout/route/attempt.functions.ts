import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The address segments of a set page. */
const SetInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  set: Schema.String,
  track: Schema.String,
});

/** The address segments of a section page. */
const SectionInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  section: Schema.String,
  set: Schema.String,
  track: Schema.String,
});

/** One set page's catalog view, which the build prerenders as its static answer. */
export const readTryoutSetFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SetInput))
  .handler(async (options) => {
    const { readTryoutSetHandler } = await import(
      "@/components/tryout/route/attempt.server"
    );
    return readTryoutSetHandler(options);
  });

/** One section page's catalog view, which the build prerenders as its static answer. */
export const readTryoutSectionFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SectionInput))
  .handler(async (options) => {
    const { readTryoutSectionHandler } = await import(
      "@/components/tryout/route/section.server"
    );
    return readTryoutSectionHandler(options);
  });
