import { Array as Arr } from "effect";
import type { NextRequest } from "next/server";
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
/** Resource patterns that still require routing checks. */
export const matched = Arr.map(
  "svg jpg jpeg gif webp glb gltf bin ktx2 hdr exr js css xml webmanifest txt".split(
    " "
  ),
  (extension) => `/missing.${extension}`
);
/** Resources owned by static serving or hard not-found routing. */
export const bypassed = [
  "/.well-known/llms.txt",
  "/sitemap/base.xml",
  "/llms/en/articles/page/0/llms.txt",
  "/_next/static/chunks/app.js",
  "/classes/bacteria.png",
  "/models/physics/kinematics/kenney-car-kit/Textures/colormap.png",
  "/open-graph/curriculum/en-merdeka.png",
  "/missing.png",
  "/_not-found/id",
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
