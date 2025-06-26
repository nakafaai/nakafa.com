import { getContents } from "@repo/contents/_lib/utils";

export async function GET() {
  const contents = await getContents({});

  const terminalOutput = `❤️ Nakafa API Server ❤️

[${new Date().toLocaleTimeString()}] INFO: Welcome to Nakafa API Server!
[${new Date().toLocaleTimeString()}] INFO: Your gateway to comprehensive multilingual educational content.

[${new Date().toLocaleTimeString()}] INFO: API Server initialized successfully
[${new Date().toLocaleTimeString()}] INFO: Ready to serve educational content.
[${new Date().toLocaleTimeString()}] INFO: Total contents: ${contents.length}
[${new Date().toLocaleTimeString()}] INFO: Connection established - Happy learning!

[${new Date().toLocaleTimeString()}] INFO: Website: https://nakafa.com
[${new Date().toLocaleTimeString()}] INFO: GitHub: https://github.com/nakafaai/nakafa.com/apps/api
[${new Date().toLocaleTimeString()}] INFO: Documentation: https://docs.nakafa.com

nakafa-api-server:~$ _
`;

  return new Response(terminalOutput, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
