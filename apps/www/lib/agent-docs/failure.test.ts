import type { CheckResult } from "afdocs";
import { describe, expect, it } from "vitest";
import { formatAgentDocsFailure } from "@/lib/agent-docs/failure";

const createResult = (details?: CheckResult["details"]): CheckResult => ({
  category: "observability",
  details,
  id: "markdown-content-parity",
  message: "One page differs",
  status: "warn",
});

describe("formatAgentDocsFailure", () => {
  it("names bounded page offenders without copying response content", () => {
    const output = formatAgentDocsFailure(
      createResult({
        pageResults: [
          {
            url: "https://nakafa.com/en",
            status: "warn",
            missingPercent: 7,
            body: "private-response-content",
            sampleDiffs: ["private-markdown-content"],
          },
        ],
      })
    );

    expect(output).toContain('url="https://nakafa.com/en"');
    expect(output).toContain('status="warn"');
    expect(output).toContain("missingPercent=7");
    expect(output).not.toContain("private-response-content");
    expect(output).not.toContain("private-markdown-content");
  });

  it("limits detail output to five items", () => {
    const output = formatAgentDocsFailure(
      createResult({
        broken: Array.from({ length: 8 }, (_, index) => ({
          url: `https://nakafa.com/broken-${index}`,
          status: 404,
        })),
      })
    );

    expect(output).toContain("broken-0");
    expect(output).toContain("broken-4");
    expect(output).not.toContain("broken-5");
  });

  it("prioritizes offenders over earlier passing page results", () => {
    const output = formatAgentDocsFailure(
      createResult({
        pageResults: [
          ...Array.from({ length: 5 }, (_, index) => ({
            url: `https://nakafa.com/passing-${index}`,
            status: "pass",
            missingPercent: 0,
          })),
          {
            url: "https://nakafa.com/offender",
            status: "warn",
            missingPercent: 8,
          },
        ],
      })
    );

    expect(output).toContain('url="https://nakafa.com/offender"');
    expect(output).toContain('status="warn"');
    expect(output).toContain("missingPercent=8");
    expect(output).not.toContain("passing-4");
  });

  it("prioritizes a missing-content measurement without a status", () => {
    const output = formatAgentDocsFailure(
      createResult({
        pageResults: [
          { url: "https://nakafa.com/equivalent", missingPercent: 0 },
          { url: "https://nakafa.com/missing", missingPercent: 8 },
        ],
      })
    );

    expect(output.indexOf("/missing")).toBeLessThan(
      output.indexOf("/equivalent")
    );
  });

  it("returns only the summary when no structured offender exists", () => {
    expect(formatAgentDocsFailure(createResult())).toBe(
      "[warn] One page differs"
    );
  });

  it("ignores malformed items and bounds diagnostic strings", () => {
    const longError = "x".repeat(200);
    const output = formatAgentDocsFailure(
      createResult({
        pageResults: [
          "invalid",
          null,
          [],
          {},
          { url: "https://nakafa.com/en", status: false, error: longError },
        ],
      })
    );

    expect(output).toContain("status=false");
    expect(output).toContain(`error="${"x".repeat(160)}"`);
    expect(output).not.toContain(longError);
  });
});
