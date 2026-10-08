import { Array as Arr, Option, Result, Schema } from "effect";
import { IpNetwork, NetAddress } from "effect/net";

/** The verdict on an address: outside every refused range, or inside one. */
export const AddressVerdict = Schema.Literals(["public", "refused"]);
export type AddressVerdict = typeof AddressVerdict.Type;

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

  // A host name has no address verdict, so it passes this syntax check.
  if (
    Option.exists(judgeAddress(hostname), (verdict) => verdict === "refused")
  ) {
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

/**
 * Judges address text. Text that the address parser does not accept as an
 * address gives none, so a host name, a zone-suffixed IPv6 text, or a
 * non-canonical numeric form has no verdict. An address inside a refused range
 * gives "refused", and any other address gives "public". An IPv4-mapped IPv6
 * address takes the IPv4 verdict.
 */
export function judgeAddress(text: string): Option.Option<AddressVerdict> {
  const parsed = NetAddress.ipFromString(normalizeHostname(text));

  if (Result.isFailure(parsed)) {
    return Option.none();
  }

  return Option.some(isRefusedAddress(parsed.success) ? "refused" : "public");
}

/**
 * RFC 4291 section 2.5.5.1: IPv4-compatible IPv6 addresses (::a.b.c.d) are
 * deprecated, so the whole block is refused.
 */
const ipv4CompatibleNetwork = IpNetwork.fromStringUnsafe("::/96");

/** IPv4 special-use blocks that no NetAddress predicate covers exactly. */
const refusedIpv4Networks = Arr.map(
  [
    "0.0.0.0/8",
    "100.64.0.0/10",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.31.196.0/24",
    "192.52.193.0/24",
    "192.88.99.0/24",
    "192.175.48.0/24",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "240.0.0.0/4",
  ],
  (cidr) => IpNetwork.fromStringUnsafe(cidr)
);

/**
 * IPv6 special-use blocks that no NetAddress predicate covers exactly.
 * 2001::/23 (RFC 2928) holds Teredo, benchmarking, AMT, AS112, ORCHID, and the
 * drone identity tags, so they need no entry of their own.
 */
const refusedIpv6Networks = Arr.map(
  [
    "100::/64",
    "2001::/23",
    "2001:db8::/32",
    "2002::/16",
    "2620:4f:8000::/48",
    "3fff::/20",
    "5f00::/16",
    "64:ff9b::/96",
    "64:ff9b:1::/48",
    "fec0::/10",
    "::ffff:0:0:0/96",
  ],
  (cidr) => IpNetwork.fromStringUnsafe(cidr)
);

function isRefusedAddress(address: NetAddress.IpAddress): boolean {
  if (NetAddress.isIpv4Address(address)) {
    return isRefusedIpv4(address);
  }

  return Option.match(NetAddress.fromIpv4Mapped(address), {
    onNone: () => isRefusedIpv6(address),
    onSome: isRefusedIpv4,
  });
}

function isRefusedIpv4(address: NetAddress.Ipv4Address): boolean {
  return (
    NetAddress.isBroadcast(address) ||
    NetAddress.isLinkLocal(address) ||
    NetAddress.isLoopback(address) ||
    NetAddress.isMulticast(address) ||
    NetAddress.isPrivate(address) ||
    Arr.some(refusedIpv4Networks, (network) =>
      IpNetwork.contains(network, address)
    )
  );
}

function isRefusedIpv6(address: NetAddress.Ipv6Address): boolean {
  return (
    NetAddress.isLinkLocal(address) ||
    NetAddress.isLoopback(address) ||
    NetAddress.isMulticast(address) ||
    NetAddress.isUniqueLocal(address) ||
    NetAddress.isUnspecified(address) ||
    IpNetwork.contains(ipv4CompatibleNetwork, address) ||
    Arr.some(refusedIpv6Networks, (network) =>
      IpNetwork.contains(network, address)
    )
  );
}

/** Localhost names are refused before DNS can resolve them to loopback. */
function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}
