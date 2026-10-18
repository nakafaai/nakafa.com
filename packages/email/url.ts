import { HashSet, Schema, String as Str } from "effect";

const loopbackHostnames = HashSet.make("127.0.0.1", "[::1]", "localhost");

/**
 * Whether a host name is a loopback host: one of the loopback names, or a name
 * under `localhost`, such as a school's local host `harapan.localhost`, which
 * resolves to the loopback address (RFC 6761).
 */
function isLoopback(hostname: string) {
  return (
    HashSet.has(loopbackHostnames, hostname) ||
    Str.endsWith(".localhost")(hostname)
  );
}

function isEmailUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && isLoopback(url.hostname))
  );
}

/** A link in an email: HTTPS, or HTTP on a loopback host for local previews and local school hosts. */
export const EmailUrlSchema = Schema.String.check(
  Schema.makeFilter(isEmailUrl, {
    message: "Expected HTTPS or a loopback HTTP URL.",
  })
);
