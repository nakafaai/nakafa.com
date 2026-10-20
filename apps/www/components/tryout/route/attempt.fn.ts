import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";

/** The address segments of a set page, with its attempt search. */
const SetInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  search: TryoutAttemptSearch,
  set: Schema.String,
  track: Schema.String,
});

/** The address segments of a section page, with its attempt search. */
const SectionInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  search: TryoutAttemptSearch,
  section: Schema.String,
  set: Schema.String,
  track: Schema.String,
});

/** One set page, read on the server for its loader. */
export const readTryoutSetFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SetInput))
  .handler(async (options) => {
    const { readTryoutSetHandler } = await import(
      "@/components/tryout/route/attempt.server"
    );
    return readTryoutSetHandler(options);
  });

/** One section page, read on the server for its loader. */
export const readTryoutSectionFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SectionInput))
  .handler(async (options) => {
    const { readTryoutSectionHandler } = await import(
      "@/components/tryout/route/attempt.server"
    );
    return readTryoutSectionHandler(options);
  });
