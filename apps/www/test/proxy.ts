import { expect } from "@effect/vitest";
import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import { Array as Arr, Effect } from "effect";
import type { NextRequest } from "next/server";
import { LOCALE_BYPASS_PATHS } from "@/lib/routing/bypass";
/** The app's not-found page in one locale, answered with its status and Vary fields. */
export function expectNotFoundPage(
  response: Response,
  locale: string,
  status: 404 | 410,
  vary = "Accept, Accept-Encoding, RSC"
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("x-middleware-rewrite")).toBe(
    `http://localhost:3000/_not-found/${locale}`
  );
  expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe(
    locale
  );
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
  expect(response.headers.get("vary")).toBe(vary);
}

/** Public redirect examples cover renderer URLs, locale spelling and suffixes. */
export const redirectCases: [
  string,
  string,
  ConstructorParameters<typeof NextRequest>[1]?,
][] = [
  [
    "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle?utm=test",
    "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling?utm=test",
    {
      headers: {
        accept: "application/json",
      },
    },
  ],
  [
    "/de/articles/politics/regional-elections-turmoil?source=agent",
    "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen?source=agent",
    {
      headers: {
        accept: "text/markdown",
      },
    },
  ],
  [
    "/de/articles/politics/regional-elections-turmoil.mdx?source=agent",
    "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen.mdx?source=agent",
  ],
  [
    "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris",
    "/id/try-out/indonesia/snbt/2027/set-1/literasi-dalam-bahasa-inggris",
  ],
];
/** Every file the proxy passes on by name, read from the proxy's own list. */
const passedOnFiles = Arr.fromIterable(LOCALE_BYPASS_PATHS);
/**
 * Resource patterns that still require routing checks, and paths that only
 * resemble the analytics path or a file the proxy passes on by name, such as
 * its spelling with a trailing slash or in upper case, which the proxy does
 * not skip.
 */
export const matched = [
  ...Arr.map(
    "svg jpg jpeg gif webp glb gltf bin ktx2 hdr exr js css xml webmanifest txt".split(
      " "
    ),
    (extension) => `/missing.${extension}`
  ),
  `${POSTHOG_PROXY_PATH}x`,
  `/en${POSTHOG_PROXY_PATH}/flags`,
  "/other-logo.svg",
  "/logo.svgx",
  ...Arr.flatMap(passedOnFiles, (path) => [`${path}/`, path.toUpperCase()]),
];
/** Resources owned by static serving, the analytics rewrite, or hard not-found routing. */
export const bypassed = [
  "/.well-known/llms.txt",
  "/sitemap/base.xml",
  "/llms/en/articles/page/0/llms.txt",
  "/_next/static/chunks/app.js",
  "/logos/itb.png",
  "/models/physics/kinematics/kenney-car-kit/Textures/colormap.png",
  "/open-graph/curriculum/en-merdeka.png",
  "/missing.png",
  "/_not-found/id",
  POSTHOG_PROXY_PATH,
  `${POSTHOG_PROXY_PATH}/i/v0/e/`,
  `${POSTHOG_PROXY_PATH}/flags`,
  ...passedOnFiles,
];

/** Paths that the proxy passes on without locale routing, whatever its matcher does with them. */
export const passedOn: [
  string,
  ConstructorParameters<typeof NextRequest>[1]?,
][] = [
  [`${POSTHOG_PROXY_PATH}/i/v0/e/`, { method: "POST" }],
  ...Arr.map(passedOnFiles, (path): [string] => [path]),
];

/** Locale hints cannot authorize access to internal route spellings. */
export const localeHints: [
  string,
  ConstructorParameters<typeof NextRequest>[1]?,
][] = [
  ["missing", undefined],
  [
    "matching",
    {
      headers: {
        "x-next-intl-locale": "en",
      },
    },
  ],
  [
    "mismatched",
    {
      headers: {
        "x-next-intl-locale": "id",
      },
    },
  ],
  [
    "other active",
    {
      headers: {
        "x-next-intl-locale": "de",
      },
    },
  ],
];

/** Public routes that a locale hint or an unknown locale must not turn into an internal rewrite. */
export const publicRoutes: [
  string,
  ConstructorParameters<typeof NextRequest>[1]?,
][] = [
  ["/en", { headers: { "x-next-intl-locale": "en" } }],
  ["/en/search", { headers: { "x-next-intl-locale": "en" } }],
  ["/zz/quran/1", undefined],
  ["/id/kurikulum", undefined],
];

/** One page asked for as Markdown and as a representation it does not have. */
export const representations: [
  string,
  string,
  ConstructorParameters<typeof NextRequest>[1],
  string | null,
][] = [
  [
    "accept header",
    "/en/terms-of-service",
    { headers: { accept: "text/markdown" } },
    "http://localhost:3000/llms.mdx/en/terms-of-service",
  ],
  [
    "unacceptable header",
    "/en/terms-of-service",
    { headers: { accept: "text/x-component" } },
    null,
  ],
];

/**
 * The signed reference that Convex answers for a route that exists. The proxy
 * only asks whether the route is there, and the content store keeps the answer
 * only when it fits the result schema of the query, so every field is real.
 */
const routeReference = {
  alignmentId: "alignment:test:route",
  assetId: "asset:test:route",
  conceptId: "concept:test:route",
  content_id: "content:test:route",
  description: "A published route.",
  learningObjectId: "lo:test:route",
  lensId: "lens:test:route",
  locale: "en",
  route: "try-out/indonesia/snbt/2027/set-1",
  section: "tryout",
  title: "Set 1",
  url: "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-1",
};

/** What a test hands to the mocked Convex query so that a route exists. */
export const routeAnswer = Effect.succeed(routeReference);

/** The published SNBT exam with its one live year track. */
export const snbtExam = {
  country: {
    countryCode: "ID",
    countryKey: "indonesia",
    publicPath: "try-out/indonesia",
    title: "Indonesia",
  },
  exam: {
    examKey: "snbt",
    publicPath: "try-out/indonesia/snbt",
    scoringStrategy: "irt",
    title: "SNBT",
  },
  tracks: [
    {
      publicPath: "try-out/indonesia/snbt/2027",
      trackKey: "2027",
      trackKind: "year",
    },
  ],
};
