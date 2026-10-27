import { deploymentKeys, postHogProxyKeys } from "@repo/analytics/keys";
import { agentTrustKeys, convexSiteServerKeys } from "@repo/backend/keys";
import {
  contentRuntimeKeys,
  previewKeys,
  publicationKeys,
  siteUrlKeys,
} from "@repo/site/keys";
import { Array as Arr, Record, Redacted } from "effect";
import { setValues } from "#www/deploy/environment";
import { weatherKeys } from "#www/src/lib/weather/keys";

/**
 * The Worker's runtime settings. `alchemy.run.ts` deploys the app with them, and
 * `vite.config.ts` runs `vite dev`, `vite build` and `vite preview` in workerd
 * with the same ones, so neither keeps a copy.
 */
/** A prerendered page answers at its path without a trailing slash. */
const HTML_HANDLING = "drop-trailing-slash" as const;

/** A path with no asset answers the nearest `404.html`. */
const NOT_FOUND_HANDLING = "404-page" as const;

export const workerSettings = {
  /**
   * The Worker name that a local preview gives workerd. A deploy keeps the name
   * that Alchemy derives for its stage, so two stages never share one Worker.
   */
  name: "nakafa-www",
  /**
   * Pinned, so one deploy and the next run the same Workers runtime. This is the
   * newest date that the workerd binary of Alchemy's runtime (1.20261012.1)
   * supports. 2026-10-24 needs workerd 1.20261024.1, which that runtime does not pin.
   */
  compatibilityDate: "2026-10-19",
  /**
   * `process.env` reads the Worker's bindings under the first flag.
   * `nodejs_compat` is the default at this date, so it is not listed: naming it
   * prints a warning.
   *
   * The second flag keeps a browser navigation like any other request: one that
   * matches no asset reaches the Worker, which renders its routes and answers
   * every other path with the static 404 page. By default at this date the
   * assets answer a navigation that misses with `404.html` before the Worker
   * runs, so a signed-in page such as `/id/auth` answered 404 when a browser
   * opened or reloaded it.
   * https://developers.cloudflare.com/workers/configuration/compatibility-flags/#navigation-requests-prefer-asset-serving
   */
  compatibilityFlags: [
    "nodejs_compat_populate_process_env",
    "assets_navigation_has_no_effect",
  ],
  /** `ssr` is the Worker entry, and `rsc` is the React Server Components environment it loads. */
  viteEnvironments: { entry: "ssr", children: ["rsc"] },
  /**
   * How the static assets answer, in the deployed Worker and in the local preview
   * alike. A prerendered page is `<path>/index.html`, and its URL has no trailing
   * slash, so the asset answers at `/en` instead of redirecting to `/en/`. A path
   * with no asset reaches the Worker, a browser navigation included under the
   * flag above, and the Worker answers the nearest `404.html`.
   */
  assets: {
    htmlHandling: HTML_HANDLING,
    notFoundHandling: NOT_FOUND_HANDLING,
  },
};

/**
 * The server environment that the Worker reads at runtime. Every key comes from a
 * reader whose Schema validates it, so the Worker binds no key that a reader does
 * not declare, and no second list of names exists. The browser readers of
 * `env.public.ts` are absent: Vite inlines their values at build time.
 */
export const workerEnvironment = () => ({
  ...publicationKeys(),
  ...siteUrlKeys(),
  ...contentRuntimeKeys(),
  ...previewKeys(),
  ...agentTrustKeys(),
  ...convexSiteServerKeys(),
  ...postHogProxyKeys(),
  ...deploymentKeys(),
  ...weatherKeys(),
});

/**
 * The bindings of the deployed Worker, which `alchemy.run.ts` passes to Alchemy.
 * A reader refuses a required value that is missing or empty, and an unset
 * optional value is never bound. A `VITE_` name is public and the client bundle
 * inlines it, so Alchemy binds it as plain text. Every other value is a secret,
 * which the dashboard never shows.
 */
export const deployedWorkerBindings = () =>
  Record.fromEntries(
    Arr.map(
      Record.toEntries({
        ...setValues(workerEnvironment()),
        NODE_ENV: "production",
      }),
      ([name, value]) => [
        name,
        name.startsWith("VITE_") ? value : Redacted.make(value),
      ]
    )
  );
