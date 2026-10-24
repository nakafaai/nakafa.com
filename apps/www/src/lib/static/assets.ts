import { Context } from "effect";

/**
 * The static assets of this Worker. The build writes the feeds, the indexes and
 * the social images as files, so the server reads a file from here when an
 * address aliases one of them. No runtime route renders them.
 */
export class StaticAssets extends Context.Service<
  StaticAssets,
  {
    readonly fetch: (request: Request) => Promise<Response>;
  }
>()("www/lib/static/assets/StaticAssets") {}
