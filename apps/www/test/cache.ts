import {
  ContentCacheRequestSchema,
  makeArtifactCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { encodeJsonText } from "@repo/utilities/json";
import { Schema } from "effect";

/** The release that the cache route tests activate. */
export const releaseId = ReleaseIdSchema.make("release-cache-test");

/** Encodes one cache request as the publisher sends it. */
const encodeCacheRequest = Schema.encodeSync(
  Schema.fromJsonString(ContentCacheRequestSchema)
);

const artifactTag = makeArtifactCacheTag(
  Sha256HashSchema.make(`sha256:${"a".repeat(64)}`)
);

/** Bodies that the cache route refuses, with their headers and the status that answers each. */
export const invalidBodies = [
  ["{", { "Content-Type": "application/json" }, 400],
  [
    encodeJsonText({
      extra: true,
      scope: "material",
      releaseId,
    }),
    { "Content-Type": "application/json" },
    400,
  ],
  [
    encodeJsonText({
      scope: "material",
      releaseId,
      tags: ["unknown"],
    }),
    { "Content-Type": "application/json" },
    400,
  ],
  [
    encodeJsonText({
      releaseId,
      scope: "material",
      tags: ["content-family:material", "content-runtime"],
    }),
    { "Content-Type": "application/json" },
    400,
  ],
  [
    encodeJsonText({
      releaseId,
      scope: "material",
      tags: [
        "content-runtime",
        "content-family:material",
        ...Array.from({ length: 99 }, () => artifactTag),
      ],
    }),
    { "Content-Type": "application/json" },
    400,
  ],
  [
    encodeCacheRequest({
      scope: "material",
      releaseId,
    }),
    { "Content-Type": "text/plain" },
    415,
  ],
  [
    encodeCacheRequest({
      scope: "material",
      releaseId,
    }),
    {},
    415,
  ],
  [new Uint8Array(), { "Content-Type": "application/json" }, 400],
  ["{}", { "Content-Length": "invalid" }, 413],
  ["{}", { "Content-Length": "-1" }, 413],
  ["{}", { "Content-Length": "9".repeat(400) }, 413],
  ["{}", { "Content-Length": String(32 * 1024 + 1) }, 413],
  ["{}", { "Content-Length": "3", "Content-Type": "application/json" }, 400],
  [new Uint8Array([255]), { "Content-Type": "application/json" }, 400],
  ["x".repeat(32 * 1024 + 1), { "Content-Type": "application/json" }, 413],
] as const;
