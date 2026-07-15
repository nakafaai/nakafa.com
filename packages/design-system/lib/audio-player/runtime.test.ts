import {
  AudioNetworkState,
  AudioPlayerOperationError,
  type AudioPlayerSnapshot,
  AudioReadyState,
  beginAudioPlayerPlayback,
  createAudioPlayerSnapshot,
  formatAudioPlayerTime,
  InvalidAudioPlayerSourceError,
  pauseAudioPlayer,
  prepareAudioPlayerItem,
  readAudioPlayerSnapshot,
  seekAudioPlayer,
  setAudioPlayerPlaybackRate,
  stabilizeAudioPlayerSnapshot,
} from "@repo/design-system/lib/audio-player/runtime";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_ITEM = {
  id: "lesson-audio",
  src: "https://example.com/lesson.mp3",
};

const TEST_MEDIA_ERROR: MediaError = {
  code: 1,
  message: "Playback aborted.",
  MEDIA_ERR_ABORTED: 1,
  MEDIA_ERR_NETWORK: 2,
  MEDIA_ERR_DECODE: 3,
  MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
};

/** Creates a media element whose unsupported jsdom commands are observable. */
function createAudioElement() {
  const audio = document.createElement("audio");
  const load = vi.spyOn(audio, "load").mockImplementation(() => undefined);
  const pause = vi.spyOn(audio, "pause").mockImplementation(() => undefined);
  const play = vi.spyOn(audio, "play").mockResolvedValue(undefined);

  return { audio, load, pause, play };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("audio player state", () => {
  it("formats sub-hour and hour-long positions", () => {
    expect(formatAudioPlayerTime(5)).toBe("0:05");
    expect(formatAudioPlayerTime(75)).toBe("1:15");
    expect(formatAudioPlayerTime(605)).toBe("10:05");
    expect(formatAudioPlayerTime(3665)).toBe("1:01:05");
  });

  it("creates and reads one complete browser snapshot", () => {
    expect(createAudioPlayerSnapshot()).toEqual({
      activeItem: null,
      duration: undefined,
      error: null,
      networkState: AudioNetworkState.NETWORK_EMPTY,
      paused: true,
      playbackRate: 1,
      readyState: AudioReadyState.HAVE_NOTHING,
      time: 0,
    });

    const { audio } = createAudioElement();
    Object.defineProperties(audio, {
      duration: { configurable: true, value: 90 },
      error: { configurable: true, value: TEST_MEDIA_ERROR },
      networkState: {
        configurable: true,
        value: AudioNetworkState.NETWORK_LOADING,
      },
      paused: { configurable: true, value: false },
      readyState: {
        configurable: true,
        value: AudioReadyState.HAVE_FUTURE_DATA,
      },
    });
    audio.currentTime = 12;
    audio.playbackRate = 1.5;

    expect(readAudioPlayerSnapshot(audio, TEST_ITEM)).toEqual({
      activeItem: TEST_ITEM,
      duration: 90,
      error: TEST_MEDIA_ERROR,
      networkState: AudioNetworkState.NETWORK_LOADING,
      paused: false,
      playbackRate: 1.5,
      readyState: AudioReadyState.HAVE_FUTURE_DATA,
      time: 12,
    });
  });

  it("preserves identity only when every snapshot value is unchanged", () => {
    const current = createAudioPlayerSnapshot();
    const equal = { ...current };
    const changes: AudioPlayerSnapshot[] = [
      { ...current, activeItem: TEST_ITEM },
      { ...current, duration: 10 },
      { ...current, error: TEST_MEDIA_ERROR },
      { ...current, networkState: AudioNetworkState.NETWORK_IDLE },
      { ...current, paused: false },
      { ...current, playbackRate: 1.5 },
      { ...current, readyState: AudioReadyState.HAVE_METADATA },
      { ...current, time: 1 },
    ];

    expect(stabilizeAudioPlayerSnapshot(current, equal)).toBe(current);
    for (const changed of changes) {
      expect(stabilizeAudioPlayerSnapshot(current, changed)).toBe(changed);
    }
  });
});

describe("audio player commands", () => {
  it("prepares valid and empty items without changing playback speed", () => {
    const loaded = createAudioElement();
    loaded.audio.playbackRate = 1.5;

    Effect.runSync(prepareAudioPlayerItem(loaded.audio, TEST_ITEM));

    expect(loaded.audio.src).toBe(TEST_ITEM.src);
    expect(loaded.audio.currentTime).toBe(0);
    expect(loaded.audio.playbackRate).toBe(1.5);
    expect(loaded.pause).not.toHaveBeenCalled();
    expect(loaded.load).toHaveBeenCalledOnce();

    const cleared = createAudioElement();
    cleared.audio.setAttribute("src", TEST_ITEM.src);
    Object.defineProperty(cleared.audio, "paused", {
      configurable: true,
      value: false,
    });

    Effect.runSync(prepareAudioPlayerItem(cleared.audio, null));

    expect(cleared.pause).toHaveBeenCalledOnce();
    expect(cleared.audio.hasAttribute("src")).toBe(false);
    expect(cleared.load).toHaveBeenCalledOnce();
  });

  it("rejects empty sources through a schema-tagged failure", () => {
    const { audio } = createAudioElement();
    const error = Effect.runSync(
      prepareAudioPlayerItem(audio, { id: 42, src: "   " }).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(InvalidAudioPlayerSourceError);
    expect(error).toMatchObject({
      _tag: "InvalidAudioPlayerSourceError",
      itemId: 42,
      message: 'Audio item "42" has an empty source.',
    });
  });

  it("maps source preparation failures into the typed operation channel", () => {
    const cause = new Error("Media loading is unavailable.");
    const { audio, load } = createAudioElement();
    load.mockImplementation(() => {
      throw cause;
    });

    const error = Effect.runSync(
      prepareAudioPlayerItem(audio, TEST_ITEM).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(AudioPlayerOperationError);
    expect(error).toMatchObject({
      _tag: "AudioPlayerOperationError",
      cause,
      message: 'Audio player operation "prepare-item" failed.',
      operation: "prepare-item",
    });
  });

  it("awaits the exact browser playback request", () => {
    const { audio, play } = createAudioElement();

    return Effect.runPromise(
      Effect.gen(function* () {
        const pendingPlayback = yield* beginAudioPlayerPlayback(audio);
        yield* pendingPlayback;
        expect(play).toHaveBeenCalledOnce();
      })
    );
  });

  it("maps synchronous and asynchronous playback failures", () => {
    const synchronousCause = new Error("Playback cannot start.");
    const synchronous = createAudioElement();
    synchronous.play.mockImplementation(() => {
      throw synchronousCause;
    });

    const synchronousError = Effect.runSync(
      beginAudioPlayerPlayback(synchronous.audio).pipe(Effect.flip)
    );
    expect(synchronousError).toMatchObject({
      cause: synchronousCause,
      operation: "play",
    });

    const asynchronousCause = new Error("Playback permission denied.");
    const asynchronous = createAudioElement();
    asynchronous.play.mockRejectedValue(asynchronousCause);

    return Effect.runPromise(
      Effect.gen(function* () {
        const pendingPlayback = yield* beginAudioPlayerPlayback(
          asynchronous.audio
        );
        const asynchronousError = yield* pendingPlayback.pipe(Effect.flip);
        expect(asynchronousError).toMatchObject({
          cause: asynchronousCause,
          operation: "play",
        });
      })
    );
  });

  it("applies pause, seek, and speed commands", () => {
    const { audio, pause } = createAudioElement();

    Effect.runSync(pauseAudioPlayer(audio));
    Effect.runSync(seekAudioPlayer(audio, 24));
    Effect.runSync(setAudioPlayerPlaybackRate(audio, 1.75));

    expect(pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(24);
    expect(audio.playbackRate).toBe(1.75);
  });

  it("maps pause, seek, and speed failures by operation", () => {
    const pauseCause = new Error("Pause failed.");
    const paused = createAudioElement();
    paused.pause.mockImplementation(() => {
      throw pauseCause;
    });
    expect(
      Effect.runSync(pauseAudioPlayer(paused.audio).pipe(Effect.flip))
    ).toMatchObject({ cause: pauseCause, operation: "pause" });

    const seekCause = new Error("Seek failed.");
    const seeked = createAudioElement();
    Object.defineProperty(seeked.audio, "currentTime", {
      configurable: true,
      get: () => 0,
      set: () => {
        throw seekCause;
      },
    });
    expect(
      Effect.runSync(seekAudioPlayer(seeked.audio, 10).pipe(Effect.flip))
    ).toMatchObject({ cause: seekCause, operation: "seek" });

    const rateCause = new Error("Rate failed.");
    const rated = createAudioElement();
    Object.defineProperty(rated.audio, "playbackRate", {
      configurable: true,
      get: () => 1,
      set: () => {
        throw rateCause;
      },
    });
    expect(
      Effect.runSync(
        setAudioPlayerPlaybackRate(rated.audio, 2).pipe(Effect.flip)
      )
    ).toMatchObject({
      cause: rateCause,
      operation: "set-playback-rate",
    });
  });
});
