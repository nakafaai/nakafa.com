import { COMPANY_IDENTITY } from "@repo/seo/company";
import { HashSet, Schema } from "effect";

const loopbackHostnames = HashSet.make("127.0.0.1", "[::1]", "localhost");
function isEmailUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && HashSet.has(loopbackHostnames, url.hostname))
  );
}

/** A link in an email: HTTPS, or HTTP on a loopback host for local previews. */
export const EmailUrlSchema = Schema.String.check(
  Schema.makeFilter(isEmailUrl, {
    message: "Expected HTTPS or a loopback HTTP URL.",
  })
);
const canonicalSiteUrl = new URL(COMPANY_IDENTITY.url);

/** Resolves a canonical public Nakafa URL for email assets and previews. */
export function getPublicEmailUrl(pathname: string) {
  return new URL(pathname, canonicalSiteUrl).href;
}
