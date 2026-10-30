import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  connect,
  destroySecret,
} from "@repo/backend/confect/connectors/connection";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

/** The fetch that the token refresh calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const { pickerToken } = refs.public.connectors.drive;

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Google answering every refresh with `answer`. */
const refreshWith = (answer: Response) =>
  fetcher.mockImplementation(() => Promise.resolve(answer.clone()));

/** A personal connection of the student to a connector, stored as `connect` stores it. */
const connectionOf = (
  fixture: Effect.Success<typeof tenancyFixture>,
  connector: "calendar" | "drive"
) =>
  fixture.run(
    Effect.gen(function* () {
      const person = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(fixture.people.student.personId);
      if (person.account.state !== "claimed") {
        return yield* Effect.die("The student holds an account.");
      }
      const userId = person.account.userId;
      return yield* connect(
        { id: userId, kind: "user" },
        { kind: "personal", userId },
        {
          connector,
          googleSubject: "subject-1",
          refreshToken: `refresh-${connector}`,
          scopes: ["openid"],
        }
      );
    }).pipe(Effect.orDie)
  );

/** The status of a stored connection. */
const statusOf = (connectionId: GenericId.GenericId<"connectorConnections">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("connectorConnections").get(connectionId).pipe(Effect.orDie)
  ).pipe(Effect.map((row) => row.status));

describe("connectors/drive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
    vi.stubEnv("GOOGLE_CONNECTORS", "calendar,drive");
    vi.stubEnv(
      "GOOGLE_CONNECTOR_CLIENT_ID",
      "972685787969-test.apps.googleusercontent.com"
    );
    vi.stubEnv("GOOGLE_PICKER_API_KEY", "picker-key");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "gives no Picker token to an account without Drive, and a fresh one refreshed from the Drive connection's own token",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        yield* connectionOf(fixture, "calendar");
        expect(yield* student.action(pickerToken, {})).toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
        yield* connectionOf(fixture, "drive");
        refreshWith(
          json(200, { access_token: "access", expires_in: 3599, scope: "" })
        );
        expect(yield* student.action(pickerToken, {})).toEqual({
          accessToken: "access",
          apiKey: "picker-key",
          appId: "972685787969",
        });
        const [, init] = fetcher.mock.calls[0] ?? [];
        expect(String(init?.body)).toContain("refresh_token=refresh-drive");
      })
  );

  it.effect(
    "moves a Drive connection whose token Google refuses to reconnect, keeps one Google failed on otherwise, and refuses Drive turned off or without the Picker's key",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        const connectionId = yield* connectionOf(fixture, "drive");
        refreshWith(json(500, { error: "server_error" }));
        expect(
          yield* student.action(pickerToken, {}).pipe(Effect.flip)
        ).toMatchObject({ _tag: "GoogleFailed" });
        expect(yield* fixture.run(statusOf(connectionId))).toBe("active");
        vi.stubEnv("GOOGLE_CONNECTORS", "calendar");
        expect(
          yield* student.action(pickerToken, {}).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
        vi.stubEnv("GOOGLE_CONNECTORS", "drive");
        vi.stubEnv("GOOGLE_PICKER_API_KEY", undefined);
        expect(
          yield* student.action(pickerToken, {}).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
        vi.stubEnv("GOOGLE_PICKER_API_KEY", "picker-key");
        vi.stubEnv("GOOGLE_CONNECTORS", "drive");
        refreshWith(json(400, { error: "invalid_grant" }));
        expect(
          yield* student.action(pickerToken, {}).pipe(Effect.flip)
        ).toMatchObject({ _tag: "GoogleFailed", reason: "revoked" });
        expect(yield* fixture.run(statusOf(connectionId))).toBe("reconnect");
        expect(yield* student.action(pickerToken, {})).toBeNull();
      })
  );

  it.effect("reads no Drive whose token is gone", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const connectionId = yield* connectionOf(fixture, "drive");
      yield* fixture.run(destroySecret(connectionId));
      expect(yield* fixture.as("student").action(pickerToken, {})).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});
