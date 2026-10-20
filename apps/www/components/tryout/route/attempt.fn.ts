import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { readTryoutSetRoute } from "@/components/tryout/route/attempt.server";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";
import { readTryoutSectionRoute } from "@/components/tryout/route/section.server";
import { serverHandler } from "@/lib/server/fn";

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

/** One set page for its learner: the catalog view, or the attempt bound to the URL. */
export const readTryoutSetHandler = serverHandler(
  (data: typeof SetInput.Type) => readTryoutSetRoute(data)
);

/** One set page, read on the server for its loader. */
export const readTryoutSetFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SetInput))
  .handler(readTryoutSetHandler);

/** One section page for its learner: the catalog view, or the attempt bound to the URL. */
export const readTryoutSectionHandler = serverHandler(
  (data: typeof SectionInput.Type) => readTryoutSectionRoute(data)
);

/** One section page, read on the server for its loader. */
export const readTryoutSectionFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SectionInput))
  .handler(readTryoutSectionHandler);
