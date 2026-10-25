import { env } from "cloudflare:workers";

/**
 * Reports whether this Worker serves the static release. The deployed Worker binds
 * the release's assets, and every prerendered page is one of them. A prerender and
 * a development server bind no assets, so they render every route.
 */
export function hasStaticRelease(): boolean {
  return env.ASSETS !== undefined;
}
