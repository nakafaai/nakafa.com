import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  type Connection,
  currentConnection,
  disconnectOwnUpdate,
  disconnectSchoolUpdate,
} from "@/components/connectors/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const connectionOf = Schema.decodeUnknownSync(Id("connectorConnections"));

/** One connection of a connector in a state. */
const connection = (
  id: string,
  connector: Connection["connector"],
  status: Connection["status"]
): Connection => ({
  connector,
  createdAt: 1,
  id: connectionOf(id),
  lastSyncedAt: null,
  nextSyncAt: 5,
  scopes: ["openid"],
  status,
});

/** A store that holds the given pages, and records what is written. */
const storeOf = (pages: unknown[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

const calendar = connection("calendar-1", "calendar", "active");
const drive = connection("drive-1", "drive", "active");
const page = (rows: Connection[]) => ({
  args: { paginationOpts: { cursor: null, numItems: 20 } },
  value: Option.some({ isDone: true, page: rows }),
});

describe("connector optimistic updates", () => {
  it("shows a disconnected connection at once in the page that holds it", () => {
    const own = storeOf([
      page([calendar, drive]),
      page([]),
      { args: {}, value: Option.none() },
    ]);
    disconnectOwnUpdate(own.localStore, { connectionId: calendar.id });
    expect(own.setQuery.mock.calls).toEqual([
      [
        connectors.connections.listOwn,
        page([calendar]).args,
        Option.some({
          isDone: true,
          page: [
            { ...calendar, nextSyncAt: null, status: "disconnected" },
            drive,
          ],
        }),
      ],
    ]);
    const school = storeOf([page([drive])]);
    disconnectSchoolUpdate(school.localStore, {
      connectionId: drive.id,
      slug,
    });
    expect(school.setQuery.mock.calls[0]?.[0]).toBe(
      connectors.connections.listSchool
    );
  });

  it("finds a connector's live connection, and none when it ended", () => {
    const ended = connection("calendar-0", "calendar", "disconnected");
    expect(currentConnection([ended, calendar], "calendar")).toEqual(
      Option.some(calendar)
    );
    expect(currentConnection([ended], "calendar")).toEqual(Option.none());
  });
});
