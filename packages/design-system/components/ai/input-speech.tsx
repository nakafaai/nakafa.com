"use client";

import { Mic01Icon } from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import {
  PromptInputButton,
  type PromptInputButtonProps,
} from "@repo/design-system/components/ai/input-controls";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { Effect, Either, Schema } from "effect";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: ((this: SpeechRecognition, event: Event) => void) | null;
  onerror: ((this: SpeechRecognition, event: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, event: SpeechRecognitionEvent) => void)
    | null;
  onstart: ((this: SpeechRecognition, event: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

type SpeechRecognitionPhase = "idle" | "starting" | "listening" | "stopping";

const SpeechRecognitionOperationSchema = Schema.Literal(
  "create",
  "start",
  "stop"
);

/** Expected browser failure while controlling speech recognition. */
class PromptInputSpeechRecognitionError extends Schema.TaggedError<PromptInputSpeechRecognitionError>()(
  "PromptInputSpeechRecognitionError",
  {
    cause: Schema.Unknown,
    operation: SpeechRecognitionOperationSchema,
  }
) {}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

/** Props for optional browser speech transcription in a prompt input. */
export type PromptInputSpeechButtonProps = PromptInputButtonProps & {
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onTranscriptionChange?: (text: string) => void;
};

function getSpeechRecognitionApi() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function getSpeechRecognitionSnapshot() {
  return getSpeechRecognitionApi() !== null;
}

function getServerSpeechRecognitionSnapshot() {
  return false;
}

function unsubscribeSpeechRecognitionAvailability() {
  return;
}

function subscribeSpeechRecognitionAvailability(_listener: () => void) {
  return unsubscribeSpeechRecognitionAvailability;
}

const createSpeechRecognition = Effect.fn(
  "designSystem.promptInput.createSpeechRecognition"
)((SpeechRecognitionApi: { new (): SpeechRecognition }) =>
  Effect.try({
    try: () => new SpeechRecognitionApi(),
    catch: (cause) =>
      new PromptInputSpeechRecognitionError({ cause, operation: "create" }),
  })
);

const controlSpeechRecognition = Effect.fn(
  "designSystem.promptInput.controlSpeechRecognition"
)((recognition: SpeechRecognition, operation: "start" | "stop") =>
  Effect.try({
    try: () => recognition[operation](),
    catch: (cause) =>
      new PromptInputSpeechRecognitionError({ cause, operation }),
  })
);

function reportSpeechRecognitionError(
  error: PromptInputSpeechRecognitionError
) {
  captureException(error.cause, {
    operation: error.operation,
    source: "prompt-input-speech-recognition",
  });
}

/** Transcribes final speech-recognition results into a prompt textarea. */
export function PromptInputSpeechButton({
  className,
  textareaRef,
  onTranscriptionChange,
  ...props
}: PromptInputSpeechButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const hasRecognition = useSyncExternalStore(
    subscribeSpeechRecognitionAvailability,
    getSpeechRecognitionSnapshot,
    getServerSpeechRecognitionSnapshot
  );
  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionPhaseRef = useRef<SpeechRecognitionPhase>("idle");
  const textareaRefRef = useRef(textareaRef);

  useEffect(() => {
    onTranscriptionChangeRef.current = onTranscriptionChange;
  }, [onTranscriptionChange]);

  useEffect(() => {
    textareaRefRef.current = textareaRef;
  }, [textareaRef]);

  useEffect(() => {
    const SpeechRecognitionApi = getSpeechRecognitionApi();
    if (!SpeechRecognitionApi) {
      return;
    }

    const creation = Effect.runSync(
      Effect.either(createSpeechRecognition(SpeechRecognitionApi))
    );
    if (Either.isLeft(creation)) {
      reportSpeechRecognitionError(creation.left);
      return;
    }

    const speechRecognition = creation.right;
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = "en-US";

    speechRecognition.onstart = () => {
      if (recognitionPhaseRef.current === "starting") {
        recognitionPhaseRef.current = "listening";
        setIsListening(true);
      }
    };
    speechRecognition.onend = () => {
      recognitionPhaseRef.current = "idle";
      setIsListening(false);
    };
    speechRecognition.onresult = (event) => {
      let finalTranscript = "";

      for (const result of Array.from(event.results)) {
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      const textarea = textareaRefRef.current?.current;
      if (!(finalTranscript && textarea)) {
        return;
      }

      const currentValue = textarea.value;
      const newValue =
        currentValue + (currentValue ? " " : "") + finalTranscript;

      textarea.value = newValue;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      onTranscriptionChangeRef.current?.(newValue);
    };
    speechRecognition.onerror = () => {
      recognitionPhaseRef.current = "idle";
      setIsListening(false);
    };

    recognitionRef.current = speechRecognition;

    return () => {
      speechRecognition.onend = null;
      speechRecognition.onerror = null;
      speechRecognition.onresult = null;
      speechRecognition.onstart = null;

      if (
        recognitionPhaseRef.current === "starting" ||
        recognitionPhaseRef.current === "listening"
      ) {
        const stopped = Effect.runSync(
          Effect.either(controlSpeechRecognition(speechRecognition, "stop"))
        );
        if (Either.isLeft(stopped)) {
          reportSpeechRecognitionError(stopped.left);
        }
      }

      recognitionPhaseRef.current = "idle";
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    const previousPhase = recognitionPhaseRef.current;
    if (previousPhase === "stopping") {
      return;
    }

    const operation = previousPhase === "idle" ? "start" : "stop";
    recognitionPhaseRef.current =
      operation === "start" ? "starting" : "stopping";
    const result = Effect.runSync(
      Effect.either(controlSpeechRecognition(recognition, operation))
    );
    if (Either.isLeft(result)) {
      recognitionPhaseRef.current = previousPhase;
      setIsListening(previousPhase === "listening");
      reportSpeechRecognitionError(result.left);
    }
  }, []);

  return (
    <PromptInputButton
      className={cn(
        "relative transition-all duration-200",
        isListening && "animate-pulse bg-accent text-accent-foreground",
        className
      )}
      disabled={!hasRecognition}
      onClick={toggleListening}
      {...props}
    >
      <HugeIcons className="size-4" icon={Mic01Icon} />
      <span className="sr-only">
        {isListening ? "Stop Listening" : "Start Listening"}
      </span>
    </PromptInputButton>
  );
}
