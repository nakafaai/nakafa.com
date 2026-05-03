import { createHash } from "node:crypto";

export const NAKAFA_SKILL_NAME = "nakafa";
export const NAKAFA_SKILL_DESCRIPTION =
  "Use Nakafa to retrieve multilingual educational lessons, Quran references, article context, and exam practice pages through agent-friendly markdown and MCP tools.";
export const NAKAFA_AGENT_SKILL_PATH =
  "/.well-known/agent-skills/nakafa/SKILL.md";

/** Builds the public Nakafa skill.md capability guide. */
export function getNakafaSkillText() {
  return [
    "---",
    `name: ${NAKAFA_SKILL_NAME}`,
    `description: ${NAKAFA_SKILL_DESCRIPTION}`,
    "license: MIT",
    "compatibility: Public HTTPS documentation, markdown URLs, llms.txt, llms-full.txt, and Streamable HTTP MCP clients.",
    "metadata:",
    "  author: Nakafa",
    '  version: "1.0"',
    "---",
    "",
    "# Nakafa Agent Skill",
    "",
    "Use this skill when a user needs educational content from Nakafa, including subject lessons, Quran references, articles, and exam practice material.",
    "",
    "## Discovery",
    "",
    "- Start with `https://nakafa.com/llms.txt` for the small locale and section index.",
    "- Use `https://nakafa.com/llms-full.txt` to discover the full-corpus shard map.",
    "- Use `https://nakafa.com/llms-full/index.json` to choose smaller locale, section, topic, set, or Quran full-content shards.",
    "- Prefer same-origin `.md` URLs from `llms.txt` for focused page retrieval.",
    "- Send `Accept: text/markdown` when requesting normal content URLs.",
    "- Use `https://nakafa.com/mcp` when the client supports Streamable HTTP MCP tools.",
    "",
    "## Locale Rules",
    "",
    "- Use `/en` for English content and `/id` for Indonesian content.",
    "- Preserve the user's requested language when choosing links.",
    "- If one locale is missing a specific explanation, use the available locale and say which locale was retrieved.",
    "",
    "## Answering Rules",
    "",
    "- Cite the exact Nakafa URL used for each answer.",
    "- Prefer page-level markdown over HTML because it contains the documentation content without navigation boilerplate.",
    "- Do not invent lesson, exercise, or Quran content that is not present in the retrieved Nakafa source.",
    "- For exercises, include the question number and set URL when explaining an answer.",
    "- For Quran references, include the Surah and verse numbers from the retrieved page.",
    "",
  ].join("\n");
}

/** Builds the recommended agent-skills discovery manifest. */
export function getNakafaAgentSkillIndex() {
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: NAKAFA_SKILL_NAME,
        type: "skill-md",
        description: NAKAFA_SKILL_DESCRIPTION,
        url: NAKAFA_AGENT_SKILL_PATH,
        digest: `sha256:${createHash("sha256")
          .update(getNakafaSkillText())
          .digest("hex")}`,
      },
    ],
  };
}

/** Builds the legacy skills discovery manifest. */
export function getNakafaLegacySkillIndex() {
  return {
    skills: [
      {
        name: NAKAFA_SKILL_NAME,
        description: NAKAFA_SKILL_DESCRIPTION,
        files: ["SKILL.md"],
      },
    ],
  };
}
