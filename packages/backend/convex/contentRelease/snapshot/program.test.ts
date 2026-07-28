import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import {
  makeCurriculumSnapshotRow,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/row-hash";
import { LearningProgramSchema } from "@nakafa/aksara-contracts/program/spec";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeProgramSnapshotData,
  type ProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Selects one concrete curriculum row from the shared program fixture. */
function findCurriculum(data: ProgramSnapshotData) {
  for (const source of data.rows) {
    if (source.record.kind === "curriculum") {
      return {
        family: "program",
        record: source.record,
      } satisfies ContentSnapshotRow;
    }
  }
  throw new Error("Expected one curriculum snapshot row.");
}

describe("contentRelease/snapshot/program", () => {
  it("replays one exact row and rejects a cross-table index collision", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const [program] = data.rows;
    const curriculum = findCurriculum(data);
    if (program?.record.kind !== "program") {
      throw new Error("Expected one program snapshot row.");
    }
    const target = convexTest(schema, convexModules);
    const programJson = canonicalizeContentSnapshotRow(program);

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          stageProgramRow(ctx, data.snapshotId, 0, program, programJson)
        )
      )
    ).resolves.toBe(false);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          stageProgramRow(ctx, data.snapshotId, 0, program, programJson)
        )
      )
    ).resolves.toBe(true);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          stageProgramRow(
            ctx,
            data.snapshotId,
            0,
            curriculum,
            canonicalizeContentSnapshotRow(curriculum)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("rejects duplicate localized node identity across public paths", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const source = findCurriculum(data);
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) =>
      runConvexProgram(
        stageProgramRow(
          ctx,
          data.snapshotId,
          2,
          source,
          canonicalizeContentSnapshotRow(source)
        )
      )
    );
    const route = CurriculumRouteSchema.make({
      ...source.record.row,
      publicPath: PublicPathSchema.make(`${source.record.row.publicPath}-copy`),
    });
    const record = await Effect.runPromise(makeCurriculumSnapshotRow(route));
    const duplicate = {
      family: "program",
      record,
    } satisfies ContentSnapshotRow;

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          stageProgramRow(
            ctx,
            data.snapshotId,
            3,
            duplicate,
            canonicalizeContentSnapshotRow(duplicate)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("rejects oversized program and curriculum read-model rows", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const [program] = data.rows;
    const curriculum = findCurriculum(data);
    if (program?.record.kind !== "program") {
      throw new Error("Expected one program snapshot row.");
    }
    const source = program.record.row.sources[0];
    const oversizedProgram = LearningProgramSchema.make({
      ...program.record.row,
      sources: [
        source,
        ...Array.from({ length: 64 }, (_, index) => ({
          ...source,
          label: `Technical source ${index} ${"x".repeat(256)}`,
          url: `https://example.test/oversized-source-${index}`,
        })),
      ],
    });
    const oversizedProgramRecord = await Effect.runPromise(
      makeProgramSnapshotRow(oversizedProgram)
    );
    const oversizedProgramRow = {
      family: "program",
      record: oversizedProgramRecord,
    } satisfies ContentSnapshotRow;
    const oversizedCurriculum = CurriculumRouteSchema.make({
      ...curriculum.record.row,
      title: "x".repeat(READ_MODEL_DOCUMENT_LIMIT),
    });
    const oversizedCurriculumRecord = await Effect.runPromise(
      makeCurriculumSnapshotRow(oversizedCurriculum)
    );
    const oversizedCurriculumRow = {
      family: "program",
      record: oversizedCurriculumRecord,
    } satisfies ContentSnapshotRow;
    const target = convexTest(schema, convexModules);

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          stageProgramRow(
            ctx,
            data.snapshotId,
            0,
            oversizedProgramRow,
            canonicalizeContentSnapshotRow(oversizedProgramRow)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_SIZE" },
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          stageProgramRow(
            ctx,
            data.snapshotId,
            1,
            oversizedCurriculumRow,
            canonicalizeContentSnapshotRow(oversizedCurriculumRow)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_SIZE" },
    });
  });
});
