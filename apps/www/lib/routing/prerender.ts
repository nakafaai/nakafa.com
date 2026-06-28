const LEARNING_STATIC_PARAM_LIMIT = 512;

/**
 * Keeps learning-route prerender output bounded for Cache Components builds.
 *
 * Sitemap, canonical metadata, and route lookup still cover the full public
 * inventory. This only limits which dynamic learning pages Next prerenders at
 * build time; long-tail URLs remain renderable on demand.
 */
export function selectLearningStaticParams<Param>(params: readonly Param[]) {
  return params.slice(0, LEARNING_STATIC_PARAM_LIMIT);
}

/** Reports the current learning-route prerender cap for tests and PR proof. */
export function readLearningStaticParamLimit() {
  return LEARNING_STATIC_PARAM_LIMIT;
}
