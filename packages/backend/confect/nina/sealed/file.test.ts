import { RegisteredConvexFunction } from "@confect/server";
import { storeFile } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { sealFileName } from "@repo/backend/confect/nina/sealed/file";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import {
  fileFailureIn,
  learnerWithKeyIn,
  readFileIn,
} from "@repo/backend/test/nina/sealed";
import { Effect } from "effect";

/** A name that the tests seal, so one search finds any copy of it. */
const PLANT = "PLANT-Soal-Rahasia.pdf";

/** The sealed name of one learner for `name`, as the upload seals it before it stores the file. */
function sealedNameIn(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  owner: Parameters<typeof ensureLearnerKeys>[0],
  name: string
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      ensureLearnerKeys(owner).pipe(
        Effect.flatMap((keys) => sealFileName(keys, name)),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

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
    const saved = await readFileIn(t, owner, fileId);
    expect(saved).toEqual({
      filePart: {
        filename: "Soal-Latihan.pdf",
        mediaType: "application/pdf",
        type: "file",
      },
      filename: "Soal-Latihan.pdf",
    });
  });

  it("opens the sealed name of a file for the learner who stored it, and keeps the sealed name out of the component", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const storedName = await sealedNameIn(t, owner, PLANT);
    const fileId = await storeNamed(t, storedName);

    expect(await readFileIn(t, owner, fileId)).toEqual({
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

  it("seals a name the same way for the same learner, so the Agent reuses that learner's file", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    expect(await sealedNameIn(t, owner, PLANT)).toBe(
      await sealedNameIn(t, owner, PLANT)
    );
  });

  it("gives two learners different names for the same file, so no file is shared between them", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const other = await learnerWithKeyIn(t, "other");
    expect(await sealedNameIn(t, owner, PLANT)).not.toBe(
      await sealedNameIn(t, other, PLANT)
    );
  });

  it("fails with a vault cipher error for a sealed name that another learner holds", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const other = await learnerWithKeyIn(t, "other");
    const fileId = await storeNamed(t, await sealedNameIn(t, owner, PLANT));

    expect(await fileFailureIn(t, other, fileId)).toEqual({
      reason: "cipher",
      tag: "VaultError",
    });
  });

  it("fails with a vault cipher error for a sealed name that is not valid", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    const fileId = await storeNamed(t, "nakafa.sealed.v1:!!not-base64");

    expect(await fileFailureIn(t, owner, fileId)).toEqual({
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
    const saved = await readFileIn(t, owner, fileId);
    expect(saved.filename).toBeUndefined();
    expect(saved.filePart.filename).toBeUndefined();
  });

  it("fails with a sealed read error for a file the component does not hold", async () => {
    const t = createConvexTestWithBetterAuth();
    const owner = await learnerWithKeyIn(t, "owner");
    expect(await fileFailureIn(t, owner, "missing-file")).toEqual({
      reason: undefined,
      tag: "SealedReadError",
    });
  });
});
