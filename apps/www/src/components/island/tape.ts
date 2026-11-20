import { FetchClient } from "@repo/utilities/http/client";
import { Effect, MutableHashMap, Option } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import type { Recording, Shot } from "@/lib/island/tape";
import { addressOf } from "@/lib/island/tape";

/**
 * Reads one recording and decodes it for an audio context, none when the
 * file is missing, the network fails or the browser cannot decode it. The
 * game loads this module at the learner's first press, and the module
 * provides its own client, so the game's first JavaScript holds no HTTP
 * client.
 */
const readRecording = Effect.fn("www.island.readRecording")(
  function* (audio: AudioContext, recording: Recording) {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client
      .get(addressOf(recording))
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
    const bytes = yield* response.arrayBuffer;
    return yield* Effect.tryPromise(() => audio.decodeAudioData(bytes));
  },
  Effect.option,
  Effect.provide(FetchClient)
);

/**
 * The world's recordings in memory (ADR 0050, W8): each file is fetched the
 * first time something asks for it, decoded once and kept. A recording that
 * has not arrived, or never will, is silent: nothing waits for it and nothing
 * fails.
 */
export function createTape(audio: AudioContext) {
  // Every recording asked for so far: none while it loads and when it could not be read.
  const held = MutableHashMap.empty<Recording, Option.Option<AudioBuffer>>();

  /** Starts reading a recording unless it was asked for before. */
  const ask = (recording: Recording) => {
    if (MutableHashMap.has(held, recording)) {
      return;
    }
    MutableHashMap.set(held, recording, Option.none());
    Effect.runPromise(readRecording(audio, recording)).then((buffer) => {
      MutableHashMap.set(held, recording, buffer);
    });
  };

  /** A recording once it is decoded, asking for it when nothing has yet. */
  const get = (recording: Recording) => {
    ask(recording);
    return Option.flatten(MutableHashMap.get(held, recording));
  };

  return {
    ask,
    get,
    /** Plays one shot into `out`, `when` on the audio clock; silent while its recording has not arrived. */
    play(shot: Shot, out: AudioNode, when = audio.currentTime) {
      Option.map(get(shot.file), (buffer) => {
        const at = when + shot.delay;
        const source = audio.createBufferSource();
        const gain = audio.createGain();
        const pan = audio.createStereoPanner();
        source.buffer = buffer;
        source.playbackRate.value = shot.rate;
        gain.gain.value = shot.loud;
        pan.pan.value = shot.pan;
        source.connect(gain).connect(pan).connect(out);
        source.start(at);
        if (shot.cut > 0) {
          // A cut shot holds its loudness, then fades to nothing by the cut.
          gain.gain.setValueAtTime(shot.loud, at + shot.cut * 0.6);
          gain.gain.linearRampToValueAtTime(0, at + shot.cut);
          source.stop(at + shot.cut + 0.02);
        }
      });
    },
  };
}
