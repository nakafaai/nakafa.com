import {
  DEFAULT_MAX_AUDIO_CONTENT_PER_DAY,
  MAX_AUDIO_CONTENT_PER_DAY_LIMIT,
} from "@repo/backend/confect/modules/content/audioGeneration.constants";
import { Config, Effect } from "effect";

/** Parses the daily audio content limit from Convex environment variables. */
function getMaxContentPerDay(envValue: string) {
  const trimmed = envValue.trim();

  if (!trimmed) {
    return DEFAULT_MAX_AUDIO_CONTENT_PER_DAY;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_MAX_AUDIO_CONTENT_PER_DAY;
  }

  return Math.max(1, Math.min(MAX_AUDIO_CONTENT_PER_DAY_LIMIT, parsed));
}

/** Environment values used by audio generation queue scheduling. */
export const readAudioGenerationEnvironment = Effect.fn(
  "audioGeneration.readEnvironment"
)(function* () {
  const enabled = yield* Config.string("ENABLE_AUDIO_GENERATION").pipe(
    Config.withDefault("false"),
    Effect.map((value) => value === "true")
  );
  const maxContentPerDay = yield* Config.string(
    "LIMIT_AUDIO_GENERATION_PER_DAY"
  ).pipe(Config.withDefault(""), Effect.map(getMaxContentPerDay));

  return { enabled, maxContentPerDay };
});
