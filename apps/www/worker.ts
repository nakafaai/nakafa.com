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
   * `process.env` reads the Worker's bindings under this flag. `nodejs_compat` is
   * the default at this date, so it is not listed: naming it prints a warning.
   */
  compatibilityFlags: ["nodejs_compat_populate_process_env"],
  /** `ssr` is the Worker entry, and `rsc` is the React Server Components environment it loads. */
  viteEnvironments: { entry: "ssr", children: ["rsc"] },
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
