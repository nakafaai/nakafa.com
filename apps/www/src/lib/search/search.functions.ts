import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** One content search: the active locale and the query text the learner typed. */
const SearchRequest = Schema.Struct({
  locale: LocaleSchema,
  query: Schema.String,
});

/** Answers one content search on the server, through the read every viewer shares. */
export const searchHandler = async ({
  data,
}: {
  readonly data: typeof SearchRequest.Type;
}) => {
  const { readSearchHandler } = await import("@/lib/search/search.server");
  return readSearchHandler({ data });
};

/** The content search results of one query, read on the server for every viewer. */
export const readSearchFn = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SearchRequest))
  .handler(searchHandler);
