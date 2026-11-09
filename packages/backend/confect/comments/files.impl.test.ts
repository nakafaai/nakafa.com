import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
// convex-test imports a function's module, and the Better Auth module behind a signed write, on the first
// call, inside that test's 5 s, and the cold graph takes longer. Importing them here loads them while the
// file is collected, so no test pays it.
import "@repo/backend/components/betterAuth/session";
import "@repo/backend/convex/bucket";
import "@repo/backend/convex/comments/files";
import "@repo/backend/convex/comments/mutations";
import "@repo/backend/convex/comments/queries";
import { COMMENT_PHOTO_BYTE_LIMIT } from "@repo/backend/confect/comments/photo";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { makeBucket, stubBucket, upload } from "@repo/backend/test/bucket";
import { PDF, PNG } from "@repo/backend/test/library";

const NOW = Date.UTC(2026, 10, 8, 9, 0, 0);
const { sweep } = internal.comments.files;
const files = api.comments.files;
const paginationOpts = { cursor: null, numItems: 20 };

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

/** The leading bytes of a GIF, which keeps its frames and has no small copy. */
const GIF = new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000");

/** A PNG padded with zeros to `extra` more bytes, which passes for an image of that size. */
function paddedPng(extra: number) {
  const bytes = new Uint8Array(PNG.byteLength + extra);
  bytes.set(PNG);
  return bytes;
}

/** Two learners, both signed in, with the clients that act as each of them. */
async function learners() {
  const t = createConvexTestWithBetterAuth();
  const [author, other] = await t.mutation((ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "photo-author" }),
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "photo-other" }),
    ])
  );
  const as = (user: typeof author) =>
    t.withIdentity({ sessionId: user.sessionId, subject: user.authUserId });
  return { author: as(author), other: as(other), t };
}

/** A learner's client, as `learners` answers it. */
type Learner = Awaited<ReturnType<typeof learners>>["author"];

/**
 * Reserves one file as the learner and uploads its bytes as the browser does, answering the file's ID. A
 * smaller `declared` size stands for bytes past the length the address binds, which only the server's own
 * reading of the stored file can catch.
 */
async function uploaded(
  learner: Learner,
  bytes: Uint8Array,
  declared = bytes.byteLength
) {
  const reserved = await learner.mutation(files.reserve, {
    byteSize: declared,
    contentType: "image/png",
  });
  upload(bucket, reserved.address, bytes);
  return reserved.fileId;
}

/** Uploads and registers one photo with its small copy, answering the upload. */
async function photo(learner: Learner) {
  const fileId = await uploaded(learner, PNG);
  const thumbnailId = await uploaded(learner, PNG);
  return learner.action(files.register, {
    fileId,
    height: 600,
    thumbnailId,
    width: 800,
  });
}

