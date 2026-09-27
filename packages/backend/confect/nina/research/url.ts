import ipaddr from "ipaddr.js";

/** Checks whether a scrape URL is syntactically safe for public fetching. */
export function isPublicHttpUrlSyntax(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }

  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  const hostname = normalizeHostname(url.hostname);

  if (!hostname || isLocalHostname(hostname)) {
    return false;
  }

  if (isBlockedIpAddress(hostname)) {
    return false;
  }

  return true;
}

/** Normalizes URL hostnames before IP and localhost checks. */
export function normalizeHostname(hostname: string) {
  const host = hostname.trim().toLowerCase();

  if (host.startsWith("[") && host.endsWith("]")) {
    return host.slice(1, -1);
  }

  return host;
}

/** Checks whether a hostname is already an IP literal. */
export function isIpAddress(hostname: string) {
  return ipaddr.isValid(normalizeHostname(hostname));
}

/** Blocks non-public IP ranges before server-side scraping. */
export function isBlockedIpAddress(hostname: string) {
  const host = normalizeHostname(hostname);

  if (!ipaddr.isValid(host)) {
    return false;
  }

  return ipaddr.process(host).range() !== "unicast";
}

/** Blocks localhost names before DNS can resolve them to loopback addresses. */
function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}
