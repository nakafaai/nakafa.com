import {
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";

export function GET() {
  const timestamp = new Date().toLocaleTimeString();
  const terminalOutput = `Nakafa MCP Server

[${timestamp}] INFO: Welcome to Nakafa MCP Server.
[${timestamp}] INFO: Your gateway to comprehensive multilingual educational content.

[${timestamp}] INFO: MCP Server initialized successfully.
[${timestamp}] INFO: ${NAKAFA_MCP_INFORMATIONAL_ROOT} is informational only.
[${timestamp}] INFO: Use ${NAKAFA_MCP_RECOMMENDED_ENDPOINT} as the recommended MCP endpoint.
[${timestamp}] INFO: Use ${NAKAFA_MCP_DIRECT_ENDPOINT} as the direct MCP endpoint.
[${timestamp}] INFO: Root URL ${NAKAFA_MCP_INFORMATIONAL_ROOT} is not an MCP transport endpoint.
[${timestamp}] INFO: Tools: nakafa_search_content, nakafa_get_content, nakafa_get_taxonomy, nakafa_get_exercise, nakafa_get_quran_reference.

[${timestamp}] INFO: Website: https://nakafa.com
[${timestamp}] INFO: GitHub: https://github.com/nakafaai/nakafa.com
[${timestamp}] INFO: Documentation: https://docs.nakafa.com

nakafa-mcp-server:~$ _
`;

  return new Response(terminalOutput, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
