import { Option } from "effect";

/**
 * The hostname of a Host header value, without its port, such as
 * `harapan.nakafa.com` for `harapan.nakafa.com:3000`. The value names a host
 * only when the URL parser reads it back unchanged, lowercased. So a path, a
 * query, a fragment or userinfo in it names no host, and neither does a value
 * that is not a host at all. A port of 80 is dropped by the URL parser, so
 * `harapan.nakafa.com:80` names no host either, and browsers never send it.
 */
export function readHostname(host: string): Option.Option<string> {
  if (!URL.canParse(`http://${host}`)) {
    return Option.none();
  }
  const url = new URL(`http://${host}`);
  return url.host === host.toLowerCase()
    ? Option.some(url.hostname)
    : Option.none();
}

/**
 * Whether a host name is a loopback name, which only this machine can serve: a
 * local run uses `localhost`, a `*.localhost` name, or an IP loopback address.
 */
export function isLoopbackHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}
