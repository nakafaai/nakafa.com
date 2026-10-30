import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  DEVICE_INTERVAL,
  DEVICE_SECONDS,
  DEVICE_TOKEN_SECONDS,
} from "@repo/backend/confect/integrations/schema";
import { createClient, type Fixture } from "@repo/backend/test/api";
import { denied, nf } from "@repo/backend/test/classroom";
import {
  actedAt,
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, String as Str } from "effect";

const devices = refs.internal.integrations.devices;
const { authorize, deny } = refs.public.integrations.devices;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A user code of eight consonants. */
const USER_CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{8}$/;

/** Starts a device authorization for the school `nf`, and answers its codes. */
const started = Effect.fn("test.devices.started")(function* (fixture: Fixture) {
  const answer = yield* fixture.internal.mutation(devices.start, { slug: nf });
  if (answer.outcome !== "started") {
    return yield* Effect.die("The device did not start.");
  }
  return answer;
});

/**
 * When a device whose times the test reads starts: after the setup's commits,
 * since Convex runs each mutation after the commits before it.
 */
const STARTED_AT = actedAt();

/** When a device started at `STARTED_AT` stops being valid. */
const EXPIRED_AT =
  STARTED_AT + Duration.toMillis(Duration.seconds(DEVICE_SECONDS));

/** Sets the clock to `steps` poll intervals after the start, so a poll at each step is not too fast. */
const atStep = (steps: number) =>
  vi.setSystemTime(
    STARTED_AT + steps * Duration.toMillis(Duration.seconds(DEVICE_INTERVAL))
  );

/** The two halves of a user code, as a device shows it. */
const HALVES = /^(.{4})(.{4})$/;

describe("integrations/devices", () => {
  it.effect(
    "starts a device for a school, keeps it pending, slows a fast poll, and issues its client's token once authorized",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        vi.setSystemTime(STARTED_AT);
        const device = yield* started(fixture);
        expect(device).toMatchObject({
          expiresIn: DEVICE_SECONDS,
          interval: DEVICE_INTERVAL,
          verificationUri: "https://nf.nakafa.com/settings/clients",
        });
        expect(device.userCode).toMatch(USER_CODE);
        const poll = () =>
          fixture.internal.mutation(devices.poll, {
            deviceCode: device.deviceCode,
          });
        expect(yield* poll()).toEqual({ outcome: "pending" });
        // Every poll moves the device's poll time, so each poll has its own step.
        atStep(0.5);
        expect(yield* poll()).toEqual({ outcome: "slow_down" });
        atStep(1.5);
        expect(yield* poll()).toEqual({ outcome: "pending" });
        // An Admin may type the code in small letters, with the dash the device shows.
        const typed = Str.replace(
          HALVES,
          "$1-$2"
        )(Str.toLowerCase(device.userCode));
        yield* fixture.as("admin").mutation(authorize, {
          clientId: client.id,
          slug: nf,
          userCode: typed,
        });
        atStep(2);
        const issued = yield* poll();
        expect(issued).toMatchObject({
          expiresIn: DEVICE_TOKEN_SECONDS,
          outcome: "issued",
        });
        const token = issued.outcome === "issued" ? issued.token : "";
        expect(
          yield* fixture.internal.mutation(
            refs.internal.integrations.tokens.check,
            {
              resource: "api",
              token,
            }
          )
        ).toEqual({ clientId: client.id, outcome: "allowed" });
        expect(yield* poll()).toEqual({ outcome: "expired" });
        expect(Arr.last(yield* fixture.run(journal))).toMatchObject({
          _tag: "Some",
          value: {
            change: { client: client.id, type: "integration.authorized" },
            subject: { id: client.id, kind: "integration" },
          },
        });
      })
  );

  it.effect(
    "answers an unknown school, a denied device, and an expired one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        expect(
          yield* fixture.internal.mutation(devices.start, {
            slug: slugOf("nope"),
          })
        ).toEqual({ outcome: "unknown" });
        const refused = yield* started(fixture);
        yield* fixture
          .as("admin")
          .mutation(deny, { slug: nf, userCode: refused.userCode });
        expect(
          yield* fixture.internal.mutation(devices.poll, {
            deviceCode: refused.deviceCode,
          })
        ).toEqual({ outcome: "denied" });
        vi.setSystemTime(STARTED_AT);
        const late = yield* started(fixture);
        vi.setSystemTime(EXPIRED_AT);
        expect(
          yield* fixture.internal.mutation(devices.poll, {
            deviceCode: late.deviceCode,
          })
        ).toEqual({ outcome: "expired" });
        expect(
          yield* fixture.internal.mutation(devices.poll, { deviceCode: "nope" })
        ).toEqual({ outcome: "expired" });
      })
  );

  it.effect(
    "refuses a code that names no pending device, a non-Admin, and a device whose client is revoked before it polls",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        const device = yield* started(fixture);
        for (const userCode of ["12", "BBBBBBBB"]) {
          expect(
            yield* Effect.flip(
              fixture.as("admin").mutation(authorize, {
                clientId: client.id,
                slug: nf,
                userCode,
              })
            )
          ).toMatchObject({ _tag: "DeviceUnknown" });
        }
        expect(
          yield* Effect.flip(
            fixture.as("teacher").mutation(authorize, {
              clientId: client.id,
              slug: nf,
              userCode: device.userCode,
            })
          )
        ).toMatchObject(denied("role"));
        yield* fixture.as("admin").mutation(authorize, {
          clientId: client.id,
          slug: nf,
          userCode: device.userCode,
        });
        expect(
          yield* Effect.flip(
            fixture
              .as("admin")
              .mutation(deny, { slug: nf, userCode: device.userCode })
          )
        ).toMatchObject({ _tag: "DeviceUnknown" });
        yield* fixture
          .as("admin")
          .mutation(refs.public.integrations.clients.revoke, {
            clientId: client.id,
            slug: nf,
          });
        expect(
          yield* fixture.internal.mutation(devices.poll, {
            deviceCode: device.deviceCode,
          })
        ).toEqual({ outcome: "expired" });
        vi.setSystemTime(STARTED_AT);
        const late = yield* started(fixture);
        vi.setSystemTime(EXPIRED_AT);
        expect(
          yield* Effect.flip(
            fixture
              .as("admin")
              .mutation(deny, { slug: nf, userCode: late.userCode })
          )
        ).toMatchObject({ _tag: "DeviceUnknown" });
      })
  );

  it.effect("sweeps expired devices and keeps live ones", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      vi.setSystemTime(STARTED_AT);
      yield* started(fixture);
      vi.setSystemTime(EXPIRED_AT);
      yield* started(fixture);
      expect(yield* fixture.internal.mutation(devices.sweep, {})).toBeNull();
      const rows = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("integrationDevices").index("by_expiresAt").take(10)
        )
      );
      expect(rows).toHaveLength(1);
    })
  );
});
