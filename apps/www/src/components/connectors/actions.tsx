import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import type { Connection } from "@/components/connectors/optimistic";
import type { ConnectSearch } from "@/components/connectors/outcome";

/** Where the last connect ended when Google sent the browser back, as the page's address names it. */
export const ConnectOutcomeContext = createContext<typeof ConnectSearch.Type>(
  {}
);

/**
 * What a connector page does for its owner, the account or the school: start a connect at Google,
 * and end a connection. It holds functions, so it is a plain shape.
 */
interface ConnectorActions {
  readonly connect: (connector: GoogleConnector) => Promise<void>;
  readonly disconnect: (connection: Connection) => void;
}

/** The connector actions of the page around its connector cards. */
export const ConnectorActionsContext = createContext<ConnectorActions | null>(
  null
);

/** Reads the connector actions of the page around the caller. */
export function useConnectorActions() {
  return useRequired(ConnectorActionsContext, "useConnectorActions");
}
