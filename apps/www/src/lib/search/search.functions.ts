import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** One content search: the active locale and the query text the learner typed. */
const SearchRequest = Schema.Struct({
  locale: LocaleSchema,
  query: Schema.String,
});

/** The content search results of one query, read on the server for every viewer. */
export const readSearchFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SearchRequest))
  .handler(async (options) => {
    const { readSearchHandler } = await import("@/lib/search/search.server");
    return readSearchHandler(options);
  });
