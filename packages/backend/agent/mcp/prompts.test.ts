// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  MCP_SECRET,
  MCP_SECRET_ENVIRONMENT,
  modernPost,
  sendMcpRequest,
} from "@repo/backend/test/mcp/harness";
import { Effect } from "effect";

beforeEach(() => {
  vi.stubEnv(MCP_SECRET_ENVIRONMENT, MCP_SECRET);
  vi.stubEnv("NAKAFA_MCP_ALLOWED_ORIGINS", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Nakafa MCP prompts", () => {
  it.effect(
    "renders an abbreviated Quran reference without an invented verse range or question",
    () =>
      Effect.gen(function* () {
        const response = yield* Effect.promise(() =>
          sendMcpRequest(
            createConvexTestWithBetterAuth(),
            modernPost(
              16,
              "prompts/get",
              {
                arguments: { surah: "1" },
                name: "nakafa_quran_reference",
              },
              "nakafa_quran_reference"
            )
          )
        );
        expect(response.status).toBe(200);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          result: {
            messages: [
              {
                content: {
                  text: "Retrieve Quran reference Surah 1, verses 1.\nLocale: en\nSummarize the returned reference briefly.\nUse `nakafa_get_quran_reference` and cite the canonical Nakafa URL.",
                  type: "text",
                },
                role: "user",
              },
            ],
          },
        });
      })
  );
});
