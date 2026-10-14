import { describe, expect, it } from "@effect/vitest";
import { webSearchSitesRule } from "@repo/backend/confect/nina/research/descriptions";
import {
  researchOutputSchema,
  webSearchInputSchema,
} from "@repo/backend/confect/nina/research/schema";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Schema } from "effect";

/** What the search tool's schema makes of the input a model wrote, as the AI SDK asks before the tool runs. */
function searched(input: unknown) {
  return webSearchInputSchema.validate?.(input);
}

/** What the synthesis schema makes of the answer a model wrote. */
function synthesized(answer: unknown) {
  return researchOutputSchema.validate?.(answer);
}

/** The part of the tool's JSON schema that tells the model how many sites a call may name. */
const SitesLimit = Schema.Struct({
  properties: Schema.Struct({ sites: Schema.Struct({ maxItems: Schema.Int }) }),
});

/** The most sites a call may name, as the JSON schema that the model reads says it. */
async function sitesLimit() {
  const { properties } = Schema.decodeUnknownSync(SitesLimit)(
    await webSearchInputSchema.jsonSchema
  );
  return properties.sites.maxItems;
}

describe("research schema", () => {
  it("validates optimized web-search query arrays", async () => {
    expect(
      await searched({ queries: ["AI SDK DevTools official documentation"] })
    ).toMatchObject({ success: true });
    expect(await searched({ queries: [] })).toMatchObject({ success: false });
    expect(
      await searched({ queries: ["AI SDK DevTools", "  \n"] })
    ).toMatchObject({ success: false });
    expect(await searched({ queries: ["  AI SDK DevTools\n"] })).toStrictEqual({
      success: true,
      value: { queries: ["AI SDK DevTools"] },
    });
  });
  it("tells the model the 500 characters the search provider accepts for a query, and refuses a longer one instead of cutting it", async () => {
    const accepted = async (query: string) =>
      (await searched({ queries: [query] }))?.success;

    expect(await accepted("a".repeat(500))).toBe(true);
    expect(await accepted("a".repeat(501))).toBe(false);
    // The limit counts characters as the JSON schema does: 𠮷 is one, though
    // JavaScript stores it as two units.
    expect(await accepted("𠮷".repeat(500))).toBe(true);
    expect(await accepted("𠮷".repeat(501))).toBe(false);
    expect(await webSearchInputSchema.jsonSchema).toMatchObject({
      properties: { queries: { items: { maxLength: 500 } } },
    });
  });
  it("asks the model for the queries, and for the sites only when it limits the search, and drops a field it still writes instead of refusing the call", async () => {
    const stale = {
      queries: ["AI SDK DevTools official documentation"],
      sourcePreference: "primary",
    };
    expect(await webSearchInputSchema.validate?.(stale)).toEqual({
      success: true,
      value: { queries: stale.queries },
    });
    expect(await webSearchInputSchema.jsonSchema).toMatchObject({
      properties: { queries: expect.any(Object), sites: expect.any(Object) },
      required: ["queries"],
    });
    expect(encodeJsonText(await webSearchInputSchema.jsonSchema)).not.toContain(
      "sourcePreference"
    );
  });
  it("decodes a call that names no site, as every call did before the field existed", async () => {
    // A strict comparison also fails when the value carries a `sites` key.
    expect(await searched({ queries: ["AI SDK DevTools"] })).toStrictEqual({
      success: true,
      value: { queries: ["AI SDK DevTools"] },
    });
  });
  it("decodes each site of the call as a hostname, which domain.test.ts pins in full, and refuses the whole input for one that is not", async () => {
    const queries = ["kurikulum merdeka"];
    const sited = (sites: string[]) => searched({ queries, sites });

    expect(await sited(["bbc.com", "https://www.cnn.com/news"])).toStrictEqual({
      success: true,
      value: { queries, sites: ["bbc.com", "www.cnn.com"] },
    });
    expect(await sited([])).toStrictEqual({
      success: true,
      value: { queries, sites: [] },
    });
    expect(await sited(["bbc.com", "BBC Indonesia"])).toMatchObject({
      success: false,
      error: {
        message: expect.stringContaining(
          "Expected a hostname, such as bbc.com."
        ),
      },
    });
  });
  it("tells the model the most sites it may name and refuses more instead of dropping any", async () => {
    const limit = await sitesLimit();
    const named = (count: number) =>
      searched({
        queries: ["kurikulum merdeka"],
        sites: Arr.makeBy(count, (index) => `site${index}.example.com`),
      });

    expect(await named(limit)).toMatchObject({ success: true });
    expect(await named(limit + 1)).toMatchObject({ success: false });
    expect(await webSearchInputSchema.jsonSchema).toMatchObject({
      properties: { sites: { items: { type: "string" } } },
    });
  });
  it("tells the model what the schema does: when to name a site, the bound, that a call over it or with a text that is no hostname is refused, and no open search for more sites", async () => {
    const json = encodeJsonText(await webSearchInputSchema.jsonSchema);
    // The same words as the search step and the tool description, which
    // `prompt.test.ts` pins.
    expect(json).toContain(webSearchSitesRule);
    expect(json).not.toContain("results of given sites");
    expect(json).toContain(
      "Every query of this call is then searched in those sites only."
    );
    expect(json).toContain(`Name at most ${await sitesLimit()} sites.`);
    expect(json).toContain(
      "A call that names more sites, or a site that is not a hostname, is refused and runs no search."
    );
    expect(json).toContain("Leave this field out for an open search.");
    // The schema refuses a call over the bound, so no text may say it is run.
    expect(json).not.toContain("is an open search");
  });
  it("does not ask the queries to carry a domain or a site's URL, which the sites field carries", async () => {
    const jsonSchema = await webSearchInputSchema.jsonSchema;
    expect(jsonSchema).toMatchObject({
      properties: {
        queries: {
          description: expect.stringContaining(
            "the URL of a page the query is about"
          ),
        },
      },
    });
    for (const word of ["domains", "URLs"]) {
      expect(jsonSchema).toMatchObject({
        properties: {
          queries: { description: expect.not.stringContaining(word) },
        },
      });
    }
  });
  it("asks research findings for their shape and leaves citations to the filter", async () => {
    const cited = await synthesized({
      findings: [
        {
          text: "AI SDK DevTools uses local debugging middleware.",
          citations: [
            {
              title: "AI SDK",
              url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
            },
          ],
        },
      ],
      limitations: [],
    });
    const stray = await synthesized({
      findings: [
        {
          text: "A stray URL drops this finding later, not the whole answer.",
          citations: [{ title: "AI SDK", url: "not-a-url" }],
        },
        { text: "So does a finding that cites nothing.", citations: [] },
      ],
      limitations: [],
    });
    const blank = await synthesized({
      findings: [{ text: "", citations: [] }],
      limitations: [],
    });
    const spaced = await synthesized({
      findings: [
        {
          text: "A link stays a link.",
          citations: [{ title: " AI SDK ", url: "https://ai-sdk.dev/docs\n" }],
        },
      ],
      limitations: [],
    });
    expect(cited).toMatchObject({ success: true });
    expect(stray).toMatchObject({ success: true });
    expect(blank).toMatchObject({ success: false });
    expect(spaced).toMatchObject({
      success: true,
      value: {
        findings: [
          { citations: [{ title: "AI SDK", url: "https://ai-sdk.dev/docs" }] },
        ],
      },
    });
  });
  it("accepts an answer that holds only limitations", async () => {
    expect(
      await synthesized({
        findings: [],
        limitations: ["No retrieved direct source supported a citeable claim."],
      })
    ).toMatchObject({ success: true });
  });
  it("tells the synthesis model to return the closest thing, scoped, and to always name what the sources do not cover", async () => {
    const jsonSchema = await researchOutputSchema.jsonSchema;
    expect(jsonSchema).toMatchObject({
      properties: {
        findings: {
          description: expect.stringContaining(
            "what the sources state about the closest thing to the task"
          ),
          items: {
            properties: {
              text: {
                description: expect.stringContaining(
                  "say exactly what it covers, such as its year or version"
                ),
              },
            },
          },
        },
        limitations: {
          description: expect.stringContaining(
            "When a finding covers only the closest thing to the task, always include one limitation that names the part of the task the collected sources do not cover."
          ),
        },
      },
    });
  });
  it("makes saying what the collected sources cover and do not state the one exception to the found and absence bans, stated after them", async () => {
    const json = encodeJsonText(await researchOutputSchema.jsonSchema);
    expect(json).toContain("Do not use found or not-found wording.");
    expect(json).toContain("Do not make absence claims.");
    expect(json).toContain(
      "Saying what the collected sources cover and do not state is the one exception to both: it describes only these sources."
    );
    expect(json).toContain("Never widen it into a claim about the world.");
    expect(json.indexOf("is the one exception to both")).toBeGreaterThan(
      json.indexOf("Do not make absence claims.")
    );
  });
  it("does not limit a limitation to what could not be established, so a statement of coverage is not forbidden", async () => {
    const json = encodeJsonText(await researchOutputSchema.jsonSchema);
    expect(json).toContain(
      "Describe what this retrieval attempt could not establish."
    );
    expect(json).not.toContain("Describe only what");
  });
  it("lets the synthesis model return an empty findings array only when no source states the task or its closest thing", async () => {
    const json = encodeJsonText(await researchOutputSchema.jsonSchema);
    expect(json).toContain(
      "Use an empty array only when no collected source states anything about the task or the closest thing to it."
    );
    expect(json).not.toContain("direct citation evidence is unavailable");
  });
});
