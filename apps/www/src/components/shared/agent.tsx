import { useEffect } from "react";

/**
 * Loads the bridge and opens the page to the browser's agent, resolving to the function that withdraws its tools.
 * It stands outside the component, since the React Compiler does not compile a dynamic import inside one.
 */
function openBridge() {
  return import("@repo/design-system/lib/agent").then(({ openPageToAgents }) =>
    openPageToAgents()
  );
}

/**
 * Opens every page to the agent a reader's browser holds (WebMCP), so it reads and uses Nakafa's controls as the
 * reader does, by name and through the controls' own actions, never by guessing at pixels. A browser without an
 * agent never downloads the bridge, so the page a reader loads stays as light as before.
 */
export function AgentBridge() {
  useEffect(() => {
    if (!("modelContext" in document)) {
      return;
    }
    const opened = openBridge();
    // A page that leaves before the bridge loads withdraws the tools as soon as they open.
    return () => {
      opened.then((withdraw) => withdraw());
    };
  }, []);

  return null;
}
