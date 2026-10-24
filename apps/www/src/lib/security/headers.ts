import { postHogProxyKeys } from "@repo/analytics/keys";
import { agentTrustKeys, convexSiteServerKeys } from "@repo/backend/keys";
import {
  createLoopbackConnectSources,
  createSecurityHeaders,
} from "@repo/site";
import { AGENT_DISCOVERY_HEADERS } from "@repo/site/discovery";
import { Array as Arr, Option, Result, Schema } from "effect";
import { CONTENT_LICENSE_URL } from "@/lib/seo/license";

const WwwHeaderSchema = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
});

/** One response header as a name and its value. */
export type WwwHeader = typeof WwwHeaderSchema.Type;

const WwwHeaderOriginsSchema = Schema.Struct({
  /** The Convex deployment that the browser calls, or none when unset. */
  convexUrl: Schema.UndefinedOr(Schema.String),
  /** The Convex site that serves Better Auth, which the server calls. */
  convexSiteUrl: Schema.String,
  /** The first-party PostHog proxy host that analytics sends events to. */
  posthogProxyHost: Schema.String,
});

/** The origins that the page headers name. */
type WwwHeaderOrigins = typeof WwwHeaderOriginsSchema.Type;

/** The longest line that the static assets accept in a `_headers` file. */
const MAX_HEADERS_LINE_LENGTH = 2000;

/** A `_headers` line that the static assets would refuse, so the file is never written. */
export class WwwHeaderLineTooLong extends Schema.TaggedError<WwwHeaderLineTooLong>()(
  "WwwHeaderLineTooLong",
  { prefix: Schema.String }
) {}

/**
 * Builds the headers of every www answer: the security policy, the agent
 * discovery links and the TDM reservation, which reserves model training on
 * every page under the content license. A loopback Convex deployment joins the
 * policy only while it runs on this machine, and the PostHog proxy host is the
 * one analytics origin.
 */
export function createWwwHeaders(origins: WwwHeaderOrigins): WwwHeader[] {
  const convexOrigins = Arr.flatMap(
    [origins.convexUrl, origins.convexSiteUrl],
    (value) =>
      value === undefined || !URL.canParse(value)
        ? []
        : createLoopbackConnectSources(new URL(value))
  );
  return [
    ...createSecurityHeaders({
      additionalConnectSources: [
        ...convexOrigins,
        new URL(origins.posthogProxyHost).origin,
      ],
      additionalImageSources: Arr.filter(convexOrigins, (source) =>
        source.startsWith("http:")
      ),
    }),
    ...AGENT_DISCOVERY_HEADERS,
    { key: "tdm-reservation", value: "1" },
    { key: "tdm-policy", value: CONTENT_LICENSE_URL },
  ];
}

/** Reads the origins from the environment that the server and the build share. */
export function readWwwHeaderOrigins(): WwwHeaderOrigins {
  return {
    convexSiteUrl: convexSiteServerKeys().VITE_CONVEX_SITE_URL,
    convexUrl: agentTrustKeys().VITE_CONVEX_URL,
    posthogProxyHost: postHogProxyKeys().VITE_POSTHOG_PROXY_HOST,
  };
}

/**
 * Writes the headers as one `_headers` rule for every path. Each header is an
 * indented line under the rule, the form that the static assets read. A line
 * over the platform limit fails, so no header is dropped silently.
 */
export function renderHeadersFile(headers: readonly WwwHeader[]) {
  const lines = [
    "/*",
    ...Arr.map(headers, ({ key, value }) => `  ${key}: ${value}`),
  ];
  const tooLong = Arr.findFirst(
    lines,
    (line) => line.length > MAX_HEADERS_LINE_LENGTH
  );
  if (Option.isSome(tooLong)) {
    return Result.fail(
      new WwwHeaderLineTooLong({ prefix: tooLong.value.slice(0, 40) })
    );
  }
  return Result.succeed(`${Arr.join(lines, "\n")}\n`);
}