describe("comments/files", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("posts photos with their sizes and addresses, and deletes their files with the comment", async () => {
    const { author, t } = await learners();
    const first = await photo(author);
    const gifId = await uploaded(author, GIF);
    const gif = await author.action(files.register, {
      fileId: gifId,
      height: 1,
      thumbnailId: null,
      width: 1,
    });
    const slug = "articles/photos";
    const commentId = await author.mutation(api.comments.mutations.addComment, {
      slug,
      text: "",
      uploads: [first, gif],
    });
    const page = await t.query(api.comments.queries.getCommentsBySlug, {
      paginationOpts,
      slug,
      sort: "newest",
    });
    const [shown, moving] = page.page[0]?.photos ?? [];
    expect(shown).toEqual({
      address: expect.any(String),
      height: 600,
      thumbnail: expect.any(String),
      width: 800,
    });
    expect(shown?.thumbnail).not.toBe(shown?.address);
    expect(moving?.thumbnail).toBe(moving?.address);
    expect(
      await t.query((ctx) => ctx.db.query("commentUploads").collect())
    ).toEqual([]);
    await author.mutation(api.comments.mutations.editComment, {
      commentId,
      text: "",
    });
    await author.mutation(api.comments.mutations.deleteComment, { commentId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.query((ctx) => ctx.db.query("bucketFiles").collect())
    ).toEqual([]);
    expect(bucket.state.objects).toEqual({});
  });

  it("refuses a file that is no image, bytes that never arrived, and a file past the limit, and deletes them", async () => {
    const { author, t } = await learners();
    const pdf = await uploaded(author, PDF);
    await expect(
      author.action(files.register, {
        fileId: pdf,
        height: 10,
        thumbnailId: null,
        width: 10,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_REFUSED" } });
    const fileId = await uploaded(author, PNG);
    const fake = await uploaded(author, PDF);
    await expect(
      author.action(files.register, {
        fileId,
        height: 10,
        thumbnailId: fake,
        width: 10,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_REFUSED" } });
    const lost = await author.mutation(files.reserve, {
      byteSize: PNG.byteLength,
      contentType: "image/png",
    });
    await expect(
      author.action(files.register, {
        fileId: await uploaded(author, PNG),
        height: 10,
        thumbnailId: lost.fileId,
        width: 10,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_REFUSED" } });
    const missing = await author.mutation(files.reserve, {
      byteSize: PNG.byteLength,
      contentType: "image/png",
    });
    await expect(
      author.action(files.register, {
        fileId: missing.fileId,
        height: 10,
        thumbnailId: null,
        width: 10,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_REFUSED" } });
    await expect(
      author.mutation(files.reserve, {
        byteSize: COMMENT_PHOTO_BYTE_LIMIT + 1,
        contentType: "image/png",
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_TOO_LARGE" } });
    const oversized = await uploaded(
      author,
      paddedPng(COMMENT_PHOTO_BYTE_LIMIT),
      PNG.byteLength
    );
    await expect(
      author.action(files.register, {
        fileId: oversized,
        height: 10,
        thumbnailId: null,
        width: 10,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_TOO_LARGE" } });
    const large = await uploaded(author, PNG);
    const largeCopy = await uploaded(author, paddedPng(300 * 1024));
    await expect(
      author.action(files.register, {
        fileId: large,
        height: 10,
        thumbnailId: largeCopy,
        width: 10,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_PHOTO_TOO_LARGE" } });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.query((ctx) => ctx.db.query("bucketFiles").collect())
    ).toEqual([]);
  });

  it("takes back a learner's own photo, and refuses another learner's photo in a withdrawal or a post", async () => {
    const { author, other, t } = await learners();
    const kept = await photo(author);
    await expect(
      other.mutation(files.withdraw, { uploadId: kept })
    ).rejects.toMatchObject({ data: { code: "COMMENT_UPLOAD_GONE" } });
    await expect(
      other.mutation(api.comments.mutations.addComment, {
        slug: "articles/theft",
        text: "Mine now",
        uploads: [kept],
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_UPLOAD_GONE" } });
    await author.mutation(files.withdraw, { uploadId: kept });
    expect(
      await t.query((ctx) => ctx.db.query("commentUploads").collect())
    ).toEqual([]);
  });

  it("deletes the photos that stay unposted past a day", async () => {
    const { author, t } = await learners();
    await photo(author);
    expect(await t.mutation(sweep, {})).toEqual({ deleted: 0 });
    vi.setSystemTime(NOW + 25 * 60 * 60 * 1000);
    expect(await t.mutation(sweep, {})).toEqual({ deleted: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.query((ctx) => ctx.db.query("bucketFiles").collect())
    ).toEqual([]);
  });

  it("refuses a learner's files past the limit of a minute", async () => {
    const { author } = await learners();
    const reserve = () =>
      author.mutation(files.reserve, {
        byteSize: PNG.byteLength,
        contentType: "image/png",
      });
    for (let count = 0; count < 24; count += 1) {
      await reserve();
    }
    await expect(reserve()).rejects.toMatchObject({
      data: { code: "COMMENT_RATE_LIMITED" },
    });
  });
});
