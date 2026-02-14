/**
 * ElevenLabs V3 maximum characters per request.
 * V3 has a 5,000 character limit. Using 4,800 as safety margin.
 * Defined locally to avoid env loading issues in tests.
 */
const V3_MAX_CHARS_PER_CHUNK = 4800;

/**
 * Simplified configuration for ElevenLabs V3 chunking.
 * V3 does NOT support previous_text/next_text context parameters.
 * Only max request size and safety margin matter.
 */
export interface ChunkConfig {
  /**
   * Maximum characters allowed per ElevenLabs API request.
   */
  maxRequestChars: number;

  /**
   * Safety margin to ensure we never exceed the limit.
   */
  safetyMargin: number;
}

/**
 * Represents a text chunk for ElevenLabs TTS generation.
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
}

/**
 * Default configuration for ElevenLabs V3 chunking.
 * V3 has 5,000 char limit, no context support.
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxRequestChars: V3_MAX_CHARS_PER_CHUNK,
  safetyMargin: 200,
};

/**
 * Calculates the maximum text length per chunk accounting for safety margin.
 */
function getMaxChunkTextLength(config: ChunkConfig): number {
  return config.maxRequestChars - config.safetyMargin;
}

/**
 * Splits a long sentence at word boundaries.
 */
function splitSentenceAtWords(
  sentence: string,
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";
  const words = sentence.split(" ");

  for (const word of words) {
    const withSpace = currentChunk ? ` ${word}` : word;

    if (currentChunk.length + withSpace.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = word;
    } else {
      currentChunk += withSpace;
    }
  }

  return currentChunk;
}

/**
 * Processes sentences within a paragraph.
 * Captures sentences ending with .!? and any trailing text without punctuation.
 */
function processSentences(
  paragraph: string,
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";
  // Match sentences ending with punctuation
  const sentenceMatches = paragraph.match(/[^.!?]+[.!?]+/g);

  // Handle case with no punctuation at all
  if (!sentenceMatches) {
    // Paragraph has no punctuation - must split at word boundaries
    // Note: paragraph.length is always > maxChars here because
    // processSentences is only called for paragraphs exceeding maxChars
    return splitSentenceAtWords(paragraph, maxChars, chunks);
  }

  // Calculate matched length and capture any remaining text
  const matchedLength = sentenceMatches.join("").length;
  const remaining = paragraph.slice(matchedLength).trim();

  // Include remaining text if it exists
  const sentences =
    remaining.length > 0 ? [...sentenceMatches, remaining] : sentenceMatches;

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
      currentChunk = currentChunk
        ? `${currentChunk} ${trimmedSentence}`
        : trimmedSentence;
    }
  }

  return currentChunk;
}

/**
 * Processes paragraphs and splits them as needed.
 */
function processParagraphs(
  paragraphs: string[],
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const wouldExceedLimit =
      currentChunk.length > 0 &&
      currentChunk.length + paragraph.length + 2 > maxChars;

    if (wouldExceedLimit) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    if (paragraph.length > maxChars) {
      currentChunk = processSentences(paragraph, maxChars, chunks);
    } else {
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
    }
  }

  return currentChunk;
}

/**
 * Splits a script into ElevenLabs-compatible chunks.
 *
 * V3 does NOT support previous_text/next_text context, so this function
 * simply splits at natural boundaries (paragraphs → sentences → words).
 *
 * @param script - The full script text
 * @param config - Chunking configuration (defaults to V3 settings from @repo/ai/config)
 * @returns Array of chunks ready for ElevenLabs TTS
 *
 * @example
 * import { chunkScript } from "@repo/backend/helpers/chunk";
 * import { DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
 *
 * const chunks = chunkScript(longScript, DEFAULT_CHUNK_CONFIG);
 *
 * for (const chunk of chunks) {
 *   await generateSpeech({ text: chunk.text });
 * }
 */
export function chunkScript(
  script: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): ElevenLabsChunk[] {
  const maxTextLength = getMaxChunkTextLength(config);

  if (script.length <= maxTextLength) {
    return [
      {
        text: script,
        index: 0,
        totalChunks: 1,
      },
    ];
  }

  const chunks: string[] = [];
  const paragraphs = script.split("\n\n");

  const currentChunk = processParagraphs(paragraphs, maxTextLength, chunks);

  // Defensive guard: Only push if there's actual content after trimming
  // This prevents empty chunks when processParagraphs/processSentences
  // push all content to chunks array during processing (Devin bug fix)
  const finalChunk = currentChunk.trim();
  if (finalChunk.length > 0) {
    chunks.push(finalChunk);
  }

  return chunks.map((text, index) => ({
    text,
    index,
    totalChunks: chunks.length,
  }));
}
