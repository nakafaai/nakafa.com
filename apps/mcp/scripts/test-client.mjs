import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = process.argv[2] || "https://mcp.nakafa.com";

async function main() {
  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    {
      name: "nakafa-mcp-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    },
  );

  console.info("Connecting to", origin);
  await client.connect(transport);

  console.info("Connected", client.getServerCapabilities());

  const result = await client.listTools();
  console.info(JSON.stringify(result, null, 2));
  client.close();
}

main();
