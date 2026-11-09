import { DateTime, Effect, Fiber, Option } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useIsland } from "@/lib/island/context";
import {
  createSkyStore,
  hourAt,
  phaseAt,
  type SkyStore,
  weatherOf,
} from "@/lib/island/sky";

const SkyContext = createContext<SkyStore | null>(null);

/** The weather request and its Effect HTTP client, loaded only when a read starts (ADR 0039). */
const loadWeather = () => import("@/lib/weather/request");

/** How often the light follows the owner's clock. */
const CLOCK_GAP = 60_000;

/** The light of this moment on the island, from its owner's zone. */
function phaseNow(timeZone: string) {
  // The server stores only zones it decoded as named IANA zones (ADR 0042, D18).
  const zone = DateTime.zoneMakeNamedUnsafe(timeZone);
  return phaseAt(hourAt(DateTime.toEpochMillis(DateTime.nowUnsafe()), zone));
}

/**
 * Gives one island canvas its sky (ADR 0042, D18): the light of the owner's
 * local hour, checked every minute, and, on the owner's own page, the weather
 * their browser reads from the weather route, whose Effect HTTP client loads
 * only then (ADR 0039). A failed read keeps the sky clear, the weather a
 * picture can always show truthfully. The frame provides it, so the canvas and
 * the island's sound read one sky.
 */
export function SkyProvider({ children }: { children: ReactNode }) {
  const { owner, timeZone } = useIsland();
  const [store] = useState(() => createSkyStore(phaseNow(timeZone)));
  const own = Option.isSome(owner);
  useEffect(() => {
    const check = () => store.getState().setPhase(phaseNow(timeZone));
    check();
    const timer = window.setInterval(check, CLOCK_GAP);
    return () => window.clearInterval(timer);
  }, [store, timeZone]);
  useEffect(() => {
    if (!own) {
      return;
    }
    const fiber = Effect.runFork(
      Effect.promise(loadWeather).pipe(
        Effect.flatMap(({ readWeatherSummary }) =>
          Effect.promise(readWeatherSummary)
        ),
        Effect.map((read) =>
          Option.map(
            Option.flatMap(read, (summary) => weatherOf(summary.icon)),
            (weather) => store.getState().setWeather(weather)
          )
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [own, store]);
  return <SkyContext value={store}>{children}</SkyContext>;
}

/** The sky store of the surrounding island canvas, which frames read as they draw. */
export function useSkyStore() {
  const store = use(SkyContext);
  if (!store) {
    throw new Error("useSkyStore must be used within SkyProvider");
  }
  return store;
}
