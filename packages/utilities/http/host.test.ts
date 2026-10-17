import { describe, expect, it } from "@effect/vitest";
import { readHostname } from "@repo/utilities/http/host";
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
