import { Array as Arr, Effect, Option } from "effect";
import { delay } from "motion";
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useRef,
} from "react";
import { RAMPS } from "@/lib/island/palette";

const ClipContext = createContext<RefObject<HTMLCanvasElement | null> | null>(
  null
);

/** Seconds a clip of the island runs, and the height it is drawn at, in video pixels at most. */
const CLIP_SECONDS = 6;
const CLIP_HEIGHT = 1080;

/** The video formats a clip is recorded in, the first one the browser can write. */
const CLIP_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm",
  "video/mp4",
] as const;

/** Holds the island canvas of one frame, so the frame can record what it draws. */
export function ClipProvider({ children }: { children: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  return <ClipContext value={canvas}>{children}</ClipContext>;
}

/** The slot the frame's island canvas keeps itself in. */
export function useClipCanvas() {
  const canvas = use(ClipContext);
  if (!canvas) {
    throw new Error("useClipCanvas must be used within ClipProvider");
  }
  return canvas;
}

/**
 * Records a short clip of a canvas and saves it (ADR 0042, D20): its pixels
 * enlarged by a whole number with no smoothing, so every art pixel stays
 * square, recorded for a few seconds and saved as a video file. A browser that
 * records no video, or a canvas that is not there yet, records nothing.
 */
function recordClip(source: HTMLCanvasElement | null, fileName: string) {
  const written = Arr.findFirst(CLIP_TYPES, (candidate) =>
    MediaRecorder.isTypeSupported(candidate)
  );
  if (source === null || Option.isNone(written)) {
    return;
  }
  const type = written.value;
  const scale = Math.max(1, Math.floor(CLIP_HEIGHT / source.height));
  const film = document.createElement("canvas");
  film.width = source.width * scale;
  film.height = source.height * scale;
  const pen = film.getContext("2d");
  if (pen === null) {
    return;
  }
  pen.imageSmoothingEnabled = false;
  const recorder = new MediaRecorder(film.captureStream(30), {
    mimeType: type,
  });
  let parts: readonly Blob[] = [];
  let frame = 0;
  const copy = () => {
    pen.drawImage(source, 0, 0, film.width, film.height);
    frame = requestAnimationFrame(copy);
  };
  recorder.ondataavailable = (event) => {
    parts = Arr.append(parts, event.data);
  };
  recorder.onstop = () => {
    cancelAnimationFrame(frame);
    const url = URL.createObjectURL(new Blob(Arr.copy(parts), { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
    link.click();
    URL.revokeObjectURL(url);
  };
  copy();
  recorder.start();
  delay(() => recorder.stop(), CLIP_SECONDS);
}

/** The size of a snapshot: the social card every network shows. */
const SNAPSHOT_WIDTH = 1200;
const SNAPSHOT_HEIGHT = 630;

/** The sky a snapshot's island floats in: the palette's pale day sky. */
const SNAPSHOT_SKY = RAMPS.sky.tones[2];

/**
 * Draws the frame's island as its snapshot, the OpenGraph image of a visit
 * (ADR 0042, D20): its pixels enlarged by the largest whole number that fits
 * the social card, with no smoothing, centred over the day sky, as a PNG. A
 * canvas that is not there yet, or a browser that draws no PNG, gives none.
 */
function drawSnapshot(source: HTMLCanvasElement | null) {
  return Effect.callback<Option.Option<Blob>>((resume) => {
    const card = document.createElement("canvas");
    card.width = SNAPSHOT_WIDTH;
    card.height = SNAPSHOT_HEIGHT;
    const pen = card.getContext("2d");
    if (source === null || source.width === 0 || pen === null) {
      resume(Effect.succeedNone);
      return;
    }
    const scale = Math.max(
      1,
      Math.floor(
        Math.min(SNAPSHOT_WIDTH / source.width, SNAPSHOT_HEIGHT / source.height)
      )
    );
    const width = source.width * scale;
    const height = source.height * scale;
    pen.imageSmoothingEnabled = false;
    pen.fillStyle = SNAPSHOT_SKY;
    pen.fillRect(0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);
    pen.drawImage(
      source,
      Math.floor((SNAPSHOT_WIDTH - width) / 2),
      Math.floor((SNAPSHOT_HEIGHT - height) / 2),
      width,
      height
    );
    card.toBlob(
      (blob) => resume(Effect.succeed(Option.fromNullishOr(blob))),
      "image/png"
    );
  });
}

/** Records a few seconds of the frame's island as a video file to share. */
export function useRecordClip(fileName: string) {
  const canvas = useClipCanvas();
  return () => recordClip(canvas.current, fileName);
}

/** Draws the frame's island as its snapshot, when its canvas is there. */
export function useSnapshot() {
  const canvas = useClipCanvas();
  return () => drawSnapshot(canvas.current);
}
