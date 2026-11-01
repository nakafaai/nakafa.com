import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  type Connection,
  currentConnection,
} from "@/components/connectors/optimistic";
import { TableEmpty } from "@/components/shared/table/frame";
import { ConnectorCard } from "@/components/user/settings/connector";

/**
 * The Google connectors an owner may connect, one card each, with the state of the
 * owner's connection. A deployment that offers no connector shows that instead.
 */
export function ConnectorList({
  connections,
  offered,
}: {
  connections: readonly Connection[];
  offered: readonly GoogleConnector[];
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
      {Arr.map(offered, (connector) => (
        <ConnectorCard
          connection={currentConnection(connections, connector)}
          connector={connector}
          key={connector}
        />
      ))}
    </div>
  );
}
