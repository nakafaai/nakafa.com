import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  forwardedBody,
  forwardedRequestHeaders,
  forwardedResponseHeaders,
  schoolApiTarget,
} from "@/lib/tenant/api";

const SITE = "https://example.convex.site";

/** A request to a host with headers, as the Worker receives it. */
const requestTo = (
  host: string,
  path: string,
  headers: Record<string, string> = {}
) => new Request(`https://${host}${path}`, { headers: { host, ...headers } });

describe("lib/tenant/api", () => {
  it("forwards a school host's API path, with its query, to the school API of the Convex site", () => {
    expect(
      Option.map(
        schoolApiTarget(
          requestTo("harapan.nakafa.com", "/api/v1/cohorts?period=p1"),
          SITE
        ),
        (url) => url.href
      )
    ).toEqual(Option.some(`${SITE}/api/school/v1/cohorts?period=p1`));
  });

  it("forwards a school host's MCP path to the school MCP server, and no other path", () => {
    expect(
      Option.map(
        schoolApiTarget(requestTo("harapan.nakafa.com", "/mcp"), SITE),
        (url) => url.href
      )
    ).toEqual(Option.some(`${SITE}/api/school/mcp`));
    expect(
      Option.isNone(
        schoolApiTarget(requestTo("harapan.nakafa.com", "/mcpx"), SITE)
      )
    ).toBe(true);
  });

  it("forwards nothing from a host that names no school", () => {
    expect(
      Option.isNone(
        schoolApiTarget(requestTo("nakafa.com", "/api/v1/periods"), SITE)
      )
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
    const answered = forwardedResponseHeaders({
      "retry-after": "3",
      "set-cookie": "x=y",
    });
    expect(answered.get("retry-after")).toBe("3");
    expect(answered.get("set-cookie")).toBeNull();
  });

  it.effect(
    "sends a POST's bytes with the media type they came with, and no body on a read",
    () =>
      Effect.gen(function* () {
        const form = "grant_type=client_credentials&client_id=c";
        const posted = yield* forwardedBody(
          new Request("https://harapan.nakafa.com/api/v1/token", {
            body: form,
            headers: { "content-type": "application/x-www-form-urlencoded" },
            method: "POST",
          })
        );
        expect(posted).toMatchObject({
          _tag: "Uint8Array",
          contentLength: form.length,
          contentType: "application/x-www-form-urlencoded",
        });
        const untyped = yield* forwardedBody(
          new Request("https://harapan.nakafa.com/mcp", {
            body: new Uint8Array([123, 125]),
            method: "POST",
          })
        );
        // Bytes sent without a media type go on as plain bytes.
        expect(untyped).toMatchObject({
          _tag: "Uint8Array",
          contentLength: 2,
          contentType: "application/octet-stream",
        });
        const read = yield* forwardedBody(
          new Request("https://harapan.nakafa.com/api/v1/periods")
        );
        expect(read._tag).toBe("Empty");
      })
  );
});
