# Nakafa CLI

The official Node 24 command-line client for Nakafa's public, read-only REST API and MCP server. No Nakafa account or API key is required.

## Install

```sh
npm install --global nakafa-cli
```

## Commands

```sh
nakafa search linear equations
nakafa get https://nakafa.com/en/quran/1
nakafa taxonomy
nakafa quran 1 --from-verse 1 --to-verse 7
nakafa mcp
nakafa --help
nakafa --version
```

Commands emit compact JSON to standard output. Add `--pretty` for indented output. Add `--api-base <url>` to use another HTTP edge. Direct isolated Convex origins also require a deployment-specific temporary `NAKAFA_API_EDGE_SECRET` environment variable. Never reuse the production edge secret for isolated verification.

HTTP API failures preserve Nakafa's RFC 9457 Problem Details object on standard error. Exit status `2` means invalid CLI invocation, `3` means an API request failure, and `4` means a network, server, or response-decoding failure.

See [Nakafa Developer Resources](https://nakafa.com/developers) and the [OpenAPI 3.1 contract](https://api.nakafa.com/openapi.json).
