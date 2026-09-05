import { describe, expect, it } from "@effect/vitest";
import {
  MdxAgentProjectionError,
  projectMdxForAgentMarkdown,
  readMdxBody,
} from "@repo/contents/_types/llms/mdx";
import { Effect } from "effect";

describe("authored MDX body", () => {
  it.effect("omits module metadata while preserving all lesson bytes", () =>
    Effect.gen(function* () {
      const body = `## Source body fixture

Keep **emphasis**, blank lines, and <InlineMath math="x^2" />.

<Triangle
  title="A metadata example"
  labels={{ opposite: "a", adjacent: "b", hypotenuse: "c" }}
/>

\`\`\`ts
export const metadata = { title: "This code belongs to the lesson" };
\`\`\``;
      const source = `import { Triangle } from "fixture";

export const metadata = {
  title: "Metadata with a closing brace } and semicolon ;",
  authors: [{ name: "Fixture author" }],
};

${body}\n`;

      expect(yield* readMdxBody(source)).toBe(body);
      expect(yield* readMdxBody(body)).toBe(body);
    })
  );

  it.effect("preserves body text on both sides of a module declaration", () =>
    Effect.gen(function* () {
      expect(
        yield* readMdxBody(
          '## First\n\nexport const metadata = { title: "Fixture" };\n\n## Last'
        )
      ).toBe("## First\n\n\n\n## Last");
    })
  );

  it.effect("rejects malformed MDX through its typed failure channel", () =>
    Effect.gen(function* () {
      const failure = yield* readMdxBody("<Triangle title={").pipe(Effect.flip);
      expect(failure._tag).toBe("MdxAgentProjectionError");
    })
  );
});

