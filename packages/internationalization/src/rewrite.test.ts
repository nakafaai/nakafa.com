import { describe, expect, it } from "@effect/vitest";
import {
  isSharedPath,
  localeRewrite,
  readSchoolSlug,
  schoolRewrite,
  toCanonicalPath,
  toPublicPath,
} from "@repo/internationalization/src/rewrite";
import { Option } from "effect";

/** The address of one request, as the router sees it. */
const at = (address: string) => new URL(address);

describe("shared paths", () => {
  it.each([
    "/api/ping",
    "/_serverFn/abc",
    "/_nakafa/i/v0/e/",
    "/assets/app.js",
    "/.well-known/llms.txt",
    "/og/article",
    "/llms.mdx/en/articles/x",
    "/sitemap/article-en-0.xml",
    "/robots.txt",
    "/sitemap.xml",
    "/e22d548f7fd2482a9022e3b84e944901.txt",
  ])("keeps %s on every host", (pathname) => {
    expect(isSharedPath(pathname)).toBe(true);
  });

  it.each(["/", "/apix", "/robots.txt.bak", "/en/materials/x", "/school"])(
    "leaves %s to the routes",
    (pathname) => {
      expect(isSharedPath(pathname)).toBe(false);
    }
  );
});

describe("school hosts", () => {
  it.each([
    ["harapan.nakafa.com", "harapan"],
    ["harapan.localhost", "harapan"],
    ["sekolah-ku.nakafa.com", "sekolah-ku"],
  ])("reads %s as the school %s", (hostname, slug) => {
    expect(readSchoolSlug(hostname)).toStrictEqual(Option.some(slug));
  });

  it.each([
    "www.nakafa.com",
    "new.nakafa.com",
    "a.nakafa.com",
    "a.b.nakafa.com",
    "nakafa.com",
    "example.org",
    "localhost",
  ])("reads %s as no school", (hostname) => {
    expect(Option.isNone(readSchoolSlug(hostname))).toBe(true);
  });
});

describe("locale paths", () => {
  it.each([
    ["/id/materi/matematika", "/id/materials/matematika"],
    ["/en/subjects/matematika", "/en/materials/matematika"],
    ["/de/faecher/mathematik", "/de/materials/mathematik"],
    ["/id/kurikulum", "/id/curricula"],
    ["/de/lehrplaene/merdeka/x", "/de/curricula/merdeka/x"],
    ["/en", "/en"],
    ["/", "/"],
  ])("routes %s as %s", (publicPath, canonicalPath) => {
    expect(toCanonicalPath(publicPath)).toBe(canonicalPath);
  });

  it.each([
    ["/en/curricula", "/en/curriculum"],
    ["/materials/x", "/materials/x"],
    ["/en/materials", "/en/subjects"],
    ["/en/materials/x", "/en/subjects/x"],
    ["/de/curricula/merdeka", "/de/lehrplaene/merdeka"],
    ["/id/materials/matematika", "/id/materi/matematika"],
  ])("publishes %s as %s", (canonicalPath, publicPath) => {
    expect(toPublicPath(canonicalPath)).toBe(publicPath);
  });

  it.each([
    "/fr/curriculum",
    "/id/subjects/matematika",
    "/en/materi/x",
    "/en",
    "/",
  ])("keeps %s unchanged in both directions", (pathname) => {
    expect(toCanonicalPath(pathname)).toBe(pathname);
    expect(toPublicPath(pathname)).toBe(pathname);
  });

  it.each([
    "/en/subjects/matematika",
    "/id/materi/matematika",
    "/de/faecher/mathematik/a/b",
    "/en/curriculum/merdeka",
    "/de/lehrplaene",
  ])("returns %s to itself after the router round trip", (pathname) => {
    expect(toPublicPath(toCanonicalPath(pathname))).toBe(pathname);
  });

  it.each([
    "/en/curricula",
    "/id/materials/matematika",
    "/de/curricula/merdeka",
    "/en/materials",
  ])("returns the router path %s to itself after the output", (pathname) => {
    expect(toCanonicalPath(toPublicPath(pathname))).toBe(pathname);
  });
});

describe("locale rewrite of a URL", () => {
  it("maps the input to the router path and keeps the query", () => {
    const url = at("https://nakafa.com/id/materi/matematika?tab=1");
    const input = localeRewrite.input({ url });
    expect(input.href).toBe("https://nakafa.com/id/materials/matematika?tab=1");
    expect(url.href).toBe("https://nakafa.com/id/materi/matematika?tab=1");
  });

  it("maps the output to the public path", () => {
    const output = localeRewrite.output({
      url: at("https://nakafa.com/de/curricula/merdeka"),
    });
    expect(output.pathname).toBe("/de/lehrplaene/merdeka");
  });
});

describe("school host rewrite of the input", () => {
  it.each([
    [
      "https://harapan.nakafa.com/",
      "https://harapan.nakafa.com/school/harapan",
    ],
    [
      "https://harapan.nakafa.com/exams?x=1",
      "https://harapan.nakafa.com/school/harapan/exams?x=1",
    ],
    [
      "http://harapan.localhost:3000/exams",
      "http://harapan.localhost:3000/school/harapan/exams",
    ],
    [
      "https://harapan.nakafa.com/api/ping",
      "https://harapan.nakafa.com/api/ping",
    ],
    ["https://www.nakafa.com/exams", "https://www.nakafa.com/exams"],
    ["https://nakafa.com/exams", "https://nakafa.com/exams"],
  ])("maps %s to %s", (address, routed) => {
    expect(schoolRewrite.input({ url: at(address) }).href).toBe(routed);
  });
});

describe("school host rewrite of the output", () => {
  it.each([
    [
      "https://nakafa.com/school/harapan/exams?x=1",
      "https://harapan.nakafa.com/exams?x=1",
    ],
    ["https://nakafa.com/school/harapan", "https://harapan.nakafa.com/"],
    [
      "http://harapan.localhost:3000/school/globex/exams",
      "http://globex.localhost:3000/exams",
    ],
    ["https://nakafa.com/school/new", "https://nakafa.com/school/new"],
    ["https://nakafa.com/school/a/exams", "https://nakafa.com/school/a/exams"],
    ["https://nakafa.com/en/curriculum", "https://nakafa.com/en/curriculum"],
    ["https://nakafa.com/school", "https://nakafa.com/school"],
    [
      "https://example.org/school/harapan",
      "https://example.org/school/harapan",
    ],
  ])("maps %s to %s", (routed, address) => {
    expect(schoolRewrite.output({ url: at(routed) }).href).toBe(address);
  });

  it("maps a school address back to the school tree", () => {
    const address = at("https://harapan.nakafa.com/exams/ujian?x=1");
    const routed = schoolRewrite.input({ url: address });
    expect(routed.href).toBe(
      "https://harapan.nakafa.com/school/harapan/exams/ujian?x=1"
    );
    expect(schoolRewrite.output({ url: routed }).href).toBe(address.href);
  });

  it.each([
    [
      "https://nakafa.com/school/harapan/exams/ujian?x=1",
      "https://harapan.nakafa.com/school/harapan/exams/ujian?x=1",
    ],
    [
      "https://nakafa.com/school/harapan",
      "https://harapan.nakafa.com/school/harapan",
    ],
    [
      "http://harapan.localhost:3000/school/harapan/exams",
      "http://harapan.localhost:3000/school/harapan/exams",
    ],
  ])("routes the school address of %s back to %s", (routed, routedInput) => {
    const address = schoolRewrite.output({ url: at(routed) });
    expect(schoolRewrite.input({ url: address }).href).toBe(routedInput);
  });
});
