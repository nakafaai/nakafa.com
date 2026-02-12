import { V3_MAX_CHARS_PER_CHUNK } from "@repo/ai/config/elevenlabs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { ContentType } from "@repo/backend/convex/audioStudies/schema";

/**
 * Content data structure for script generation.
 */
export interface ContentData {
  title: string;
  description?: string;
  body: string;
  locale: string;
}

/**
 * Fetch content data based on audio content type and ID.
 * Returns null if content not found.
 */
export async function fetchContentForAudio(
  ctx: QueryCtx,
  audio: {
    contentType: ContentType;
    contentId: Id<"articleContents"> | Id<"subjectSections">;
  }
): Promise<ContentData | null> {
  if (audio.contentType === "article") {
    const article = await ctx.db.get(
      "articleContents",
      audio.contentId as Id<"articleContents">
    );
    if (!article) {
      return null;
    }
    return {
      title: article.title,
      description: article.description,
      body: article.body,
      locale: article.locale,
    };
  }

  const section = await ctx.db.get(
    "subjectSections",
    audio.contentId as Id<"subjectSections">
  );
  if (!section) {
    return null;
  }
  return {
    title: section.title,
    description: section.description,
    body: section.body,
    locale: section.locale,
  };
}

/**
 * Represents a chunk of text for audio generation.
 */
export interface TextChunk {
  /**
   * The text content of this chunk.
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
   * The text that came before this chunk (for continuity).
   * Empty string for first chunk.
   */
  previousText: string;

  /**
   * The text that comes after this chunk (for continuity).
   * Empty string for last chunk.
   */
  nextText: string;
}

/**
 * Adds text to current chunk with separator.
 */
function addToChunk(current: string, text: string, separator: string): string {
  return current ? `${current}${separator}${text}` : text;
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
 */
function processSentences(
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
 */
function processParagraphs(
  paragraphs: string[],
  maxChars: number,
  chunks: string[]
): string {
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (
      currentChunk.length + paragraph.length + 2 > maxChars &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    if (paragraph.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      currentChunk = processSentences(paragraph, maxChars, chunks);
    } else {
      currentChunk = addToChunk(currentChunk, paragraph, "\n\n");
    }
  }

  return currentChunk;
}

/**
 * Split a long script into chunks that fit within V3's character limit.
 *
 * Strategy:
 * 1. Split at paragraph breaks (double newlines) first
 * 2. If paragraphs are too long, split at sentence boundaries
 * 3. If sentences are too long, split at word boundaries
 * 4. Never split in the middle of an audio tag
 *
 * @param script - The full script text
 * @param maxChars - Maximum characters per chunk (default: 4500 for safety)
 * @returns Array of text chunks with continuity context
 */
export function chunkScript(
  script: string,
  maxChars: number = V3_MAX_CHARS_PER_CHUNK
): TextChunk[] {
  if (script.length <= maxChars) {
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

  const currentChunk = processParagraphs(paragraphs, maxChars, chunks);

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.map((text, index) => ({
    text,
    index,
    totalChunks: chunks.length,
    previousText: index > 0 ? chunks[index - 1] : "",
    nextText: index < chunks.length - 1 ? chunks[index + 1] : "",
  }));
}
