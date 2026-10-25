import { describe, expect, it } from "@effect/vitest";
import { acceptanceOrigin } from "@repo/backend/scripts/content/acceptance/origin";
import { ConfigProvider, Effect } from "effect";

/** Reads the origin from a fake environment, with no other configuration. */
const originFrom = (env: Readonly<Record<string, string>>) =>
  acceptanceOrigin.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(env)
    )
  );

describe("acceptance app origin", () => {
  it.effect("serves localhost on port 3000 when no port is named", () =>
    Effect.gen(function* () {
      expect(yield* originFrom({})).toBe("http://localhost:3000");
      // The environment provider reads an empty value as an unset one.
      expect(yield* originFrom({ ACCEPTANCE_PORT: "" })).toBe(
        "http://localhost:3000"
      );
    })
  );

  it.effect("serves localhost on the port that ACCEPTANCE_PORT names", () =>
    Effect.gen(function* () {
      expect(yield* originFrom({ ACCEPTANCE_PORT: "3100" })).toBe(
        "http://localhost:3100"
      );
    })
  );

  for (const port of ["0", "65536", "3100.5", "web"]) {
    it.effect(`refuses ACCEPTANCE_PORT "${port}"`, () =>
      Effect.gen(function* () {
        expect(
          yield* originFrom({ ACCEPTANCE_PORT: port }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: "ACCEPTANCE_PORT must name a port from 1 to 65535.",
        });
      })
    );
  }
});
