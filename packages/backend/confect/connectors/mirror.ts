import type { GenericId } from "@confect/core";
import type { VaultField } from "@repo/backend/confect/vault/schema";

/** The sealed field of a mirrored event's title, bound to its connection and its event (ADR 0030). */
export const eventTitleField = (
  connectionId: GenericId.GenericId<"connectorConnections">,
  eventId: string
) =>
  ({
    field: "sealedTitle",
    row: [connectionId, eventId],
    table: "connectorEvents",
  }) satisfies typeof VaultField.Type;
