// @vitest-environment node
import { layer as nodeCryptoLayer } from "@effect/platform-node/NodeCrypto";
import { describe, expect, it } from "@effect/vitest";
import { languages } from "@repo/internationalization/data/lang";
import { Crypto, Effect } from "effect";
import { Hex } from "effect/encoding";
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
    expect(text).toContain("https://mcp.nakafa.com/mcp");
    expect(text).toContain("Accept: text/markdown");

    for (const language of languages) {
      expect(text).toContain(`/${language.value}`);
    }
  });

  it.effect(
    "builds the agent-skills discovery manifest with a matching digest",
    () =>
      Effect.gen(function* () {
        const index = yield* getNakafaAgentSkillIndex();
        // The index hashes with Web Crypto, so the Node layer checks it.
        const crypto = yield* Crypto.Crypto;
        const digest = Hex.encode(
          yield* crypto.digest(
            "SHA-256",
            new TextEncoder().encode(getNakafaSkillText())
          )
        );

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
      }).pipe(Effect.provide(nodeCryptoLayer))
  );
});
