import { Array as Arr, Option, Record as Rec } from "effect";
import type { createTape } from "@/components/island/tape";
import { Bed } from "@/lib/island/ambience";

/** How far ahead of the audio clock the next round of a loop is laid, in seconds; the mixer looks more often than this. */
const AHEAD = 1;

/** How long a bed that fell silent is still fed, in seconds, so one that comes straight back has no gap. */
const LINGER = 4;

/** How fast a bed moves to a new loudness: the seconds it takes to come about two thirds of the way. */
const EASE = 0.6;

/** The most two rounds of a loop overlap, in seconds, and the share of a short recording they overlap by. */
const OVERLAP = { most: 1.5, share: 0.2 } as const;

/** The points of a fade's curve. */
const FADE = 64;

/** A fade in and a fade out of equal power, so two rounds of a loop that cross are as loud together as one alone. */
const FADES = {
  in: Float32Array.from(
    Arr.makeBy(FADE, (point) => Math.sin((point / (FADE - 1)) * Math.PI * 0.5))
  ),
  out: Float32Array.from(
    Arr.makeBy(FADE, (point) => Math.cos((point / (FADE - 1)) * Math.PI * 0.5))
  ),
};

/**
 * The beds on the audio graph (ADR 0050, W8): each recording looping into
 * its own gain. A loop has no seam: every round fades in over the end of the
 * one before it. A bed's file is fetched only once the bed is first heard,
 * and a bed that stays silent is no longer fed.
 */
export function createBeds(
  audio: AudioContext,
  tape: ReturnType<typeof createTape>,
  out: AudioNode
) {
  const beds = Rec.fromEntries(
    Arr.map(Bed.literals, (name) => {
      const gain = audio.createGain();
      gain.gain.value = 0;
      gain.connect(out);
      // When the bed was last heard and when its next round starts, on the audio clock.
      const bed = { gain, heard: Number.NEGATIVE_INFINITY, next: 0 };
      return [name, bed] as const;
    })
  );

  /** Lays one more round of a bed's loop where the round before it begins to fade. */
  const feed = (bed: (typeof beds)[Bed], buffer: AudioBuffer, now: number) => {
    const over = Math.min(OVERLAP.most, buffer.duration * OVERLAP.share);
    const at = Math.max(bed.next, now + 0.05);
    const end = at + buffer.duration;
    const source = audio.createBufferSource();
    const fade = audio.createGain();
    source.buffer = buffer;
    source.connect(fade).connect(bed.gain);
    fade.gain.setValueCurveAtTime(FADES.in, at, over);
    fade.gain.setValueCurveAtTime(FADES.out, end - over, over);
    source.start(at);
    source.stop(end + 0.05);
    bed.next = end - over;
  };

  return {
    /** Moves every bed toward its loudness and keeps the loops of the ones that are heard running. */
    mix(levels: Record<Bed, number>) {
      const now = audio.currentTime;
      Arr.forEach(Bed.literals, (name) => {
        const bed = beds[name];
        bed.gain.gain.setTargetAtTime(levels[name], now, EASE);
        if (levels[name] > 0.001) {
          bed.heard = now;
        }
        if (now - bed.heard > LINGER || bed.next - now > AHEAD) {
          return;
        }
        Option.map(tape.get(name), (buffer) => feed(bed, buffer, now));
      });
    },
  };
}
