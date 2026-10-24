import { deploymentKeys, postHogProxyKeys } from "@repo/analytics/keys";
import { agentTrustKeys } from "@repo/backend/keys";
import {
  contentRuntimeKeys,
  previewKeys,
  publicationKeys,
  siteUrlKeys,
} from "@repo/site/keys";

/**
 * The Worker's runtime settings. `alchemy.run.ts` deploys the app with them, and
 * `vite.config.ts` runs `vite dev`, `vite build` and `vite preview` in workerd
 * with the same ones, so neither keeps a copy.
 */
export const workerSettings = {
  /** The Worker name that a local preview gives workerd. A deploy names its Worker per stage. */
  name: "nakafa-www",
  /**
   * Pinned, so one deploy and the next run the same Workers runtime. This is the
   * newest date that the workerd binary of Alchemy's runtime (1.20261012.1) supports;
   * 2026-10-24 needs workerd 1.20261024.1, which that runtime does not pin.
   */
  compatibilityDate: "2026-10-19",
  /**
   * Node APIs run under `nodejs_compat`, and `process.env` reads the Worker's
   * bindings. Alchemy adds `nodejs_compat` only before 2026-08-04, so it is listed.
   */
  compatibilityFlags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
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
  ...postHogProxyKeys(),
  ...deploymentKeys(),
});