describe("MDX agent markdown projection", () => {
  it.effect(
    "preserves authored math, diagrams, visual data, and agent context",
    () =>
      Effect.gen(function* () {
        const markdown =
          yield* projectMdxForAgentMarkdown(`import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { Mermaid } from "@repo/design-system/components/ui/mermaid";

## Example

The value is <InlineMath math="\\alpha" />.

<MathContainer>
<BlockMath math="\\text{Area} = \\frac{1}{2} \\times b h" />
</MathContainer>

<AgentContext>
Use the sector data when explaining why <InlineMath math="60^\\circ" /> is one-sixth of a circle.
</AgentContext>

<CodeBlock
  data={[
    {
      language: "python",
      filename: "area.py",
      code: \`area = 0.5 * base * height
print(area)\`
    }
  ]}
/>

<CodeBlock data={[]} />

<CodeBlock data={[{ code: \`plain = true\` }]} />

<LineEquation
  title={<>Sector <InlineMath math="60^\\circ" /></>}
  description={<>Shows <InlineMath math="\\frac{1}{6}" /> of a circle.</>}
  caption={<>Move $$P(3,2)$$ to{" "}<InlineMath math="P'(1,5)" />.</>}
  data={[{ points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }], label: "diameter" }]}
/>

<NumberLine
  title={<>Solution range</>}
  segments={[
    { start: 0, end: 2, startInclusive: true, endInclusive: true },
    { start: 2, end: Number.POSITIVE_INFINITY, startInclusive: false },
  ]}
/>

<Vector3d
  title={<>Resultant vector</>}
  vectors={[{ from: [0, 0, 0], to: [3, 4, 0], label: "R" }]}
/>

<FunctionChart title="Exponential model" p={2} a={3} n={5} />

<HistogramChart
  title="Histogram Distribusi Nilai"
  yAxisLabel="Frekuensi"
  data={[
    { name: "49,5-54,5", value: 5 },
    { name: "54,5-59,5", value: 9 },
  ]}
/>

<GreenhouseEffectLab
  title={<>Greenhouse model</>}
  labels={{
    gasControl: "Greenhouse gas level",
    heatFlow: <>Sunlight enters and heat is trapped.</>,
  }}
/>

<Triangle
  title={<>Triangle ratios</>}
  labels={{ opposite: "depan", adjacent: "samping", hypotenuse: "miring" }}
/>

<Mermaid title="Flow" chart={\`graph TD;
A-->B\`} />
`);

        expect(markdown).toContain("The value is $$\\alpha$$.");
        expect(markdown).toContain("Visible text: The value is .");
        expect(markdown).toContain(
          "```math\n\\text{Area} = \\frac{1}{2} \\times b h\n```"
        );
        expect(markdown).toContain(
          "Use the sector data when explaining why $$60^\\circ$$"
        );
        expect(markdown).toContain("File: area.py");
        expect(markdown).toContain("```python\narea = 0.5 * base * height");
        expect(markdown).not.toContain("```[]");
        expect(markdown).toContain("```\nplain = true\n```");
        expect(markdown).toContain("Component: LineEquation");
        expect(markdown).toContain("points: [{ x: 0, y: 0, z: 0 }");
        expect(markdown).toContain("Visible text: Sector");
        expect(markdown).toContain("Visible text: Shows of a circle.");
        expect(markdown).toContain("Visible text: Move to .");
        expect(markdown).toContain("diameter");
        expect(markdown).toContain("Component: NumberLine");
        expect(markdown).toContain("startInclusive: true");
        expect(markdown).toContain("Number.POSITIVE_INFINITY");
        expect(markdown).toContain("Component: Vector3d");
        expect(markdown).toContain("from: [0, 0, 0], to: [3, 4, 0]");
        expect(markdown).toContain("Component: FunctionChart");
        expect(markdown).toContain("- p: 2");
        expect(markdown).toContain("- a: 3");
        expect(markdown).toContain("Component: HistogramChart");
        expect(markdown).toContain("49,5-54,5");
        expect(markdown).toContain("Greenhouse gas level");
        expect(markdown).toContain("Sunlight enters and heat is trapped.");
        expect(markdown).toContain("Component: Triangle");
        expect(markdown).toContain('hypotenuse: "miring"');
        expect(markdown).toContain("- title: Flow");
        expect(markdown).toContain("```mermaid\ngraph TD;");
        expect(markdown).not.toContain("import { LineEquation }");
      })
  );

  it.effect("handles edge MDX syntax without adding fake semantics", () =>
    Effect.gen(function* () {
      const markdown = yield* projectMdxForAgentMarkdown(`
<>

Fragment child with <InlineMath math="x" />.

</>

<InlineMath math="y" />

<BlockMath math="" />

<CodeBlock />

<Mermaid />

<Unknown title="" enabled {...props} />
`);

      expect(markdown).toContain("Fragment child with $$x$$.");
      expect(markdown).toContain("$$y$$");
      expect(markdown).toContain("Visible text: Fragment child with .");
      expect(markdown).toContain("Component: Mermaid");
      expect(markdown).toContain("Component: Unknown");
      expect(markdown).toContain("- enabled: true");
      expect(markdown).toContain("- spread: ...props");
      expect(markdown).not.toContain("```math\n\n```");
    })
  );

  it.effect(
    "keeps unknown instructional components bounded instead of using a hardcoded allowlist",
    () =>
      Effect.gen(function* () {
        const longData = Array.from({ length: 180 }, (_, index) => ({
          label: `point-${index}`,
          value: index,
        }));

        const markdown = yield* projectMdxForAgentMarkdown(`
<FutureScienceScene
  title="Orbital transfer"
  data={${JSON.stringify(longData)}}
>
The scene compares entry speed and orbit height.
</FutureScienceScene>
`);

        expect(markdown).toContain("Component: FutureScienceScene");
        expect(markdown).toContain("- title: Orbital transfer");
        expect(markdown).toContain("point-0");
        expect(markdown).toContain("[truncated;");
        expect(markdown).toContain(
          "The scene compares entry speed and orbit height."
        );
      })
  );

  it.effect("keeps escaped nested code fences inside CodeBlock data", () =>
    Effect.gen(function* () {
      const markdown = yield* projectMdxForAgentMarkdown(`
<CodeBlock
  data={[{
    language: "markdown",
    filename: "syntax.md",
    code: \`# Heading

\\\`\\\`\\\`python
print("Hello, World!")
\\\`\\\`\\\`

| Column 1 | Column 2 |
|----------|----------|
| Data A   | Data B   |\`
  }]}
/>
`);

      expect(markdown).toContain("File: syntax.md");
      expect(markdown).toContain('print("Hello, World!")');
      expect(markdown).toContain("| Column 1 | Column 2 |");
      expect(markdown).toContain("| Data A   | Data B   |");
    })
  );

  it.effect(
    "projects the cooked backslashes rendered by template literal code",
    () =>
      Effect.gen(function* () {
        const body = [
          "<CodeBlock",
          "  data={[{",
          '    language: "python",',
          "    code: `>>> 'He said: \"I\\\\'m Bob.\"'",
          '>>> print("C:\\\\\\\\Users\\\\\\\\Documents")`',
          "  }]}",
          "/>",
        ].join("\n");
        const markdown = yield* projectMdxForAgentMarkdown(body);

        expect(markdown).toContain(">>> 'He said: \"I\\'m Bob.\"'");
        expect(markdown).toContain('>>> print("C:\\\\Users\\\\Documents")');
      })
  );

  it.effect(
    "reports malformed standalone fragments as typed projection failures",
    () =>
      Effect.gen(function* () {
        const explicitError = new MdxAgentProjectionError({
          message: "projection failed",
        });
        const error = yield* Effect.flip(
          projectMdxForAgentMarkdown(
            "The statement keeps \\(x^2\\) even when {source syntax is incomplete."
          )
        );
        expect(explicitError.message).toBe("projection failed");
        expect(error._tag).toBe("MdxAgentProjectionError");
        expect(error.message).toContain("expression");
      })
  );
});
