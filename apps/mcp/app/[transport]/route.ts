import { api } from "@repo/connection/routes";
import { createMcpHandler } from "mcp-handler";
import { env } from "@/env";
import { tools } from "@/lib/tools";
import { buildContentSlug } from "@/lib/utils";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      tools.getContents.name,
      tools.getContents.description,
      tools.getContents.parameters,
      async ({ locale, filters }) => {
        const cleanSlug = buildContentSlug({ locale, filters });

        const { data, error } = await api.contents.getContents({
          slug: cleanSlug,
        });

        if (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error.message}`,
              },
            ],
          };
        }

        const contents = data.map((item) => ({
          ...item.metadata,
          url: item.url,
          slug: item.slug,
        }));

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

    server.tool(
      tools.getContent.name,
      tools.getContent.description,
      tools.getContent.parameters,
      async ({ slug }) => {
        const { data, error } = await api.contents.getContent({ slug });

        if (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error.message}. You can try to get the slug from the 'get_contents' tool.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: data?.raw ?? "",
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        [tools.getContents.name]: tools.getContents.description,
        [tools.getContent.name]: tools.getContent.description,
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
