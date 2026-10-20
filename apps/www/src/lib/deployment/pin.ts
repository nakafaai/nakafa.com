/** The query parameter that names the deployment a request is pinned to. */
const DEPLOYMENT_PARAM = "dpl";

/**
 * Pins one server-function URL to the deployment that served the page. A browser
 * built by one deployment keeps calling that deployment's server functions after
 * a newer one is live, so the two never mix their request shapes. Without a
 * deployment id, which a local build has, the URL is left as it is.
 */
export function pinServerFunctionUrl(
  url: string,
  deploymentId: string | undefined,
  base: string
): string {
  if (deploymentId === undefined || deploymentId === "") {
    return url;
  }
  const pinned = new URL(url, base);
  pinned.searchParams.set(DEPLOYMENT_PARAM, deploymentId);
  return pinned.href;
}
