import { createAgent, registerTools } from "@ui-sdk/react/agent";

/**
 * Opens the page to the agent a browser holds, through WebMCP. The agent reads every control of the design system by
 * its name, with its state and what it can do, and acts through the control's own API, so its change runs the same
 * callbacks as a reader's and a callback can refuse it. A control marked `data-agent-confirm` stays the reader's to
 * press: the agent is told to ask them, and never presses it for them. A browser without WebMCP registers nothing.
 * It returns the function that withdraws the tools.
 */
export function openPageToAgents() {
  return registerTools(createAgent(), {
    allow: (step) => step.confirm === undefined,
  });
}
