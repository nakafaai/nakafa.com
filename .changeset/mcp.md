---
"@repo/backend": patch
---

The MCP endpoint at `/internal/mcp` is served by Effect's `McpServer`, and the `@modelcontextprotocol/server` package is removed. Clients see these changes:

- `server/discover` declares empty `tools`, `resources`, and `prompts` capabilities. The `listChanged` flags are removed, because these lists do not change while a deployment runs.
- The endpoint serves eight methods: `server/discover`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, `resources/read`, `prompts/list`, and `prompts/get`. A request for any other method, such as `subscriptions/listen` or `completion/complete`, gets HTTP 404 with code -32601 and the message `Method not found`.
- `Access-Control-Allow-Methods` is `POST,OPTIONS`, not `GET,POST,DELETE,OPTIONS`. `last-event-id` and `mcp-session-id` are no longer allowed request headers, and `MCP-Session-ID` is no longer an exposed response header.
- Some error messages changed. Tool argument errors use Nakafa's wording and return the same error in `structuredContent`, for example `Invalid Nakafa content search options.`. Unknown tool, prompt, and resource errors quote the name, for example `Tool 'nakafa_unknown_tool' not found`. Header mismatch errors read `Mcp-Method header does not match request method` and `Mcp-Name header does not match request parameters`.
