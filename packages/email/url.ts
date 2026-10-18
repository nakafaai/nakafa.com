import { isLoopbackHostname } from "@repo/utilities/http/host";
import { Schema } from "effect";

function isEmailUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && isLoopbackHostname(url.hostname))
  );
}

/** A link in an email: HTTPS, or HTTP on a loopback host for local previews and local school hosts. */
export const EmailUrlSchema = Schema.String.check(
  Schema.makeFilter(isEmailUrl, {
    message: "Expected HTTPS or a loopback HTTP URL.",
  })
);
