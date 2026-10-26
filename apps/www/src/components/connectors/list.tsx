import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import type { ConnectOutcome } from "@repo/backend/confect/connectors/schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ConnectorCard } from "@/components/connectors/card";
import {
  type Connection,
  currentConnection,
} from "@/components/connectors/optimistic";
import { TableEmpty } from "@/components/shared/table/frame";

/**
 * The Google connectors an owner may connect, one card each, with the state of the
 * owner's connection. A connect that Google or an unchecked scope refused says so
 * above the cards when the browser comes back. A deployment that offers no
 * connector, as production does until Google's review, shows that instead.
 */
export function ConnectorList({
  connections,
  offered,
  onConnect,
  onDisconnect,
  outcome,
}: {
  connections: readonly Connection[];
  offered: readonly GoogleConnector[];
  onConnect: (connector: GoogleConnector) => Promise<void>;
  onDisconnect: (connection: Connection) => void;
  outcome: (typeof ConnectOutcome.Type)["outcome"] | undefined;
}) {
  const t = useTranslations("Connectors");

  if (Arr.isReadonlyArrayEmpty(offered)) {
    return (
      <TableEmpty
        act="relaxed"
        description={t("none-description")}
        title={t("none")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {outcome === "refused" ? (
        <Alert variant="destructive">
          <AlertTitle>{t("refused")}</AlertTitle>
          <AlertDescription>{t("refused-description")}</AlertDescription>
        </Alert>
      ) : null}
      {Arr.map(offered, (connector) => (
        <ConnectorCard
          connection={currentConnection(connections, connector)}
          connector={connector}
          key={connector}
          onConnect={() => onConnect(connector)}
          onDisconnect={onDisconnect}
        />
      ))}
    </div>
  );
}
