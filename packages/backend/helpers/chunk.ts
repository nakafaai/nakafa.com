/**
 * Configuration for ElevenLabs audio chunking with context support.
 */
export interface ChunkConfig {
  /**
   * Maximum characters allowed per ElevenLabs API request.
   * @default 5000
   */
  maxRequestChars: number;

  /**
   * Characters to reserve for previous_text context.
   * This text helps maintain intonation continuity from the previous chunk.
   * @default 500
   */
  previousContextChars: number;

  /**
   * Characters to reserve for next_text context.
   * This text helps maintain intonation continuity to the next chunk.
   * @default 500
   */
  nextContextChars: number;

  /**
   * Safety margin to ensure we never exceed the limit.
   * @default 100
   */
  safetyMargin: number;
}

/**
 * Represents a text chunk with context for ElevenLabs TTS generation.
 */
export interface ElevenLabsChunk {
  /**
   * The main text content to be spoken in this chunk.
   */
  text: string;

  /**
   * The index of this chunk (0-based).
   */
  index: number;

  /**
   * Total number of chunks.
   */
  totalChunks: number;

  /**
   * Text from the previous chunk (truncated to fit context budget).
   * Used for intonation continuity via previous_text parameter.
   */
  previousText: string;

  /**
   * Text from the next chunk (truncated to fit context budget).
   * Used for intonation continuity via next_text parameter.
   */
  nextText: string;
}

/**
 * Default configuration for ElevenLabs V3 chunking.
 * Reserves space for context to maintain audio continuity.
 */
export const DEFAULT_V3_CHUNK_CONFIG: ChunkConfig = {
  maxRequestChars: 5000,
  previousContextChars: 500,
  nextContextChars: 500,
  safetyMargin: 100,
};

/**
 * Calculates the maximum text length per chunk accounting for context overhead.
 *
 * Formula: maxRequestChars - previousContext - nextContext - safetyMargin
 *
 * @example
 * // With default config:
 * // 5000 - 500 - 500 - 100 = 3900 chars per chunk
 * getMaxChunkTextLength(DEFAULT_V3_CHUNK_CONFIG) // returns 3900
 */
export function getMaxChunkTextLength(config: ChunkConfig): number {
  return (
    config.maxRequestChars -
    config.previousContextChars -
    config.nextContextChars -
    config.safetyMargin
  );
}

/**
 * Truncates text from the end to fit within a character limit.
 * Tries to break at word boundaries if possible.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length allowed
 * @returns Truncated text
 *
 * @example
 * truncateFromEnd("Hello world today", 10)
 * // Returns: "Hello worl" (word boundary not possible)
 *
 * truncateFromEnd("Hello world today", 11)
 * // Returns: "Hello world" (breaks at word boundary)
 */
export function truncateFromEnd(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to find a word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    // Break at word boundary if it's not cutting off too much
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}

/**
 * Truncates text from the start to fit within a character limit.
 * Tries to break at word boundaries if possible.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length allowed
 * @returns Truncated text
 *
 * @example
 * truncateFromStart("Hello world today", 10)
 * // Returns: "ld today"
 */
export function truncateFromStart(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const startIndex = text.length - maxLength;
  const truncated = text.slice(startIndex);

  // Try to find a word boundary
  const firstSpace = truncated.indexOf(" ");

  if (firstSpace >= 0 && firstSpace < maxLength * 0.2) {
    // Break at word boundary if it's not cutting off too much
    return truncated.slice(firstSpace + 1);
  }

  return truncated;
}

/**
 * Adds text to current chunk with separator.
 */
function addToChunk(current: string, text: string, separator: string): string {
  return current ? `${current}${separator}${text}` : text;
}

/**
 * Splits a long sentence at word boundaries.
 * Exported for testing purposes.
 */
export function splitSentenceAtWords(
  sentence: string,
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";
  const words = sentence.split(" ");

  for (const word of words) {
    if (currentChunk.length + word.length + 1 > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = word;
    } else {
      currentChunk = addToChunk(currentChunk, word, " ");
    }
  }

  return currentChunk;
}

/**
 * Processes sentences within a paragraph.
 * Exported for testing purposes.
 */
