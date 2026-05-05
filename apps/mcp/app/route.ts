export function GET() {
  const recommendedEndpoint = "https://nakafa.com/mcp";
  const directEndpoint = "https://mcp.nakafa.com/mcp";
  const rootUrl = "https://mcp.nakafa.com";
  const terminalOutput = `❤️ Nakafa MCP Server ❤️

[${new Date().toLocaleTimeString()}] INFO: Welcome to Nakafa MCP Server!
[${new Date().toLocaleTimeString()}] INFO: Your gateway to comprehensive multilingual educational content.

[${new Date().toLocaleTimeString()}] INFO: MCP Server initialized successfully
[${new Date().toLocaleTimeString()}] INFO: ${rootUrl} is informational only.
[${new Date().toLocaleTimeString()}] INFO: Use ${recommendedEndpoint} as the recommended MCP endpoint.
[${new Date().toLocaleTimeString()}] INFO: Use ${directEndpoint} as the direct MCP endpoint.

[${new Date().toLocaleTimeString()}] INFO: Website: https://nakafa.com
[${new Date().toLocaleTimeString()}] INFO: GitHub: https://github.com/nakafaai/nakafa.com
[${new Date().toLocaleTimeString()}] INFO: Documentation: https://docs.nakafa.com

nakafa-mcp-server:~$ _
`;

  return new Response(terminalOutput, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
