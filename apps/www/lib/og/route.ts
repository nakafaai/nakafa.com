const OG_ROUTE_SEGMENT = "og";
const OG_ROUTE_DESTINATION = `/${OG_ROUTE_SEGMENT}/:path*`;
const OG_ROUTE_LOCALE_PATTERN = /^[A-Za-z]{2}$/;

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

/** Reads the locale-shaped owner from one public OG image path. */
export function readOgRouteAliasLocale(pathname: string) {
  if (!isOgRouteAliasPathname(pathname)) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] === OG_ROUTE_SEGMENT ? segments[1] : segments[0];
  if (!(locale && OG_ROUTE_LOCALE_PATTERN.test(locale))) {
    return null;
  }

  return locale;
}
