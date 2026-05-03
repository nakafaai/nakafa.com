import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getNakafaAgentSkillIndex,
  getNakafaLegacySkillIndex,
  getNakafaSkillText,
  NAKAFA_AGENT_SKILL_PATH,
  NAKAFA_SKILL_DESCRIPTION,
  NAKAFA_SKILL_NAME,
} from "@/lib/llms/skill";

describe("Nakafa public agent skill", () => {
  it("builds a skill.md document with required frontmatter and retrieval rules", () => {
    const text = getNakafaSkillText();

    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain(`name: ${NAKAFA_SKILL_NAME}`);
    expect(text).toContain(`description: ${NAKAFA_SKILL_DESCRIPTION}`);
    expect(text).toContain("license: MIT");
    expect(text).toContain("# Nakafa Agent Skill");
    expect(text).toContain("https://nakafa.com/llms.txt");
    expect(text).toContain("https://nakafa.com/llms-full.txt");
    expect(text).toContain("https://nakafa.com/llms-full/index.json");
    expect(text).toContain("https://nakafa.com/mcp");
    expect(text).toContain("Accept: text/markdown");
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
          name: NAKAFA_SKILL_NAME,
          type: "skill-md",
          description: NAKAFA_SKILL_DESCRIPTION,
          url: NAKAFA_AGENT_SKILL_PATH,
          digest: `sha256:${digest}`,
        },
      ],
    });
  });

  it("builds the legacy skills discovery manifest", () => {
    expect(getNakafaLegacySkillIndex()).toStrictEqual({
      skills: [
        {
          name: NAKAFA_SKILL_NAME,
          description: NAKAFA_SKILL_DESCRIPTION,
          files: ["SKILL.md"],
        },
      ],
    });
  });
});
