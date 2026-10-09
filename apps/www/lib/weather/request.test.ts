import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Option, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import {
  createWeatherReader,
  readWeatherSummary,
  requestWeatherSummary,
} from "@/lib/weather/request";

const summary = {
  city: "Jakarta",
  condition: "light rain",
  country: "ID",
  countryName: "Indonesia",
  icon: "10d",
  temperatureKelvin: 300.4,
};

const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

beforeEach(() => {
  fetcher.mockReset();
});

describe("createWeatherReader", () => {
  it("shares one request across reads less than a minute apart", () => {
    let now = 0;
    const load = vi.fn(() => Promise.resolve(Option.some(summary)));
    const read = createWeatherReader({ load, now: () => now });

    const first = read();
    now = 59_999;
    const second = read();

    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("starts a new request once the shared one is a minute old", () => {
    let now = 0;
    const load = vi.fn(() => Promise.resolve(Option.some(summary)));
    const read = createWeatherReader({ load, now: () => now });

    read();
    now = 60_000;
    read();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not share a request that failed", async () => {
    const load = vi.fn(() => Promise.resolve(Option.none()));
    const read = createWeatherReader({ load, now: () => 0 });

    await read();
    await read();

    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("requestWeatherSummary", () => {
  it.effect("posts once to the app route and decodes the summary", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(async () => Response.json(summary));

      const result = yield* requestWeatherSummary().pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );

      expect(result).toEqual(summary);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0] ?? [];
      expect(String(url)).toContain("/api/weather");
      expect(init?.method).toBe("POST");
    })
  );

  it.effect("retries a failing route three times, then fails", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(
        async () => new Response("unavailable", { status: 503 })
      );

      const resultFiber = yield* requestWeatherSummary().pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetcher),
        Effect.result,
        Effect.forkChild
      );
      yield* TestClock.adjust("7 seconds");
      const result = yield* Fiber.join(resultFiber);

      expect(Result.isFailure(result)).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(4);
    })
  );
});

describe("readWeatherSummary", () => {
  it("requests the route once and shares the summary across reads", async () => {
    fetcher.mockImplementation(async () => Response.json(summary));

    const first = readWeatherSummary();
    const second = readWeatherSummary();

    expect(second).toBe(first);
    expect(await first).toEqual(Option.some(summary));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
