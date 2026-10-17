import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  isRefusedSchoolHost,
  readRequestHostname,
  readSchoolSlug,
} from "@/lib/routing/school/host";

describe("school host labels", () => {
  it.each([
    ["harapan.nakafa.com", "harapan"],
    ["sma-harapan-2.nakafa.com", "sma-harapan-2"],
    ["harapan.localhost", "harapan"],
  ])("reads the school address of %s", (hostname, slug) => {
    expect(readSchoolSlug(hostname)).toEqual(Option.some(slug));
  });

  it.each([
    "nakafa.com",
    "localhost",
    "www.localhost",
    "api.nakafa.com.example.org",
    "harapan.example.org",
  ])("names no school for %s", (hostname) => {
    expect(readSchoolSlug(hostname)).toEqual(Option.none());
  });

  it.each([
    "www.nakafa.com",
    "nina.nakafa.com",
    "a.nakafa.com",
    "har_apan.nakafa.com",
    "harapan.sekolah.nakafa.com",
    "-harapan.nakafa.com",
  ])("refuses the label of %s and sends it to the main site", (hostname) => {
    expect(isRefusedSchoolHost(hostname)).toBe(true);
    expect(readSchoolSlug(hostname)).toEqual(Option.none());
  });

  it.each([
    ["harapan.nakafa.com", false],
    ["nakafa.com", false],
    ["harapan.localhost", false],
    ["www.localhost", false],
    ["localhost", false],
  ])("does not refuse %s", (hostname, refused) => {
    expect(isRefusedSchoolHost(hostname)).toBe(refused);
  });
});

describe("request hostnames", () => {
  it.each([
    ["harapan.nakafa.com", "harapan.nakafa.com"],
    ["nakafa.com", "nakafa.com"],
    ["harapan.localhost:3000", "harapan.localhost"],
    ["127.0.0.1:3000", "127.0.0.1"],
    ["[::1]:3000", "[::1]"],
    ["HARAPAN.nakafa.com", "harapan.nakafa.com"],
  ])("reads the hostname of the Host header %s", (host, hostname) => {
    expect(readRequestHostname(new Headers({ host }))).toBe(hostname);
  });

  it("names no host without a Host header", () => {
    expect(readRequestHostname(new Headers())).toBe("");
  });

  it.each(["", "not a host"])(
    "names no host for the Host header %s",
    (host) => {
      expect(readRequestHostname(new Headers({ host }))).toBe("");
    }
  );
});
