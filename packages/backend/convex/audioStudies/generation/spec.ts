import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  audioContentRefValidator,
  audioModelValidator,
  audioStatusValidator,
  type VoiceSettings,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { nullable } from "convex-helpers/validators";
import { Schema } from "effect";

export const audioContentChangedCode = "CONTENT_CHANGED";
export const audioGenerationIoFailedCode = "AUDIO_GENERATION_IO_FAILED";
export const audioProviderFailedCode = "AUDIO_PROVIDER_FAILED";
export const audioScriptEmptyCode = "AUDIO_SCRIPT_EMPTY";
export const audioSourceNotFoundCode = "NOT_FOUND";

export const audioGenerationArgs = {
  contentAudioId: vv.id("contentAudios"),
};

export const audioGenerationArgsValidator = v.object(audioGenerationArgs);

export type AudioGenerationArgs = Infer<typeof audioGenerationArgsValidator>;

export const scriptGenerationDataValidator = nullable(
  v.object({
    contentAudio: v.object({
      contentRef: audioContentRefValidator,
      contentHash: v.string(),
      voiceId: v.string(),
      voiceSettings: v.optional(voiceSettingsValidator),
      status: audioStatusValidator,
    }),
    content: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      body: v.string(),
      locale: localeValidator,
    }),
  })
);

export type ScriptGenerationData = NonNullable<
  Infer<typeof scriptGenerationDataValidator>
>;

export const speechGenerationDataValidator = nullable(
  v.object({
    script: v.string(),
    voiceId: v.string(),
    voiceSettings: v.optional(voiceSettingsValidator),
    contentHash: v.string(),
    model: audioModelValidator,
  })
);

export type SpeechGenerationData = NonNullable<
  Infer<typeof speechGenerationDataValidator>
>;

export interface AudioGenerationStore {
  readonly claimScriptGeneration: (
    contentAudioId: AudioGenerationArgs["contentAudioId"]
  ) => Promise<boolean>;
  readonly claimSpeechGeneration: (
    contentAudioId: AudioGenerationArgs["contentAudioId"]
  ) => Promise<boolean>;
  readonly markFailed: (input: {
    readonly contentAudioId: AudioGenerationArgs["contentAudioId"];
    readonly error: string;
  }) => Promise<null>;
  readonly readScriptGenerationData: (
    contentAudioId: AudioGenerationArgs["contentAudioId"]
  ) => Promise<ScriptGenerationData | null>;
  readonly readSpeechGenerationData: (
    contentAudioId: AudioGenerationArgs["contentAudioId"]
  ) => Promise<SpeechGenerationData | null>;
  readonly saveAudio: (input: {
    readonly contentAudioId: AudioGenerationArgs["contentAudioId"];
    readonly duration: number;
    readonly size: number;
    readonly storageId: Id<"_storage">;
  }) => Promise<null>;
  readonly saveScript: (input: {
    readonly contentAudioId: AudioGenerationArgs["contentAudioId"];
    readonly script: string;
  }) => Promise<null>;
  readonly verifyContentHash: (input: {
    readonly contentAudioId: AudioGenerationArgs["contentAudioId"];
    readonly expectedHash: string;
  }) => Promise<boolean>;
}

export interface AudioGenerationProviders {
  readonly defaultVoiceSettings: VoiceSettings;
  readonly generateScriptText: (
    content: ScriptGenerationData["content"]
  ) => Promise<string>;
  readonly generateSpeechChunk: (input: {
    readonly model: SpeechGenerationData["model"];
    readonly text: string;
    readonly voiceId: string;
    readonly voiceSettings: VoiceSettings;
  }) => Promise<Uint8Array>;
  readonly storeAudio: (input: {
    readonly wavBuffer: Uint8Array;
  }) => Promise<Id<"_storage">>;
}

export class AudioContentChangedError extends Schema.TaggedError<AudioContentChangedError>()(
  "AudioContentChangedError",
  {
    code: Schema.Literal(audioContentChangedCode),
    message: Schema.String,
  }
) {}

export class AudioGenerationIoError extends Schema.TaggedError<AudioGenerationIoError>()(
  "AudioGenerationIoError",
  {
    code: Schema.Literal(audioGenerationIoFailedCode),
    message: Schema.String,
  }
) {}

export class AudioProviderError extends Schema.TaggedError<AudioProviderError>()(
  "AudioProviderError",
  {
    code: Schema.Literal(audioProviderFailedCode),
    message: Schema.String,
  }
) {}

export class AudioScriptEmptyError extends Schema.TaggedError<AudioScriptEmptyError>()(
  "AudioScriptEmptyError",
  {
    code: Schema.Literal(audioScriptEmptyCode),
    message: Schema.String,
  }
) {}

export class AudioSourceNotFoundError extends Schema.TaggedError<AudioSourceNotFoundError>()(
  "AudioSourceNotFoundError",
  {
    code: Schema.Literal(audioSourceNotFoundCode),
    message: Schema.String,
  }
) {}

export type AudioGenerationError =
  | AudioContentChangedError
  | AudioGenerationIoError
  | AudioProviderError
  | AudioScriptEmptyError
  | AudioSourceNotFoundError;
