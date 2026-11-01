import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import {
  DIRECTORY_SERVICES,
  directoryState,
  holderOf,
  matchesSearch,
  serviceConnection,
} from "@/components/connectors/directory";
import type { Connection } from "@/components/connectors/optimistic";

/** One connection of the given service and status. */
const connection = (
  connector: Connection["connector"],
  status: Connection["status"]
): Connection => ({
  connector,
  createdAt: 1,
  id: Schema.decodeUnknownSync(Id("connectorConnections"))(`row-${connector}`),
  lastSyncedAt: null,
  nextSyncAt: null,
  scopes: [],
  status,
});

const open = {
  connection: Option.none(),
  isOffered: true,
  failure: Option.none(),
  mayConnect: true,
};

describe("connector directory", () => {
  it("lets a connection decide, so a service no longer offered can still be ended", () => {
    expect(
      directoryState({
        ...open,
        connection: Option.some(connection("classroom", "active")),
        isOffered: false,
        mayConnect: false,
      })
    ).toBe("connected");
    expect(
      directoryState({
        ...open,
        connection: Option.some(connection("classroom", "reconnect")),
      })
    ).toBe("reconnect");
  });

  it("waits for an offer, then for permission, then says how the last connect ended", () => {
    expect(directoryState(open)).toBe("open");
    expect(directoryState({ ...open, failure: Option.some("refused") })).toBe(
      "refused"
    );
    expect(directoryState({ ...open, failure: Option.some("failed") })).toBe(
      "failed"
    );
    expect(directoryState({ ...open, mayConnect: false })).toBe("locked");
    expect(
      directoryState({ ...open, isOffered: false, mayConnect: false })
    ).toBe("soon");
  });

  it("keeps the school's Classroom apart from the person's Drive, and reads Forms through Drive", () => {
    const [classroom, forms] = DIRECTORY_SERVICES;
    const held = {
      own: [connection("drive", "active")],
      school: [connection("classroom", "active")],
    };
    expect(holderOf(classroom)).toBe("school");
    expect(holderOf(forms)).toBe("personal");
    expect(serviceConnection(classroom, held)).toEqual(
      Option.some(held.school[0])
    );
    expect(serviceConnection(forms, held)).toEqual(Option.some(held.own[0]));
    expect(serviceConnection(forms, { own: [], school: held.own })).toEqual(
      Option.none()
    );
  });

  it("finds a service by any of its words, in any case, and every service without a search", () => {
    expect(matchesSearch("  CLASS ", ["Google Classroom"])).toBe(true);
    expect(matchesSearch("", ["Google Drive"])).toBe(true);
    expect(matchesSearch("zoom", ["Google Drive", "Files"])).toBe(false);
  });
});
