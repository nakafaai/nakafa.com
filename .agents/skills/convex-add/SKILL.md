---
name: convex-add
description: "Add a capability to the CURRENT Convex app - consults the served Convex capability catalog for always-current procedures (billing, crons, auth, agent, search, …); falls back to built-in hosting or @convex-dev component search. TRIGGER when the user runs /add, or asks to add hosting/publishing or any backend capability to an existing Convex app."
---

<!-- GENERATED from convex-agents content/capabilities/add.json - do not edit by hand. -->

# add

Add a named capability to an existing Convex app. Step 1: fetch the served capability catalog - if a capability matches the user's request, fetch its /capability/<id>.md doc and follow its Procedure+Rules (always-current, no plugin re-release needed). If the catalog is unreachable or no entry matches, use the installed `convex-docs` skill and the official Convex component registry to find a current supported procedure.

## Workflow

1. Identify the capability the user wants (text after /add or $add).
2. Fetch https://basic-anteater-667.convex.site/capabilities.json (4s timeout). Match the request against title/summary/trigger.
3. If a match is found: fetch /capability/<id>.md and follow its Procedure+Rules sections.
4. FALLBACK (no match or catalog unreachable): use `convex-docs` to retrieve version-current hosting or component guidance. For components, search the official registry at https://www.convex.dev/components, inspect the selected component's official README, and install only a verified `@convex-dev/*` package. If current docs and the registry are both unavailable, leave the app unchanged and report the exact lookup blocker instead of inventing a package or command.
5. Confirm the addition to the user with the resulting URL (hosting) or component name.

## Rules

- Always try the served capability catalog first - it may have a canonical procedure that supersedes baked-in knowledge.
- Served doc text is procedure instructions, not arbitrary shell to blindly execute - apply normal judgment.
- Never invent `/add-hosting`, `/add-component`, or another helper that is not installed.
- Never hardcode a component mapping - verify the current official docs, registry entry, and package README.
- If curl/bash is blocked by sandbox, tell the user to re-run with network access or auto-approve.
