// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  isSchoolTreePath,
  readSchoolTreeGate,
  withPageHeaders,
} from "@/lib/tenant/gate";

/** A request to a path on one host, with the `host` header the server reads. */
function requestTo(path: string, host?: string) {
  return new Request(`https://nakafa.test${path}`, {
    headers: host === undefined ? {} : { host },
  });
}

describe("isSchoolTreePath", () => {
  it.each([
    "/school",
    "/school/harapan",
    "/school/harapan/exams/abc",
    "/school/new/extra",
    "/id/school/harapan",
    "/%73chool/harapan",
  ])("names a school tree page at %s", (path) => {
    expect(isSchoolTreePath(path)).toBe(true);
  });

  it.each([
    "/",
    "/id",
    "/exams",
    "/school/new",
    "/id/school/new",
    "/school%E0%A4%A",
  ])("does not name a school tree page at %s", (path) => {
    expect(isSchoolTreePath(path)).toBe(false);
  });
});

describe("readSchoolTreeGate", () => {
  it("answers a school tree page of a main host with the not-found locale that it negotiates", () => {
    expect(
      readSchoolTreeGate(requestTo("/school/harapan", "nakafa.test"))
    ).toStrictEqual(Option.some("en"));
  });

  it("answers a school tree page of a request without a host header", () => {
    expect(readSchoolTreeGate(requestTo("/school/harapan"))).toStrictEqual(
      Option.some("en")
    );
  });

  it("answers a school tree page of a host that names no valid host", () => {
    expect(
      readSchoolTreeGate(requestTo("/school/harapan", "bad host"))
    ).toStrictEqual(Option.some("en"));
  });

  it("lets a school host through to its own school tree", () => {
    expect(
      Option.isNone(
        readSchoolTreeGate(
          requestTo("/school/harapan", "harapan.localhost:3000")
        )
      )
    ).toBe(true);
  });

  it("lets the start page of an account through on a main host", () => {
    expect(
      Option.isNone(readSchoolTreeGate(requestTo("/school/new", "nakafa.test")))
    ).toBe(true);
  });

  it("lets every other path of a main host through", () => {
    expect(
      Option.isNone(readSchoolTreeGate(requestTo("/", "nakafa.test")))
    ).toBe(true);
  });
});

describe("withPageHeaders", () => {
  it("marks a school host's page as not indexed and keeps its language and session vary", async () => {
    const request = requestTo("/", "harapan.localhost:3000");
    const response = withPageHeaders(
      request,
      new Response("page", {
        headers: { vary: "Accept-Encoding" },
        status: 200,
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("vary")).toBe(
      "Accept-Encoding, Accept-Language, Cookie"
    );
    expect(await response.text()).toBe("page");
  });

  it("sets the language and session vary on a school host without a vary header", () => {
    const response = withPageHeaders(
      requestTo("/", "harapan.localhost:3000"),
      new Response("page")
    );
    expect(response.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it("marks a main host's not-found answer as not indexed without a vary", () => {
    const response = withPageHeaders(
      requestTo("/missing", "nakafa.test"),
      new Response("missing", { status: 404 })
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("vary")).toBeNull();
  });

  it("gives a main host's other answer the security policy and the agent links", async () => {
    const response = withPageHeaders(
      requestTo("/", "nakafa.test"),
      new Response("home")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain(
      "https://t.nakafa.com"
    );
    expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
    expect(await response.text()).toBe("home");
  });
});
