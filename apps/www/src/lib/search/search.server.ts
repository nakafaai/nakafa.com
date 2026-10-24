import { HttpClient } from "@confect/js";
import contents from "@repo/backend/confect/_generated/refs/contents";
import { NAKAFA_AGENT_DEFAULT_LIMIT } from "@repo/contents/agent/search";
import type { Locale } from "@repo/internationalization/src/locale";
import { Effect } from "effect";
import { httpLayer } from "@/lib/convex/http";
import { serverHandler } from "@/lib/server/fn";

/** The public content search of one locale, read without a viewer's identity. */
const readSearchResults = Effect.fn("www.search.readResults")(
  function* (input: { readonly locale: Locale; readonly query: string }) {
    const response = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(contents.queries.search.search, {
        limit: NAKAFA_AGENT_DEFAULT_LIMIT,
        locale: input.locale,
        offset: 0,
        queries: [input.query],
      })
    ).pipe(Effect.provide(httpLayer({})));
    return response.items;
  }
);

/** The content search a page answers with, for every viewer. */
export const readSearchHandler = serverHandler(readSearchResults);
