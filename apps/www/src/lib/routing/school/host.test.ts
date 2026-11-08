import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  readHostRole,
  readRequestHostname,
  readRequestHostRole,
  readSchoolSlug,
  schoolHostBeside,
  schoolOrigin,
} from "@/lib/routing/school/host";

describe("school origin", () => {
  it("names the school's home on its school host under the production domain", () => {
    const slug = Schema.decodeSync(TenantSlug)("harapan");

    expect(schoolOrigin(slug).href).toBe("https://harapan.nakafa.com/");
  });
});

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
    "staging.nakafa.com",
    "nakafa.local.nakafa.com",
  ])("refuses the label of %s, so it names no school", (hostname) => {
    expect(readHostRole(hostname)).toEqual({ _tag: "Refused" });
    expect(readSchoolSlug(hostname)).toEqual(Option.none());
  });
});

describe("host roles", () => {
  it.each([
    ["harapan.nakafa.com", "harapan"],
    ["harapan.localhost", "harapan"],
  ])("names the school of %s", (hostname, slug) => {
    expect(readHostRole(hostname)).toEqual({ _tag: "School", slug });
  });

  it("names the School product's own host", () => {
    expect(readHostRole("school.nakafa.com")).toEqual({ _tag: "Product" });
  });

  it.each([
    "nakafa.com",
    "localhost",
    "www.localhost",
    "school.localhost",
    "a.b.localhost",
    "127.0.0.1",
    "harapan.example.org",
  ])("reads %s as the main site, outside every refusal", (hostname) => {
    expect(readHostRole(hostname)).toEqual({ _tag: "Main" });
  });

  it("reads the role of the Host header, port and all, and a request with none as the main site", () => {
    expect(
      readRequestHostRole(new Headers({ host: "harapan.localhost:3000" }))
    ).toEqual({ _tag: "School", slug: "harapan" });
    expect(readRequestHostRole(new Headers())).toEqual({ _tag: "Main" });
    expect(readRequestHostRole(new Headers({ host: "not a host" }))).toEqual({
      _tag: "Main",
    });
  });
});

describe("school hosts beside a host", () => {
  const slug = Schema.decodeSync(TenantSlug)("harapan");

  it.each([
    ["nakafa.com", "harapan.nakafa.com"],
    ["www.nakafa.com", "harapan.nakafa.com"],
    ["localhost", "harapan.localhost"],
    ["other.localhost", "harapan.localhost"],
  ])("puts a school beside %s at %s", (hostname, host) => {
    expect(schoolHostBeside(hostname, slug)).toEqual(Option.some(host));
  });

  it("puts no school beside a host outside the school domains", () => {
    expect(schoolHostBeside("harapan.example.org", slug)).toEqual(
      Option.none()
    );
  });
});

describe("request hostnames", () => {
  it.each([
    ["harapan.nakafa.com", "harapan.nakafa.com"],
    ["nakafa.com", "nakafa.com"],
    ["harapan.localhost:3000", "harapan.localhost"],
    ["127.0.0.1:3000", "127.0.0.1"],
  ])("reads the hostname of the Host header %s", (host, hostname) => {
    expect(readRequestHostname(new Headers({ host }))).toEqual(
      Option.some(hostname)
    );
  });

  it("names no host without a Host header", () => {
    expect(readRequestHostname(new Headers())).toEqual(Option.none());
  });

  it.each(["", "not a host", "harapan.nakafa.com/classes"])(
    "names no host for the Host header %s",
    (host) => {
      expect(readRequestHostname(new Headers({ host }))).toEqual(Option.none());
    }
  );
});
