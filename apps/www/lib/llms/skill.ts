import { createHash } from "node:crypto";
import { NAKAFA_MCP_RECOMMENDED_ENDPOINT } from "@repo/contents/_lib/agent/constants";
import { languages } from "@repo/internationalization/data/lang";

const NAKAFA_SKILL_NAME = "nakafa";
const NAKAFA_SKILL_DESCRIPTION =
  "Use Nakafa to retrieve multilingual educational lessons, Quran references, article context, and try-out catalog pages through agent-friendly markdown and MCP tools.";
const NAKAFA_AGENT_SKILL_PATH = "/.well-known/agent-skills/nakafa/SKILL.md";

/** Builds the public Nakafa skill.md capability guide. */
export function getNakafaSkillText() {
  const localeGuidance = languages
    .map(({ label, value }) => `\`/${value}\` for ${label}`)
    .join(", ");

  return [
    "---",
    `name: ${NAKAFA_SKILL_NAME}`,
    `description: ${NAKAFA_SKILL_DESCRIPTION}`,
    "license: MIT",
    "clients: Public HTTPS documentation, markdown URLs, llms.txt, and Streamable HTTP MCP clients.",
    "metadata:",
    "  author: Nakafa",
    '  version: "1.0"',
    "---",
    "",
    "# Nakafa Agent Skill",
    "",
    "Use this skill when a user needs educational content from Nakafa, including curriculum lessons, Quran references, articles, and try-out catalog material.",
    "",
    "## Discovery",
    "",
    "- Start with `https://nakafa.com/llms.txt` for locale, section, and bounded page indexes.",
    "- Follow bounded page-index links to discover page-level `.md` URLs without loading the whole corpus.",
    "- Prefer same-origin `.md` URLs for focused page retrieval.",
    "- Send `Accept: text/markdown` when requesting normal content URLs.",
    `- Use \`${NAKAFA_MCP_RECOMMENDED_ENDPOINT}\` when the client supports Streamable HTTP MCP tools.`,
    "- Prefer `nakafa_search_content` first, then pass returned source-backed `content_id` values as `content_ref` to `nakafa_get_content`.",
    "- Use `nakafa_get_taxonomy` to inspect supported locales, sections, categories, grades, materials, try-out values, and endpoint guidance.",
    "",
    "## Locale Rules",
    "",
    `- Use ${localeGuidance} content.`,
    "- Preserve the user's requested language when choosing links.",
    "- If requested content is missing in that locale, report the missing locale instead of silently substituting another language.",
    "",
    "## Answering Rules",
    "",
    "- Cite the exact Nakafa URL used for each answer.",
    "- Prefer page-level markdown over HTML because it contains the documentation content without navigation boilerplate.",
    "- Do not invent lesson, try-out, or Quran content that is not present in the retrieved Nakafa source.",
    "- For try-out catalog results, cite the app URL and avoid inventing attempt-specific questions or scores.",
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
