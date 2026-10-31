import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { connect } from "@repo/backend/confect/connectors/connection";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

/** The fetch that the token refresh calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const { questions } = refs.public.connectors.forms;

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Google answering a token refresh, and then the form with `form`. */
const googleWith = (form: object) =>
  fetcher.mockImplementation((url) =>
    Promise.resolve(
      String(url).startsWith("https://forms.googleapis.com/")
        ? json(200, form)
        : json(200, { access_token: "access-1", expires_in: 3600 })
    )
  );

/** A personal connection of the student to a connector, stored as `connect` stores it. */
const connectionOf = (
  fixture: Effect.Success<typeof tenancyFixture>,
  connector: "drive"
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

describe("connectors/forms", () => {
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

  it.effect("reads a picked form through the teacher's Drive connection", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* connectionOf(fixture, "drive");
      googleWith({
        items: [
          {
            questionItem: {
              question: {
                choiceQuestion: {
                  options: [{ value: "3" }, { value: "4" }],
                  type: "RADIO",
                },
              },
            },
            title: "2 + 2?",
          },
        ],
      });

      expect(
        yield* fixture.as("student").action(questions, { formId: "form-1" })
      ).toMatchObject([{ answer: null, options: ["3", "4"], prompt: "2 + 2?" }]);
    })
  );

  it.effect("gives an account without Drive no questions", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;

      expect(
        yield* fixture.as("student").action(questions, { formId: "form-1" })
      ).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});