export function processSentences(
  paragraph: string,
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (currentChunk.length + trimmedSentence.length + 1 > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      if (trimmedSentence.length > maxChars) {
        currentChunk = splitSentenceAtWords(trimmedSentence, maxChars, chunks);
      } else {
        currentChunk = trimmedSentence;
      }
    } else {
      currentChunk = addToChunk(currentChunk, trimmedSentence, " ");
    }
  }

  return currentChunk;
}

/**
 * Processes paragraphs and splits them as needed.
 * Exported for testing purposes.
 *
 * Logic flow:
 * 1. If adding paragraph would exceed limit, push current chunk and reset
 * 2. If paragraph itself exceeds limit, process its sentences
 * 3. Otherwise, add paragraph to current chunk
 */
export function processParagraphs(
  paragraphs: string[],
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // Check if we need to finalize current chunk before processing this paragraph
    const wouldExceedLimit =
      currentChunk.length > 0 &&
      currentChunk.length + paragraph.length + 2 > maxChars;

    if (wouldExceedLimit) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    if (paragraph.length > maxChars) {
      // Long paragraph: split into sentences
      currentChunk = processSentences(paragraph, maxChars, chunks);
    } else {
      // Short paragraph: add to current chunk
      currentChunk = addToChunk(currentChunk, paragraph, "\n\n");
    }
  }

  return currentChunk;
}

/**
 * Creates ElevenLabs chunks with context from a list of text segments.
 *
 * @param textSegments - Array of text chunks (already split by size)
 * @param config - Chunking configuration
 * @returns Array of chunks with proper context
 */
export function createChunksWithContext(
  textSegments: string[],
  config: ChunkConfig = DEFAULT_V3_CHUNK_CONFIG
): ElevenLabsChunk[] {
  if (textSegments.length === 0) {
    return [];
  }

  if (textSegments.length === 1) {
    return [
      {
        text: textSegments[0],
        index: 0,
        totalChunks: 1,
        previousText: "",
        nextText: "",
      },
    ];
  }

  return textSegments.map((text, index) => {
    const isFirst = index === 0;
    const isLast = index === textSegments.length - 1;

    // Get previous chunk text (truncated from end to fit context budget)
    const previousText = isFirst
      ? ""
      : truncateFromEnd(textSegments[index - 1], config.previousContextChars);

    // Get next chunk text (truncated from start to fit context budget)
    const nextText = isLast
      ? ""
      : truncateFromStart(textSegments[index + 1], config.nextContextChars);

    return {
      text,
      index,
      totalChunks: textSegments.length,
      previousText,
      nextText,
    };
  });
}

/**
 * Splits a script into ElevenLabs-compatible chunks with continuity context.
 *
 * This function properly accounts for the character limit by:
 * 1. Reserving space for previous_text and next_text context
 * 2. Splitting at natural boundaries (paragraphs → sentences → words)
 * 3. Providing context from adjacent chunks for intonation continuity
 *
 * @param script - The full script text
 * @param config - Chunking configuration (defaults to V3 settings)
 * @returns Array of chunks ready for ElevenLabs TTS
 *
 * @example
 * const chunks = chunkScriptWithContext(longScript);
 * // Each chunk has:
 * // - text: Main content (max ~3900 chars)
 * // - previousText: End of previous chunk (max 500 chars)
 * // - nextText: Start of next chunk (max 500 chars)
 *
 * for (const chunk of chunks) {
 *   await generateSpeech({
 *     text: chunk.text,
 *     providerOptions: {
 *       elevenlabs: {
 *         previousText: chunk.previousText,
 *         nextText: chunk.nextText,
 *       },
 *     },
 *   });
 * }
 */
export function chunkScriptWithContext(
  script: string,
  config: ChunkConfig = DEFAULT_V3_CHUNK_CONFIG
): ElevenLabsChunk[] {
  const maxTextLength = getMaxChunkTextLength(config);

  if (script.length <= maxTextLength) {
    return [
      {
        text: script,
        index: 0,
        totalChunks: 1,
        previousText: "",
        nextText: "",
      },
    ];
  }

  const chunks: string[] = [];
  const paragraphs = script.split("\n\n");

  const currentChunk = processParagraphs(paragraphs, maxTextLength, chunks);

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return createChunksWithContext(chunks, config);
}
