import { unitOf } from "@/lib/island/noise";
import type { Recording } from "@/lib/island/tape";
import { addressOf } from "@/lib/island/tape";

/** The recorded pieces, played in turn. */
const PIECES = ["music-piano", "music-guitar"] as const satisfies Recording[];

/** The quiet before the first piece and between two pieces, in seconds: a wait, and up to as much again by the piece's turn. */
const QUIET = { between: 8, first: 6, more: 14 } as const;

/**
 * The world's music (ADR 0050, W8): two recorded pieces played in turn with
 * a long quiet between them, streamed by the browser as they play, so
 * nothing of them is fetched before the first one starts. A piece that
 * cannot be read or played leaves the music silent and the game untouched.
 */
export function createMusic(audio: AudioContext, out: AudioNode) {
  const player = new Audio();
  player.preload = "none";
  audio.createMediaElementSource(player).connect(out);
  let turn = 0;
  let playing = false;
  let resumeAt = audio.currentTime + QUIET.first;
  const rest = () => {
    playing = false;
    resumeAt =
      audio.currentTime + QUIET.between + unitOf(97, turn) * QUIET.more;
  };
  // A piece that cannot be read is not tried again: the music stays silent.
  const fail = () => {
    playing = false;
    resumeAt = Number.POSITIVE_INFINITY;
  };
  // A piece the browser would not start, as when a pause cut in, is tried again after a while.
  const retry = () => {
    playing = false;
    resumeAt = audio.currentTime + QUIET.between;
  };
  player.addEventListener("ended", rest);
  player.addEventListener("error", fail);
  return {
    /** Stops the piece where it is, as when the page is hidden. */
    pause() {
      player.pause();
    },
    /** Starts the next piece once the quiet before it is over, and takes a paused piece up again. */
    play() {
      if (playing) {
        if (player.paused) {
          player.play().catch(retry);
        }
        return;
      }
      if (audio.currentTime < resumeAt) {
        return;
      }
      playing = true;
      player.src = addressOf(PIECES[turn % PIECES.length]);
      turn += 1;
      player.play().catch(retry);
    },
    /** Ends the music for good. */
    stop() {
      player.removeEventListener("ended", rest);
      player.removeEventListener("error", fail);
      player.pause();
      player.removeAttribute("src");
    },
  };
}
