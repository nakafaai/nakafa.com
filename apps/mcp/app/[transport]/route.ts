import { vercelTrack } from "@repo/analytics/vercel";
import { getContents } from "@repo/contents/_lib/utils";
import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { env } from "@/env";

const GetContentsSchema = z.object({
  locale: z
    .enum(["en", "id"])
    .default("en")
    .describe(
      "Language locale for content retrieval. 'en' for English, 'id' for Indonesian (Bahasa Indonesia)"
    ),
  type: z
    .enum(["", "subject", "articles"])
    .default("")
    .describe(
      "Content type filter: empty string '' for all content types, 'subject' for educational subjects and course materials, 'articles' for political analysis and educational articles"
    ),
});

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_contents",
      "Retrieve educational contents from Nakafa platform. Returns a structured list of educational materials including articles, subjects, and course content with metadata like titles, descriptions, authors, and URLs. This tool is optimized for educational content discovery and analysis.",
      GetContentsSchema.shape,
      async ({ locale, type }) => {
        const contents = await getContents({
          locale,
          basePath: type,
        });

        await vercelTrack("get_contents", {
          locale,
          type,
          total: contents.length,
        });

        if (contents.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No contents found. Please try again with different parameters.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Found ${contents.length} contents:
              
              ${JSON.stringify(contents, null, 2)}
              `,
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        get_contents: {
          description:
            "Retrieve structured educational content from Nakafa platform with metadata and URLs, optimized for educational content analysis and discovery.",
        },
      },
    },
  },
  {
    redisUrl: env.REDIS_URL,
    basePath: "",
    verboseLogs: true,
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
