import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Effect, type Schema } from "effect";
import {
  toMcpJsonObjectSchema,
  toMcpToolOutputJsonSchema,
  validateNakafaMcpToolResult,
} from "@/lib/mcp/effect";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";
import {
  getNakafaContentToolResult,
  NakafaGetContentToolInputSchema,
  NakafaGetContentToolOutputSchema,
} from "@/lib/mcp/tools/content";
import {
  getNakafaQuranReferenceToolResult,
  NakafaGetQuranReferenceToolInputSchema,
  NakafaGetQuranReferenceToolOutputSchema,
} from "@/lib/mcp/tools/quran";
import {
  getNakafaSearchContentToolResult,
  NakafaSearchContentToolInputSchema,
  NakafaSearchContentToolOutputSchema,
} from "@/lib/mcp/tools/search";
import {
  getNakafaTaxonomyToolResult,
  NakafaGetTaxonomyToolInputSchema,
  NakafaGetTaxonomyToolOutputSchema,
} from "@/lib/mcp/tools/taxonomy";

interface NakafaMcpTool {
  readonly annotations: typeof NAKAFA_READ_ONLY_TOOL_ANNOTATIONS;
  readonly description: string;
  readonly inputSchema: Schema.Schema.AnyNoContext;
  readonly name: string;
  readonly outputSchema: Schema.Schema.AnyNoContext;
  readonly run: (args: unknown) => Effect.Effect<CallToolResult>;
  readonly title: string;
}

const NAKAFA_MCP_TOOLS: readonly NakafaMcpTool[] = [
  {
    annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
    description:
      "Search the Nakafa public content index across articles, subjects, try-outs, and Quran references. Returns bounded paginated summaries with stable content IDs.",
    inputSchema: NakafaSearchContentToolInputSchema,
    name: "nakafa_search_content",
    outputSchema: NakafaSearchContentToolOutputSchema,
    run: getNakafaSearchContentToolResult,
    title: "Search Nakafa Content",
  },
  {
    annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
    description:
      "Return full agent-readable markdown for a public Nakafa content reference.",
    inputSchema: NakafaGetContentToolInputSchema,
    name: "nakafa_get_content",
    outputSchema: NakafaGetContentToolOutputSchema,
    run: getNakafaContentToolResult,
    title: "Get Nakafa Content",
  },
  {
    annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
    description:
      "Return supported Nakafa locales, sections, categories, grades, materials, try-out discovery values, counts, and MCP endpoint guidance.",
    inputSchema: NakafaGetTaxonomyToolInputSchema,
    name: "nakafa_get_taxonomy",
    outputSchema: NakafaGetTaxonomyToolOutputSchema,
    run: getNakafaTaxonomyToolResult,
    title: "Get Nakafa Taxonomy",
  },
  {
    annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
    description:
      "Return bounded Surah and verse data with Arabic text, transliteration, selected translation, optional tafsir, and canonical Nakafa URL.",
    inputSchema: NakafaGetQuranReferenceToolInputSchema,
    name: "nakafa_get_quran_reference",
    outputSchema: NakafaGetQuranReferenceToolOutputSchema,
    run: getNakafaQuranReferenceToolResult,
    title: "Get Nakafa Quran Reference",
  },
];

/** Registers Nakafa tools through an Effect Schema-backed MCP boundary. */
export function registerNakafaMcpTools(server: McpServer) {
  const toolsByName = new Map(
    NAKAFA_MCP_TOOLS.map((tool) => [tool.name, tool])
  );

  server.server.registerCapabilities({
    tools: {
      listChanged: true,
    },
  });

  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: NAKAFA_MCP_TOOLS.map(toMcpToolDefinition),
  }));

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolsByName.get(request.params.name);

    if (!tool) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Tool ${request.params.name} not found`
      );
    }

    const result = await Effect.runPromise(
      tool.run(request.params.arguments ?? {})
    );

    return validateNakafaMcpToolResult(result, tool.outputSchema, tool.name);
  });
}

/** Converts one Effect-backed tool definition into MCP protocol metadata. */
function toMcpToolDefinition(tool: NakafaMcpTool) {
  return {
    annotations: tool.annotations,
    description: tool.description,
    inputSchema: toMcpJsonObjectSchema(tool.inputSchema),
    name: tool.name,
    outputSchema: toMcpToolOutputJsonSchema(tool.outputSchema),
    title: tool.title,
  };
}
