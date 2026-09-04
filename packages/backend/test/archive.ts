import { createHash } from "node:crypto";
import { CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE } from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
} from "@repo/backend/content/endpoint";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";

declare const Convex: {
  readonly asyncSyscall: (operation: string, input: string) => Promise<string>;
};

export const ARCHIVE_TOKEN = "technical-archive-token";
export const RUNTIME_TOKEN = "technical-runtime-token";
export type ArchiveTest = ReturnType<typeof createConvexTestWithBetterAuth>;

export function setEnvironment() {
  process.env.CONTENT_ARCHIVE_TOKEN = ARCHIVE_TOKEN;
  process.env.CONTENT_RUNTIME_TOKEN = RUNTIME_TOKEN;
  process.env.POLAR_WEBHOOK_SECRET = "technical-webhook-secret";
}

export function clearEnvironment() {
  delete process.env.CONTENT_ARCHIVE_TOKEN;
  delete process.env.CONTENT_RUNTIME_TOKEN;
  delete process.env.POLAR_WEBHOOK_SECRET;
}

export function identity(index: number) {
  return {
    runtimeSelectionHash: index.toString(16).padStart(64, "0"),
    runtimeSchemaFingerprint: "f".repeat(64),
  };
}

export function sourceHash(index: number) {
  return (index + 1000).toString(16).padStart(64, "0");
}

export function claimId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function post(
  target: ArchiveTest,
  path: string,
  body: BodyInit | null,
  access: "read" | "write",
  contentType = "application/json"
) {
  return target.fetch(path, {
    body,
    headers: {
      "content-type": contentType,
      [access === "read" ? "x-nakafa-content-token" : "x-nakafa-archive-token"]:
        access === "read" ? RUNTIME_TOKEN : ARCHIVE_TOKEN,
    },
    method: "POST",
  });
}

export function write(target: ArchiveTest, path: string, body: unknown) {
  return post(target, path, JSON.stringify(body), "write");
}

export function claim(target: ArchiveTest, index: number) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, {
    ...identity(index),
    claimId: claimId(index),
  });
}

export function finalize(
  target: ArchiveTest,
  index: number,
  storageId: string,
  value: string,
  overrides: Record<string, unknown> = {}
) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH, {
    ...identity(index),
    archiveSha256: hash(value),
    byteLength: Buffer.byteLength(value),
    claimId: claimId(index),
    sourceStateHash: sourceHash(index),
    storageId,
    ...overrides,
  });
}

export function abort(target: ArchiveTest, index: number, storageId: string) {
  return write(target, CONTENT_RUNTIME_ARCHIVE_ABORT_PATH, {
    ...identity(index),
    claimId: claimId(index),
    storageId,
  });
}

/** Seeds official hex and MIME metadata around convex-test's legacy fake. */
export function storeArchiveFixture(
  target: ArchiveTest,
  value: string,
  contentType = CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE
) {
  return target.run(async () => {
    const source = await Convex.asyncSyscall(
      "1.0/insert",
      JSON.stringify({
        table: "_storage",
        value: {
          contentType,
          sha256: createHash("sha256").update(value).digest("hex"),
          size: Buffer.byteLength(value),
        },
      })
    );
    const result = JSON.parse(source) as { readonly _id: Id<"_storage"> };
    return result._id;
  });
}

export function insert(
  target: ArchiveTest,
  index: number,
  storageId: Id<"_storage">,
  value: string,
  overrides: {
    readonly archiveSha256?: string;
    readonly byteLength?: number;
  } = {}
) {
  return target.run((ctx) =>
    ctx.db.insert("contentRuntimeArchives", {
      ...identity(index),
      archiveSha256: overrides.archiveSha256 ?? hash(value),
      byteLength: overrides.byteLength ?? Buffer.byteLength(value),
      createdAt: Date.now(),
      sourceStateHash: sourceHash(index),
      storageId,
    })
  );
}

export function read(target: ArchiveTest, index: number) {
  const archiveIdentity = identity(index);
  return target.run((ctx) =>
    ctx.db
      .query("contentRuntimeArchives")
      .withIndex(
        "by_runtimeSelectionHash_and_runtimeSchemaFingerprint",
        (query) =>
          query
            .eq("runtimeSelectionHash", archiveIdentity.runtimeSelectionHash)
            .eq(
              "runtimeSchemaFingerprint",
              archiveIdentity.runtimeSchemaFingerprint
            )
      )
      .unique()
  );
}
