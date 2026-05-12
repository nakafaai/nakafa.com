import { compute } from "@repo/ai/agents/math/tools/compute";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathRequest, MathResult, MathToolInput } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

const input = {
  expression: "6 * 7",
  operation: "evaluate",
} satisfies MathToolInput;

const request = {
  ...input,
  kind: "math",
} satisfies MathRequest;

const result = {
  conditions: [],
  input: request,
  items: [],
  kind: "evaluate",
  operation: "evaluate",
  primary: {
    expression: "6 * 7",
    latex: "6 \\cdot 7",
  },
  reason: "Exact arithmetic was checked.",
  secondary: {
    expression: "42",
    latex: "42",
  },
  stepStatus: "complete",
  steps: [
    {
      action: "evaluate",
      items: [],
      primary: {
        expression: "6 * 7",
        latex: "6 \\cdot 7",
      },
      relation: {
        expression: "equals",
        latex: "=",
      },
      secondary: {
        expression: "42",
        latex: "42",
      },
    },
  ],
  status: "verified",
} satisfies MathResult;

const provider = ConfigProvider.fromMap(
  new Map([
    ["MATH_CAS_API_KEY", "secret"],
    ["NEXT_PUBLIC_CAS_URL", "https://cas.nakafa.test"],
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
        locale: "en",
        toolCallId: "math-1",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("# Checked Math Work");
    expect(output).toContain("- Status: verified");
    expect(parts).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          input: request,
          kind: "evaluate",
          status: "loading",
        }),
        id: "math-1",
        type: "data-math",
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          input: request,
          kind: "evaluate",
          result,
          status: "verified",
          summary: "verified",
        }),
        id: "math-1",
        type: "data-math",
      }),
    ]);
  });

  it("writes an error data part for math request failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        locale: "en",
        toolCallId: "math-2",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain(
      "- Error: This part could not be checked right now. Please try again with the expression or data written clearly."
    );
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error:
            "This part could not be checked right now. Please try again with the expression or data written clearly.",
          input: request,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-2",
        type: "data-math",
      })
    );
  });

  it("writes an error data part for math response failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ status: "verified" })
    );
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        locale: "en",
        toolCallId: "math-3",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain(
      "This part could not be checked right now. Please try again"
    );
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: expect.stringContaining("could not be checked"),
          input: request,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-3",
        type: "data-math",
      })
    );
  });

  it("returns a safe message before writing data for invalid tool input", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: { operation: "simplify" },
        locale: "en",
        toolCallId: "math-4",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain("I need the math expression or data");
    expect(fetch).not.toHaveBeenCalled();
    expect(parts).toEqual([]);
  });

  it("returns a safe Indonesian message for invalid tool input", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: { operation: "domain" },
        locale: "id",
        toolCallId: "math-5",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("Aku perlu ekspresi atau data matematikanya");
    expect(fetch).not.toHaveBeenCalled();
    expect(parts).toEqual([]);
  });

  it("writes a safe Indonesian error for math service failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        locale: "id",
        toolCallId: "math-6",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("Bagian ini belum bisa dicek sekarang");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error:
            "Bagian ini belum bisa dicek sekarang. Coba tulis ekspresi atau datanya dengan lebih jelas.",
          input: request,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-6",
        type: "data-math",
      })
    );
  });
});
