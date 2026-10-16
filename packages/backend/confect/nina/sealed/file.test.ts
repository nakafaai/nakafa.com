import { storeFile } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { fileFailureIn, readFileIn } from "@repo/backend/test/nina/sealed";

describe("reading a stored file through the sealed module", () => {
  it("reads a file with the name it was stored under, which is the name the model reads", async () => {
    const t = createConvexTestWithBetterAuth();
    const fileId = await t.action(
      async (ctx) =>
        (
          await storeFile(
            ctx,
            components.nina,
            new Blob(["Soal"], { type: "application/pdf" }),
            { filename: "Soal-Latihan.pdf" }
          )
        ).file.fileId
    );
    const saved = await readFileIn(t, fileId);
    expect(saved).toEqual({
      filePart: {
        filename: "Soal-Latihan.pdf",
        mediaType: "application/pdf",
        type: "file",
      },
      filename: "Soal-Latihan.pdf",
    });
  });

  it("fails with a sealed read error for a file the component does not hold", async () => {
    const t = createConvexTestWithBetterAuth();
    const failure = await fileFailureIn(t, "missing-file");
    expect(failure).toBe("SealedReadError");
  });
});
