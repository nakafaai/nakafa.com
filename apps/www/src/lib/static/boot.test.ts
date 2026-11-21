// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { BOOT_CHUNK_BYTES, readBootProblems } from "@/lib/static/boot";

const ROUTER = "/node_modules/@tanstack/router-core/dist/esm/router.js";

describe("readBootProblems", () => {
  it("accepts a boot chunk within its bytes that holds no island module", () => {
    expect(
      readBootProblems(
        {
          code: "x".repeat(BOOT_CHUNK_BYTES),
          moduleIds: [ROUTER],
        },
        []
      )
    ).toStrictEqual([]);
  });

  it("refuses a boot chunk over its bytes", () => {
    const problems = readBootProblems(
      {
        code: "x".repeat(BOOT_CHUNK_BYTES + 1),
        moduleIds: [ROUTER],
      },
      []
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${BOOT_CHUNK_BYTES + 1} bytes`);
  });

  it("counts the chunk's bytes as UTF-8, as the browser downloads them", () => {
    const problems = readBootProblems(
      {
        code: "\u00e9".repeat(BOOT_CHUNK_BYTES / 2 + 1),
        moduleIds: [ROUTER],
      },
      []
    );
    expect(problems[0]).toContain(`${BOOT_CHUNK_BYTES + 2} bytes`);
  });

  it("names each phase of the browser entry that the boot chunk does not hold", () => {
    const settle = "/packages/design-system/lib/settle.ts";
    const problems = readBootProblems({ code: "", moduleIds: [ROUTER] }, [
      ROUTER,
      settle,
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(settle);
  });

  it("names each island module the boot chunk holds", () => {
    const sync = "/node_modules/convex/dist/esm/browser/sync/client.js";
    const react = "/node_modules/@confect/react/dist/index.js";
    const problems = readBootProblems(
      {
        code: "",
        moduleIds: [ROUTER, sync, react],
      },
      []
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(sync);
    expect(problems[1]).toContain(react);
  });
});
