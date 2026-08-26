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

/** Reads the locale-shaped prefix from one localized OG alias. */
export function readOgRouteAliasLocale(pathname: string) {
  if (!isOgRouteAliasPathname(pathname)) {
    return null;
  }

  const [locale] = pathname.split("/").filter(Boolean);
  if (
    !(locale && OG_ROUTE_LOCALE_PATTERN.test(locale)) ||
    locale === OG_ROUTE_SEGMENT
  ) {
    return null;
  }

  return locale;
}
