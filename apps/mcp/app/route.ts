export function GET() {
  const terminalOutput = `❤️ Nakafa MCP Server ❤️

[${new Date().toLocaleTimeString()}] INFO: Welcome to Nakafa MCP Server!
[${new Date().toLocaleTimeString()}] INFO: Your gateway to comprehensive multilingual educational content.

[${new Date().toLocaleTimeString()}] INFO: MCP Server initialized successfully
[${new Date().toLocaleTimeString()}] INFO: Ready to serve educational content.
[${new Date().toLocaleTimeString()}] INFO: Connection established - Happy learning!

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
