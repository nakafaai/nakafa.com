import { Array as Arr, Option } from "effect";
import { delay } from "motion";
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useRef,
} from "react";

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
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(Arr.copy(parts), { type }));
    link.download = `${fileName}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
    link.click();
    delay(() => URL.revokeObjectURL(link.href), 1);
  };
  copy();
  recorder.start();
  delay(() => recorder.stop(), CLIP_SECONDS);
}

/** Records a few seconds of the frame's island as a video file to share. */
export function useRecordClip(fileName: string) {
  const canvas = useClipCanvas();
  return () => recordClip(canvas.current, fileName);
}
