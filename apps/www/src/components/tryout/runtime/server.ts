import { FetchClient } from "@repo/utilities/http/client";
import { Clock, DateTime, Duration, Effect, Layer, Option } from "effect";
import {
  FetchHttpClient,
  Headers,
  HttpClient,
  HttpClientRequest,
} from "effect/http";
import { serverClockOffset } from "@/components/exams/sitting/clock";

/** A file the edge answers itself, so the read costs no Worker and the Date header is the edge's clock. */
const CLOCK_PATH = "/robots.txt";

/** How long the read may take; a page without an answer keeps the device's clock. */
const CLOCK_DEADLINE = Duration.seconds(5);

/**
 * The smallest correction worth taking. A Date header counts in whole seconds, so a smaller gap is the
 * header's own rounding, and taking it would only make a good timer jump.
 */
const SMALLEST_OFFSET_MILLIS = 2000;

/** Half of the second a Date header rounds down, as the best guess of the time inside it. */
const HALF_SECOND_MILLIS = 500;

/** The browser's cache would answer with an old Date, so this read skips it. */
const ClockClient = FetchClient.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, { cache: "no-store" })
  )
);

/**
 * The correction that turns this device's clock into the server's, as the School sitting reads it from its
 * admission: a try-out's deadline is the server's, so a device whose clock runs ahead would lock its answers
 * early, and one that runs behind would show time the server no longer gives. Any failure reads as none,
 * because the timer still runs and the server still decides.
 */
export const readServerClockOffset = Effect.fn("tryout.clock.read")(
  function* () {
    const client = yield* HttpClient.HttpClient;
    const sentAt = yield* Clock.currentTimeMillis;
    const response = yield* client.execute(HttpClientRequest.head(CLOCK_PATH));
    const receivedAt = yield* Clock.currentTimeMillis;
    const offset = Headers.get(response.headers, "date").pipe(
      Option.flatMap(DateTime.make),
      Option.map((date) =>
        serverClockOffset({
          receivedAt,
          sentAt,
          serverNow: DateTime.toEpochMillis(date) + HALF_SECOND_MILLIS,
        })
      ),
      Option.filter((value) => Math.abs(value) >= SMALLEST_OFFSET_MILLIS)
    );
    return Option.getOrElse(offset, () => 0);
  },
  (effect) =>
    effect.pipe(
      Effect.timeoutOrElse({
        duration: CLOCK_DEADLINE,
        orElse: () => Effect.succeed(0),
      }),
      Effect.orElseSucceed(() => 0),
      Effect.provide(ClockClient)
    )
);
