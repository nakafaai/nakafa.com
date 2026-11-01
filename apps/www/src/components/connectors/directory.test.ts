import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import {
  ACCOUNT_SERVICES,
  DIRECTORY_SERVICES,
  directoryCategories,
  directoryEntries,
  directoryState,
  holderOf,
  isShown,
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
    const classroom = DIRECTORY_SERVICES[0];

    expect(
      isShown(classroom, Option.none(), "  CLASS ", ["Google Classroom"])
    ).toBe(true);
    expect(isShown(classroom, Option.none(), "", ["Google Classroom"])).toBe(
      true
    );
    expect(
      isShown(classroom, Option.none(), "zoom", ["Google Classroom", "Files"])
    ).toBe(false);
  });

  it("keeps a service of the chosen category, and offers each category once", () => {
    const classroom = DIRECTORY_SERVICES[0];

    expect(
      isShown(classroom, Option.some("learning"), "", ["Google Classroom"])
    ).toBe(true);
    expect(
      isShown(classroom, Option.some("files"), "", ["Google Classroom"])
    ).toBe(false);
    expect(directoryCategories(DIRECTORY_SERVICES)).toEqual([
      "learning",
      "files",
      "schedule",
    ]);
  });

  it("lists on an account what a person holds, without the school's Classroom or its Forms", () => {
    expect(ACCOUNT_SERVICES.map(({ key }) => key)).toEqual([
      "drive",
      "calendar",
    ]);
    expect(directoryCategories(ACCOUNT_SERVICES)).toEqual([
      "files",
      "schedule",
    ]);
  });

  it("draws an entry before the reads answer, and gives it a state once they do", () => {
    const read = {
      held: { own: [connection("drive", "active")], school: [] },
      mayConnectSchool: false,
      offered: ["calendar", "classroom", "drive"] as const,
      services: DIRECTORY_SERVICES,
      tried: { connect: "refused", connector: "calendar" } as const,
    };

    expect(
      directoryEntries({ ...read, hasRead: false }).map(({ state }) => state)
    ).toEqual([Option.none(), Option.none(), Option.none(), Option.none()]);
    expect(
      directoryEntries({ ...read, hasRead: true }).map(({ state }) => state)
    ).toEqual([
      Option.some("locked"),
      Option.some("connected"),
      Option.some("connected"),
      Option.some("refused"),
    ]);
    expect(
      directoryEntries({
        ...read,
        hasRead: true,
        mayConnectSchool: true,
      }).map(({ state }) => state)[0]
    ).toEqual(Option.some("open"));
  });
});
