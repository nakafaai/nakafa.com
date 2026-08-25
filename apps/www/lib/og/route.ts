const OG_ROUTE_DESTINATION = "/og/:path*";

const OG_ROUTE_ALIASES = Object.freeze([
  { source: "/:path*.png", suffix: ".png" },
  { source: "/:path*.og", suffix: ".og" },
  { source: "/:path*/image.png", suffix: "/image.png" },
]);

/** Builds the public aliases that route social images to the OG handler. */
export function createOgRouteAliasRewrites() {
  return OG_ROUTE_ALIASES.map(({ source }) => ({
    destination: OG_ROUTE_DESTINATION,
    source,
  }));
}

/** Identifies non-document aliases that Next rewrites after Proxy completes. */
export function isOgRouteAliasPathname(pathname: string) {
  const normalizedPathname = pathname.toLowerCase();
  return OG_ROUTE_ALIASES.some(({ suffix }) =>
    normalizedPathname.endsWith(suffix)
  );
}
