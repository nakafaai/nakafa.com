import { storeFile } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  fileFailureIn,
  learnerWithKeyIn,
  readFileIn,
  sealedFileNameIn,
} from "@repo/backend/test/nina/sealed";

/** A name that the tests seal, so one search finds any copy of it. */
const PLANT = "PLANT-Soal-Rahasia.pdf";

/** Stores one file under `filename` from an action, as the upload does, and returns its id. */
function storeNamed(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  filename: string
) {
  return t.action(
    async (ctx) =>
      (
        await storeFile(
          ctx,
          components.nina,
          new Blob(["Soal"], { type: "application/pdf" }),
          { filename }
        )
      ).file.fileId
  );
}

describe("reading a stored file through the sealed module", () => {
  it("reads a file stored under a plain name with the name it was stored under", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await storeNamed(t, "Soal-Latihan.pdf");
    const saved = await readFileIn(t, owner, fileId, false);
    expect(saved).toEqual({
      filePart: {
        filename: "Soal-Latihan.pdf",
        mediaType: "application/pdf",
        type: "file",
      },
      filename: "Soal-Latihan.pdf",
    });
  });

  it("reads a plain name that begins with the sealed prefix as it is, because its upload did not seal it", async () => {
    // A name stored before sealing can begin with the prefix, so only the upload decides.
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await storeNamed(t, "nakafa.sealed.v1:abcd");
    expect(await readFileIn(t, owner, fileId, false)).toEqual({
      filePart: {
        filename: "nakafa.sealed.v1:abcd",
        mediaType: "application/pdf",
        type: "file",
      },
      filename: "nakafa.sealed.v1:abcd",
    });
  });

  it("opens the sealed name of a file for the learner who stored it, and keeps the sealed name out of the component", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const storedName = await sealedFileNameIn(t, owner, PLANT);
    const fileId = await storeNamed(t, storedName);

    expect(await readFileIn(t, owner, fileId, true)).toEqual({
      filePart: {
        filename: PLANT,
        mediaType: "application/pdf",
        type: "file",
      },
      filename: PLANT,
    });
    const stored = await t.query((ctx) =>
      ctx.runQuery(components.nina.files.get, { fileId })
    );
    expect(stored?.filename).toBe(storedName);
    expect(stored?.filename).not.toContain(PLANT);
  });

  it("stores one learner's sealed name twice as one file, so the Agent reuses it", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const storedName = await sealedFileNameIn(t, owner, PLANT);
    const first = await storeNamed(t, storedName);
    expect(await storeNamed(t, storedName)).toBe(first);
  });

  it("stores two learners' sealed names for one file as two files, so the Agent never shares a file between them", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const other = await learnerWithKeyIn(t, "other");
    const first = await storeNamed(t, await sealedFileNameIn(t, owner, PLANT));
    const second = await storeNamed(t, await sealedFileNameIn(t, other, PLANT));
    expect(second).not.toBe(first);
  });

  it("fails with a vault cipher error for a sealed name that another learner holds", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const other = await learnerWithKeyIn(t, "other");
    const fileId = await storeNamed(t, await sealedFileNameIn(t, owner, PLANT));

    expect(await fileFailureIn(t, other, fileId, true)).toEqual({
      reason: "cipher",
      tag: "VaultError",
    });
  });

  it("fails with a vault cipher error for a sealed name that is not valid", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await storeNamed(t, "nakafa.sealed.v1:!!not-base64");

    expect(await fileFailureIn(t, owner, fileId, true)).toEqual({
      reason: "cipher",
      tag: "VaultError",
    });
  });

  it("fails with a vault cipher error for a sealed name that has no prefix", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await storeNamed(t, "Soal-Latihan.pdf");

    expect(await fileFailureIn(t, owner, fileId, true)).toEqual({
      reason: "cipher",
      tag: "VaultError",
    });
  });

  it("reads a file stored without a name as a part without a name", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await t.action(
      async (ctx) =>
        (
          await storeFile(
            ctx,
            components.nina,
            new Blob(["Soal"], { type: "application/pdf" })
          )
        ).file.fileId
    );
    const saved = await readFileIn(t, owner, fileId, true);
    expect(saved.filename).toBeUndefined();
    expect(saved.filePart.filename).toBeUndefined();
  });

  it("fails with a sealed read error for a file the component does not hold", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    expect(await fileFailureIn(t, owner, "missing-file", false)).toEqual({
      reason: undefined,
      tag: "SealedReadError",
    });
  });
});
