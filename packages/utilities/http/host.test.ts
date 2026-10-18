import { describe, expect, it } from "@effect/vitest";
import { isLoopbackHostname, readHostname } from "@repo/utilities/http/host";
import { Option } from "effect";

describe("HTTP Host hostnames", () => {
  it.each([
    ["harapan.nakafa.com", "harapan.nakafa.com"],
    ["nakafa.com", "nakafa.com"],
    ["harapan.localhost:3000", "harapan.localhost"],
    ["127.0.0.1:3000", "127.0.0.1"],
    ["[::1]:3000", "[::1]"],
    ["HARAPAN.nakafa.com", "harapan.nakafa.com"],
  ])("reads the hostname of the Host value %s", (host, hostname) => {
    expect(readHostname(host)).toEqual(Option.some(hostname));
  });

  it.each([
    "",
    "not a host",
    "harapan.nakafa.com:",
    "harapan.nakafa.com/classes",
    "harapan.nakafa.com?tab=grades",
    "harapan.nakafa.com#top",
    "harapan.nakafa.com\\classes",
    "evil.example@harapan.nakafa.com",
  ])("names no host for the Host value %s", (host) => {
    expect(readHostname(host)).toEqual(Option.none());
  });
});

describe("loopback hostname", () => {
  it("names localhost, its subdomains and the loopback addresses", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("harapan.localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
  });

  it("does not name a host that merely ends with localhost", () => {
    expect(isLoopbackHostname("nakafa.com")).toBe(false);
    expect(isLoopbackHostname("evillocalhost")).toBe(false);
  });
});
