import { compute } from "@repo/ai/agents/math/tools/compute";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathRequest } from "@repo/math/schema/request";
import type { MathResult } from "@repo/math/schema/result";
import type { MathToolInput } from "@repo/math/schema/tool-input";
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

/** Creates a stream writer harness that records math data parts for assertions. */
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
        toolCallId: "math-2",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain(
      "- Evidence scope: unavailable deterministic derivation"
    );
    expect(output).toContain("- Error code: math_check_unavailable");
    expect(output).toContain("Do not present this result as checked.");
    expect(output).toContain(
      "Compare this failed input with the original task before answering"
    );
    expect(output).toContain(
      "Retry the same operation if the task gives omitted variables"
    );
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: "math_check_unavailable",
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
        toolCallId: "math-3",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain("- Error code: math_check_unavailable");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: "math_check_unavailable",
          input: request,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-3",
        type: "data-math",
      })
    );
  });

  it("asks the model to retry ambiguous symbolic calculus with the explicit variable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { detail: "Variable is required when multiple symbols are present." },
        { status: 422 }
      )
    );
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: {
          expression: "x^(a-1) * exp(-x)",
          lower: "0",
          operation: "integrate",
          upper: "oo",
          variable: "x",
        },
        toolCallId: "math-ambiguous-variable",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain(
      "Retry the same operation with the explicit variable"
    );
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: "math_check_unavailable",
          status: "error",
        }),
      })
    );
  });

  it("returns a model-readable error before writing data for invalid tool input", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: { operation: "simplify" },
        toolCallId: "math-4",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Status: error");
    expect(output).toContain("- Error code: invalid_math_input");
    expect(output).toContain("Ask the user for the exact missing expression");
    expect(fetch).not.toHaveBeenCalled();
    expect(parts).toEqual([]);
  });

  it("tells the model how to retry bounded systems with the same bounds", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: {
          expressions: ["x^2 = 1", "y = 0"],
          lower: "0",
          lowerInclusive: false,
          operation: "solve",
          variables: ["x", "y"],
        },
        toolCallId: "math-5",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Error code: invalid_math_input");
    expect(output).toContain("Retry the same equation solve");
    expect(output).toContain("Keep the same expressions");
    expect(output).toContain("Set variable to the bounded variable");
    expect(output).toContain(
      "Set variables to the unknowns that should be solved"
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(parts).toEqual([]);
  });

  it("tells the model how to retry incomplete bounded system expressions", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: {
          expressions: ["x = 2", "y = 1"],
          lower: "0",
          operation: "solve",
          variable: "x",
          variables: ["x"],
        },
        toolCallId: "math-6",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Error code: invalid_math_input");
    expect(output).toContain("Retry the same bounded system solve");
    expect(output).toContain("Keep symbolic parameters out of variables");
    expect(output).toContain(
      "Every expression must involve at least one selected unknown"
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(parts).toEqual([]);
  });

  it("keeps invalid input errors locale-free", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input: { operation: "domain" },
        toolCallId: "math-6",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Error code: invalid_math_input");
    expect(fetch).not.toHaveBeenCalled();
    expect(parts).toEqual([]);
  });

  it("writes locale-free error data for math service failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      compute({
        input,
        toolCallId: "math-7",
        writer,
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(output).toContain("- Error code: math_check_unavailable");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          error: "math_check_unavailable",
          input: request,
          kind: "evaluate",
          status: "error",
        }),
        id: "math-7",
        type: "data-math",
      })
    );
  });
});
