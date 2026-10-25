import { Array as Arr } from "effect";

/** Builds the Page projection fields consumed by sitemap route assembly. */
export function pageProjection(
  appLocale: "de" | "en" | "id",
  publicPath: string,
  pageKey: string
) {
  return {
    appLocale,
    metadata:
      pageKey === "imprint"
        ? {
            dateModified: "2026-08-21",
            datePublished: "2026-08-20",
          }
        : { datePublished: "2026-08-22" },
    pageKey,
    publicPath,
  };
}

/** Builds `count` zero-padded hexadecimal bucket ids, starting at `000`. */
export function bucketIds(count: number) {
  return Arr.makeBy(count, (index) => index.toString(16).padStart(3, "0"));
}
