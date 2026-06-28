// @vitest-environment node
import {
  normalizeMermaidChart,
  readMermaidMetadata,
} from "@repo/design-system/lib/mermaid";
import { describe, expect, it } from "vitest";

describe("readMermaidMetadata", () => {
  it("uses distinct fallback copy when metadata is missing", () => {
    expect(readMermaidMetadata()).toEqual({
      description: "Key ideas shown visually.",
      title: "Diagram",
    });
  });

  it("preserves complete Mermaid metadata", () => {
    expect(
      readMermaidMetadata(
        'title="Alur Fotosintesis" description="Dari cahaya sampai glukosa"'
      )
    ).toEqual({
      description: "Dari cahaya sampai glukosa",
      title: "Alur Fotosintesis",
    });
  });

  it("fills only the missing field when metadata is partial", () => {
    expect(readMermaidMetadata('title="Siklus Air"')).toEqual({
      description: "Key ideas shown visually.",
      title: "Siklus Air",
    });

    expect(
      readMermaidMetadata('description="Dari awan kembali ke laut"')
    ).toEqual({
      description: "Dari awan kembali ke laut",
      title: "Diagram",
    });
  });

  it("quotes flowchart labels with math notation", () => {
    const chart = String.raw`graph TD
A[Cahaya Matahari] --> B[Klorofil]
B --> C[Reaksi Terang: \\(H_2O\\) + Cahaya -> \\(O_2\\) + Energi]`;

    expect(normalizeMermaidChart(chart)).toBe(`graph TD
A["Cahaya Matahari"] --> B["Klorofil"]
B --> C["Reaksi Terang: $$H_2O$$ + Cahaya -> $$O_2$$ + Energi"]`);
  });

  it("quotes rounded flowchart labels with Markdown math", () => {
    const chart = String.raw`graph LR
A(Cahaya + \\(CO_2\\)) --> B(Glukosa)`;

    expect(normalizeMermaidChart(chart)).toBe(`graph LR
A("Cahaya + $$CO_2$$") --> B("Glukosa")`);
  });

  it("preserves Mermaid node shapes while normalizing labels", () => {
    const chart = `graph LR
A(["Adsorption"]) --> B[(Database)]
B --> C[[Subroutine]]
C --> D((Circle))
D --> E[Plain label]
E --> F(Rounded label)`;

    expect(normalizeMermaidChart(chart)).toBe(`graph LR
A(["Adsorption"]) --> B[(Database)]
B --> C[[Subroutine]]
C --> D((Circle))
D --> E["Plain label"]
E --> F("Rounded label")`);
  });

  it("preserves already quoted flowchart labels", () => {
    expect(normalizeMermaidChart('graph TD\nA["Already safe"]')).toBe(
      'graph TD\nA["Already safe"]'
    );
  });

  it("converts Markdown math inside quoted labels to Mermaid math", () => {
    const chart = String.raw`graph TD
A["Glukosa - \\(C_6H_{12}O_6\\)"]`;

    expect(normalizeMermaidChart(chart)).toBe(
      'graph TD\nA["Glukosa - $$C_6H_{12}O_6$$"]'
    );
  });

  it("keeps Mermaid math delimiters unchanged", () => {
    expect(
      normalizeMermaidChart('graph TD\nA["Glukosa - $$C_6H_{12}O_6$$"]')
    ).toBe('graph TD\nA["Glukosa - $$C_6H_{12}O_6$$"]');
  });

  it("converts single-dollar math in flowchart labels", () => {
    const chart = "graph TD\nA[Karbon dioksida - $CO_2$]";

    expect(normalizeMermaidChart(chart)).toBe(
      'graph TD\nA["Karbon dioksida - $$CO_2$$"]'
    );
  });

  it("keeps currency-like single-dollar text unchanged", () => {
    const chart = "graph TD\nA[Harga $15,00$]";

    expect(normalizeMermaidChart(chart)).toBe('graph TD\nA["Harga $15,00$"]');
  });

  it("quotes flowchart edge labels that contain math", () => {
    const chart = String.raw`graph LR
A -->|\\(H_2O\\)| B`;

    expect(normalizeMermaidChart(chart)).toBe('graph LR\nA -->|"$$H_2O$$"| B');
  });

  it("normalizes Mermaid math in sequence diagrams without flowchart quoting", () => {
    const chart = [
      "sequenceDiagram",
      String.raw`participant 1 as \\(\alpha\\)`,
      "1->>2: Solve `\\\\(x^2\\\\)`",
    ].join("\n");

    expect(normalizeMermaidChart(chart)).toBe(`sequenceDiagram
participant 1 as $$\\alpha$$
1->>2: Solve $$x^2$$`);
  });

  it("normalizes other LLM math delimiter variants in Mermaid text", () => {
    const chart = [
      "sequenceDiagram",
      String.raw`1->>2: Area \[x^2\]`,
      "2-->>1: Already `$$y^2$$`, inline `$z^2$`, and empty $ $",
    ].join("\n");

    expect(normalizeMermaidChart(chart)).toBe(
      [
        "sequenceDiagram",
        "1->>2: Area $$x^2$$",
        "2-->>1: Already $$y^2$$, inline $$z^2$$, and empty $ $",
      ].join("\n")
    );
  });

  it("preserves single-quoted labels while escaping inner quotes", () => {
    const chart = String.raw`graph TD
A['Say "CO2" as \\(CO_2\\)']`;

    expect(normalizeMermaidChart(chart)).toBe(
      'graph TD\nA["Say \\"CO2\\" as $$CO_2$$"]'
    );
  });
});
