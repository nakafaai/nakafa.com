import { Id } from "@repo/backend/confect/_generated/id";
import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Array as Arr, Option, Schema } from "effect";

/** The kinds of audio a question holds, which a file's leading bytes name. */
export const AudioType = Schema.Literals([
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);
export type AudioType = typeof AudioType.Type;

/**
 * The most bytes one clip may hold: 3 MB, about eight minutes of spoken audio at 48 kbps, longer than a listening
 * question asks. Measured against Convex on 31 Oct 2026: 2.4 GB of the plan's 50 GB of egress in the 19 days from
 * 12 Oct, and 3.1 MB of its 100 GB of file storage. At this limit an exam of three clips for 3,000 students costs at
 * most 27 GB of egress, one such exam a month inside the plan, and each listen after a student's first comes
 * from the browser's cache.
 */
export const AUDIO_BYTE_LIMIT = 3 * 1024 * 1024;

/** The most media one question holds. */
export const MEDIA_MAX = 3;

/** The most characters of the words that say what a clip holds. */
const MEDIA_ALT_MAX = 500;

/** The ID of a YouTube video, which the paper embeds. */
const VIDEO_ID = /^[\w-]{11}$/u;

/** The address parts that lead the same host: the phone's and the bare one. */
const HOST_PREFIX = /^(?:www\.|m\.)/u;

/** The address parts that lead a video's ID in a link with no `v` in its query. */
const PATH_PREFIX = /^\/(?:embed|shorts)\//u;

/** The stored fields of one audio clip of an exam. */
export const examAudioValidator = Schema.Struct({
  byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
  contentType: AudioType,
  createdAt: Schema.Finite,
  createdBy: Id("users"),
  examId: Id("exams"),
  storageId: Id("_storage"),
  tenantId: Id("tenants"),
});

/** Words that say what a clip holds, for a student who cannot hear or see it. */
const MediaAlt = Schema.Trimmed.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MEDIA_ALT_MAX)
);

/** One clip of a question as a teacher's video link names it. */
const VideoMedia = Schema.Struct({
  alt: MediaAlt,
  kind: Schema.Literal("video"),
  video: Schema.String.check(Schema.isPattern(VIDEO_ID)),
});

/**
 * One piece of media of a question: an audio clip the teacher uploaded, or a video by its link. Media stands
 * beside a question's documents and not in them, because the contract's document holds no such block.
 */
export const QuestionMedia = Schema.Union([
  Schema.Struct({
    alt: MediaAlt,
    asset: Id("examAudio"),
    kind: Schema.Literal("audio"),
  }),
  VideoMedia,
]);
export type QuestionMedia = typeof QuestionMedia.Type;

/** The media of a question, as the student's paper plays it. */
export const PlayableMedia = Schema.Union([
  Schema.Struct({
    alt: Schema.String,
    kind: Schema.Literal("audio"),
    url: Schema.String,
  }),
  VideoMedia,
]);

/** A file over `AUDIO_BYTE_LIMIT`. The file is deleted. */
export class AudioSizeRefused extends Schema.TaggedError<AudioSizeRefused>()(
  "AudioSizeRefused",
  { ...refusal("AUDIO_SIZE", "An audio clip may be at most 3 MB.") }
) {}

/** A file whose leading bytes are no audio a paper plays. The file is deleted. */
export class AudioTypeRefused extends Schema.TaggedError<AudioTypeRefused>()(
  "AudioTypeRefused",
  {
    ...refusal("AUDIO_TYPE", "Only MP3, M4A, OGG, and WAV clips can be added."),
  }
) {}

/** The bytes of an ASCII text, one number per character. */
const ascii = (text: string) =>
  Arr.map(Arr.fromIterable(text), (letter) => letter.charCodeAt(0));

/** Whether the bytes of a file hold `bytes` from `offset`, and a file too short for them holds none. */
const holds = (file: Uint8Array, bytes: readonly number[], offset: number) =>
  Arr.every(bytes, (value, index) => file[offset + index] === value);

/** The first bytes of an MP3 frame, whose top eleven bits are set. */
const isMpegFrame = (file: Uint8Array) =>
  file[0] === 0xff && (file[1] ?? 0) >= 0xe0;

/**
 * The kind of audio that the leading bytes of a file identify, or none when they identify no clip a paper plays.
 * The bytes are read from the file itself, never from its name or its declared type.
 */
export const audioTypeOf = (file: Uint8Array): Option.Option<AudioType> => {
  if (holds(file, ascii("ID3"), 0) || isMpegFrame(file)) {
    return Option.some("audio/mpeg");
  }
  if (holds(file, ascii("ftyp"), 4)) {
    return Option.some("audio/mp4");
  }
  if (holds(file, ascii("OggS"), 0)) {
    return Option.some("audio/ogg");
  }
  return holds(file, ascii("RIFF"), 0) && holds(file, ascii("WAVE"), 8)
    ? Option.some("audio/wav")
    : Option.none();
};

/** The ID of the YouTube video a teacher's link names, or none for any other link. */
export const videoIdOf = (link: string): Option.Option<string> =>
  Option.flatMap(
    Option.liftThrowable(() => new URL(link.trim()))(),
    ({ hostname, pathname, searchParams }) => {
      const host = hostname.replace(HOST_PREFIX, "");
      const id =
        host === "youtu.be"
          ? pathname.slice(1)
          : (searchParams.get("v") ?? pathname.replace(PATH_PREFIX, ""));
      return (host === "youtube.com" || host === "youtu.be") &&
        VIDEO_ID.test(id)
        ? Option.some(id)
        : Option.none();
    }
  );
