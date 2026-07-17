// @vitest-environment node
import { createHash } from "node:crypto";
import { languages } from "@repo/internationalization/data/lang";
import { describe, expect, it } from "vitest";
import { getNakafaAgentSkillIndex, getNakafaSkillText } from "@/lib/llms/skill";

describe("Nakafa public agent skill", () => {
  it("builds a skill.md document with required frontmatter and retrieval rules", () => {
    const text = getNakafaSkillText();

    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain("name: nakafa");
    expect(text).toContain(
      "description: Use Nakafa to retrieve multilingual educational lessons"
    );
    expect(text).toContain("license: MIT");
    expect(text).toContain("# Nakafa Agent Skill");
    expect(text).toContain("https://nakafa.com/llms.txt");
    expect(text).toContain("bounded page-index links");
    expect(text).toContain("https://nakafa.com/mcp");
    expect(text).toContain("Accept: text/markdown");

    for (const language of languages) {
      expect(text).toContain(`/${language.value}`);
    }
  });

  it("builds the agent-skills discovery manifest with a matching digest", () => {
    const index = getNakafaAgentSkillIndex();
    const digest = createHash("sha256")
      .update(getNakafaSkillText())
      .digest("hex");

    expect(index).toStrictEqual({
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills: [
        {
          name: "nakafa",
          type: "skill-md",
          description: expect.stringContaining(
            "multilingual educational lessons"
          ),
          url: "/.well-known/agent-skills/nakafa/SKILL.md",
          digest: `sha256:${digest}`,
        },
      ],
    });
  });
});
