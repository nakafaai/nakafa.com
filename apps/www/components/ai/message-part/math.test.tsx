import type { DataPart } from "@repo/ai/schema/data";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MathPart } from "@/components/ai/message-part/math";

const mathCopy = vi.hoisted(
  (): Record<string, string> => ({
    "math-error": "Lengkapi soalnya, lalu coba lagi.",
    "math-loading": "Lagi mengecek hitungannya...",
    "math-solve": "Menyelesaikan",
  })
);

const disclosureState = vi.hoisted(() => ({ expanded: false }));

vi.mock("@mantine/hooks", () => ({
  useDisclosure: () => [disclosureState.expanded, { set: vi.fn() }],
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => mathCopy[key] ?? key,
}));

vi.mock("@repo/design-system/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { readonly children: ReactNode }) => (
    <div data-expanded={String(disclosureState.expanded)}>{children}</div>
  ),
  CollapsibleContent: ({ children }: { readonly children: ReactNode }) => (
    <section>{children}</section>
  ),
  CollapsibleTrigger: ({ children }: { readonly children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@repo/design-system/components/ui/huge-icons", () => ({
  HugeIcons: () => <span data-testid="math-icon" />,
}));

vi.mock("@/components/ai/message-part/math/evidence", () => ({
  MathEvidence: () => null,
}));

vi.mock("@/components/ai/message-part/math/pedagogy", () => ({
  MathPedagogy: () => null,
}));

vi.mock("@/components/ai/message-part/math/icons", () => ({
  getMathIcon: () => "math-icon",
}));

describe("MathPart", () => {
  it("renders math errors as one non-collapsible learner sentence", () => {
    disclosureState.expanded = false;
    const markup = renderMathPart(errorMathReasoningPart());

    expect(countOccurrences(markup, "Lengkapi soalnya, lalu coba lagi.")).toBe(
      1
    );
    expect(markup).not.toContain("Bagian ini belum bisa dicek");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("aria-expanded");
    expect(markup).not.toContain("<svg");
  });

  it("renders loading math as a collapsible work row", () => {
    disclosureState.expanded = false;
    const markup = renderMathPart(loadingMathReasoningPart());

    expect(markup).toContain("Lagi mengecek hitungannya...");
    expect(markup).toContain("<button");
    expect(markup).toContain('data-expanded="false"');
  });

  it("renders completed math as a collapsible operation row", () => {
    disclosureState.expanded = true;
    const markup = renderMathPart(doneMathReasoningPart());

    expect(markup).toContain("Menyelesaikan");
    expect(markup).toContain("<button");
    expect(markup).toContain('data-expanded="true"');
  });
});

/** Renders MathPart with the localized copy hook mocked at the UI boundary. */
function renderMathPart(message: DataPart["math-reasoning"]) {
  return renderToStaticMarkup(<MathPart message={message} />);
}

/** Counts exact text occurrences in server-rendered markup. */
function countOccurrences(value: string, needle: string) {
  return value.split(needle).length - 1;
}

/** Builds a compact MathReasoning error part for UI projection tests. */
function errorMathReasoningPart(): DataPart["math-reasoning"] {
  return {
    errorKey: "math-error",
    input: {
      givens: [],
      objective: "Solve the equation.",
      request: "solve",
      requirements: [],
    },
    status: "error",
  };
}

/** Builds a loading MathReasoning part for non-error branch coverage. */
function loadingMathReasoningPart(): DataPart["math-reasoning"] {
  return {
    input: {
      givens: [],
      objective: "Solve the equation.",
      request: "solve",
      requirements: [],
    },
    status: "loading",
  };
}

/** Builds a minimal completed MathReasoning part for operation-title rendering. */
function doneMathReasoningPart(): DataPart["math-reasoning"] {
  return {
    result: {
      artifacts: [],
      steps: [],
      work: {
        assumptions: [],
        computations: [],
        input: {
          givens: ["x = 2"],
          kind: "prompt",
          locale: "id",
          objective: "Solve",
          text: "solve x = 2",
        },
        limitations: [],
        plannedRequest: {
          expression: "x = 2",
          kind: "math",
          operation: "solve",
          variable: "x",
        },
        primaryResult: {
          expression: "x = 2",
          latex: "x = 2",
        },
        status: "ready",
        verification: {
          engine: "sympy",
          lane: "verified",
          reasonKey: "math-verification-verified",
          source: "cas.solve",
          values: [],
        },
        workId: "math:solve:test",
      },
    },
    status: "done",
  };
}
