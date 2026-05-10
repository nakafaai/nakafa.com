import { compute } from "@repo/ai/agents/math/tools/compute";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathRequest, MathResult } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

const input = {
  expression: "6 * 7",
  kind: "math",
  operation: "evaluate",
} satisfies MathRequest;

const result = {
  conditions: [],
  input,
  items: [],
  kind: "evaluate",
  operation: "evaluate",
  primary: {
    expression: "6 * 7",
    latex: "6 \\cdot 7",
  },
  reason: "Exact arithmetic was evaluated by SymPy.",
  secondary: {
    expression: "42",
    latex: "42",
  },
  status: "verified",
} satisfies MathResult;

const provider = ConfigProvider.fromMap(
  new Map([
    ["MATH_CAS_API_KEY", "secret"],
    ["MATH_CAS_URL", "https://cas.nakafa.test"],
  ])
);

function createWriter() {
  const parts: WrittenPart[] = [];
  const writer = {
    merge: () => undefined,
    onError: undefined,
    write: (part) => {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("math compute tool", () => {
  it("writes loading and done math data parts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        toolCallId: "math-1",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("# Math Evidence");
    expect(output).toContain("- Status: verified");
    expect(parts).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          input,
          kind: "evaluate",
          status: "loading",
        }),
        id: "math-1",
        type: "data-math",
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          input,
          kind: "evaluate",
          result,
          status: "verified",
          summary: result.reason,
        }),
        id: "math-1",
        type: "data-math",
      }),
    ]);
  });

  it("writes an error data part for CAS request failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        toolCallId: "math-2",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain(
      "- Error: Unable to reach the Nakafa CAS service."
    );
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: "Unable to reach the Nakafa CAS service.",
          input,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-2",
        type: "data-math",
      })
    );
  });

  it("writes an error data part for CAS response failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ status: "verified" })
    );
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        toolCallId: "math-3",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain("is missing");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: expect.stringContaining("is missing"),
          input,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-3",
        type: "data-math",
      })
    );
  });
});
