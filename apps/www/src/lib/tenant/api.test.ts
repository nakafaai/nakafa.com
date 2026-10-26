import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  forwardedRequestHeaders,
  forwardedResponseHeaders,
  schoolApiTarget,
} from "@/lib/tenant/api";

const SITE = "https://example.convex.site";

/** A request to a host with headers, as the Worker receives it. */
const requestTo = (host: string, path: string, headers: Record<string, string> = {}) =>
  new Request(`https://${host}${path}`, { headers: { host, ...headers } });

describe("lib/tenant/api", () => {
  it("forwards a school host's API path, with its query, to the school API of the Convex site", () => {
    expect(
      Option.map(
        schoolApiTarget(requestTo("harapan.nakafa.com", "/api/v1/cohorts?period=p1"), SITE),
        (url) => url.href
      )
    ).toEqual(Option.some(`${SITE}/api/school/v1/cohorts?period=p1`));
  });

  it("forwards nothing from a host that names no school", () => {
    expect(
      Option.isNone(schoolApiTarget(requestTo("nakafa.com", "/api/v1/periods"), SITE))
    ).toBe(true);
  });

  it("keeps the bearer token and drops the cookie both ways", () => {
    const sent = forwardedRequestHeaders(
      new Headers({
        authorization: "Bearer t",
        cookie: "better-auth.session_token=s",
        "content-type": "application/x-www-form-urlencoded",
      })
    );
    expect(sent.get("authorization")).toBe("Bearer t");
    expect(sent.get("cookie")).toBeNull();
    expect(sent.get("accept")).toBeNull();
    const answered = forwardedResponseHeaders(
      new Headers({ "retry-after": "3", "set-cookie": "x=y" })
    );
    expect(answered.get("retry-after")).toBe("3");
    expect(answered.get("set-cookie")).toBeNull();
  });
});
