import { describe, expect, it } from "vitest";
import { chunkScript, DEFAULT_CHUNK_CONFIG } from "./chunk";

/**
 * Helper to create a string of specific length.
 */
function createText(length: number, baseText = "word "): string {
  const words: string[] = [];
  let currentLength = 0;
  let counter = 1;

  while (currentLength < length) {
    const word = `${baseText}${counter}`;
    if (currentLength + word.length + 1 > length) {
      const remaining = length - currentLength;
      if (remaining > 0) {
        words.push("x".repeat(remaining));
      }
      break;
    }
    words.push(word);
    currentLength += word.length + 1;
    counter++;
  }

  return words.join(" ").trim().slice(0, length);
}

describe("chunk", () => {
  describe("DEFAULT_CHUNK_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_CHUNK_CONFIG.maxRequestChars).toBe(4800);
      expect(DEFAULT_CHUNK_CONFIG.safetyMargin).toBe(200);
    });
  });

  describe("chunkScript", () => {
    it("should return single chunk for short text", () => {
      const script = "Short text";
      const result = chunkScript(script);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe(script);
      expect(result[0].index).toBe(0);
      expect(result[0].totalChunks).toBe(1);
    });

    it("should respect character limit", () => {
      const maxLength =
        DEFAULT_CHUNK_CONFIG.maxRequestChars -
        DEFAULT_CHUNK_CONFIG.safetyMargin;
      const longScript = createText(maxLength * 3);

      const result = chunkScript(longScript);

      expect(result.length).toBeGreaterThan(1);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }
    });

    it("should split at paragraph boundaries when possible", () => {
      const para1 = createText(1000);
      const para2 = createText(1000);
      const para3 = createText(1000);

      const script = `${para1}\n\n${para2}\n\n${para3}`;
      const result = chunkScript(script);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].text).toContain(para1);
    });

    it("should split long sentences at word boundaries", () => {
      const maxLength =
        DEFAULT_CHUNK_CONFIG.maxRequestChars -
        DEFAULT_CHUNK_CONFIG.safetyMargin;
      const longSentence = createText(maxLength + 500, "wordword").replace(
        /\s/g,
        " "
      );

      const result = chunkScript(longSentence);

      expect(result.length).toBeGreaterThan(1);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }
    });

    it("should handle empty script", () => {
      const result = chunkScript("");

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("");
    });

    it("should handle script with only whitespace", () => {
      const result = chunkScript("   \n\n   ");

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("   \n\n   ");
    });

    it("should set correct index and totalChunks", () => {
      const maxLength =
        DEFAULT_CHUNK_CONFIG.maxRequestChars -
        DEFAULT_CHUNK_CONFIG.safetyMargin;
      const script = createText(maxLength * 3);

      const result = chunkScript(script);

      expect(result.length).toBeGreaterThan(1);

      for (let i = 0; i < result.length; i++) {
        expect(result[i].index).toBe(i);
        expect(result[i].totalChunks).toBe(result.length);
      }
    });

    it("should work with custom config", () => {
      const customConfig = {
        maxRequestChars: 2000,
        safetyMargin: 50,
      };

      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;
      const script = createText(maxLength * 2 + 100);

      const result = chunkScript(script, customConfig);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }
    });
  });

  describe("edge cases for 100% coverage", () => {
    it("should handle text without sentence punctuation", () => {
      // Tests line 97: paragraph.match() returns null, triggers || [paragraph]
      const customConfig = { maxRequestChars: 100, safetyMargin: 10 };

      // Text with no .!? punctuation - match returns null
      const script = "This is text without any sentence ending punctuation";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].text).toContain("This is text");
    });

    it("should handle empty string input", () => {
      // Tests edge case: completely empty script
      const result = chunkScript("");

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("");
      expect(result[0].index).toBe(0);
      expect(result[0].totalChunks).toBe(1);
    });

    it("should handle multiple empty paragraphs", () => {
      // Tests edge case: multiple empty paragraphs
      const script = "\n\n\n\n";

      const result = chunkScript(script);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle single character words", () => {
      // Tests word boundary logic with single chars
      const customConfig = { maxRequestChars: 20, safetyMargin: 5 };
      const script = "a b c d e f g h i j k l m n o p";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("a");
      expect(combined).toContain("p");
    });

    it("should handle ternary branch when currentChunk is empty in splitSentenceAtWords", () => {
      // Tests line 73: currentChunk ? ` ${word}` : word
      // When currentChunk is empty, should not add space
      const customConfig = { maxRequestChars: 50, safetyMargin: 10 };

      // Long sentence that will be split, testing word accumulation
      const script = "Firstword secondword thirdword fourthword fifthword";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("Firstword");
      expect(combined).toContain("fifthword");
    });

    it("should handle ternary branch when currentChunk has content in splitSentenceAtWords", () => {
      // Tests line 73: currentChunk ? ` ${word}` : word
      // When currentChunk has content, should add space before word
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };

      // Words that accumulate with spaces
      const script = "one two three four five six seven eight nine ten";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      // Verify words are separated by spaces
      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("one two");
      expect(combined).toContain("three");
    });
  });

  describe("integration scenarios", () => {
    it("should handle realistic podcast script", () => {
      const script = `
Welcome to our educational podcast! Today we're diving deep into quantum mechanics.

[excited] Get ready for an amazing journey through the quantum world!

First, let's understand what quantum mechanics actually is. It's a fundamental theory in physics that describes nature at the smallest scales of energy levels of atoms and subatomic particles.

The key principles include superposition, where particles can exist in multiple states simultaneously, and entanglement, where particles become connected in ways that defy classical physics.

These concepts might seem strange, but they're backed by decades of experimental evidence and form the foundation of modern technologies like lasers, transistors, and quantum computers.
      `.trim();

      const result = chunkScript(script);
      const maxLength =
        DEFAULT_CHUNK_CONFIG.maxRequestChars -
        DEFAULT_CHUNK_CONFIG.safetyMargin;

      expect(result.length).toBeGreaterThanOrEqual(1);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }
    });

    it("should maintain audio tags integrity", () => {
      const script = `
[laughs] This is funny!

But seriously [whispers], quantum mechanics is fascinating.

[excited] Let's dive in!
      `.trim();

      const result = chunkScript(script);

      const combined = result.map((c) => c.text).join("\n\n");
      expect(combined).toContain("[laughs]");
      expect(combined).toContain("[whispers]");
      expect(combined).toContain("[excited]");
    });

    it("should handle real educational script", () => {
      const script = `[curious] Think about a perfectly round plate... or maybe the top of a coffee cup. 

[thoughtful] What actually makes it a circle? 

[inhales] Well... a circle is basically just a set of points on a flat surface that are all the EXACT same distance from a fixed point in the middle. 

[whispers] We call that fixed point the center... and that special distance? 

[excited] That's the radius! 

[thoughtful] Mathematically, if we have a center at point A and B, with a radius of R... we write it out as X minus A squared, plus Y minus B squared, equals R squared. 

[exhales] It sounds a bit technical... but it's just a recipe for perfect roundness!`;

      const result = chunkScript(script);
      const maxLength =
        DEFAULT_CHUNK_CONFIG.maxRequestChars -
        DEFAULT_CHUNK_CONFIG.safetyMargin;

      expect(result.length).toBeGreaterThanOrEqual(1);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("[curious]");
      expect(combined).toContain("[thoughtful]");
      expect(combined).toContain("[excited]");
      expect(combined).toContain("[whispers]");
    });

    it("should handle consecutive short paragraphs", () => {
      const paragraphs = Array.from(
        { length: 20 },
        (_, i) => `Paragraph ${i + 1}.`
      );
      const script = paragraphs.join("\n\n");

      const result = chunkScript(script);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join("");
      for (let i = 0; i < 20; i++) {
        expect(combined).toContain(`Paragraph ${i + 1}.`);
      }
    });

    it("should handle paragraphs with mixed content lengths", () => {
      const maxLength =
        DEFAULT_CHUNK_CONFIG.maxRequestChars -
        DEFAULT_CHUNK_CONFIG.safetyMargin;
      const shortPara = "Short.";
      const mediumPara = createText(Math.floor(maxLength / 2));
      const longPara = createText(maxLength + 200);

      const script = `${shortPara}\n\n${mediumPara}\n\n${longPara}\n\n${shortPara}`;
      const result = chunkScript(script);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("Short.");
      expect(combined).toContain(mediumPara);
      expect(combined).toContain(longPara.slice(0, 100));
    });

    it("should push current chunk when sentence doesn't fit and start new chunk with next sentence", () => {
      // Test the branch at lines 104-105 and 111-112
      // Create a scenario where:
      // 1. First sentence fills most of the chunk
      // 2. Second sentence triggers the "doesn't fit" condition
      // 3. Current chunk gets pushed and new chunk starts with second sentence
      const customConfig = { maxRequestChars: 100, safetyMargin: 10 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin; // 90

      // First sentence fills ~80 chars of the 90 limit
      // Second sentence (20 chars + space = 21) would exceed, so it starts a new chunk
      const sentence1 = `${createText(80)}.`; // ~82 chars
      const sentence2 = "This is short text."; // ~19 chars
      const paragraph = `${sentence1} ${sentence2}`;

      const result = chunkScript(paragraph, customConfig);

      // Should create 2 chunks
      expect(result.length).toBe(2);

      // Verify first chunk contains most of sentence1
      expect(result[0].text.length).toBeLessThanOrEqual(maxLength);
      expect(result[0].text).toContain(sentence1.slice(0, 10));

      // Verify second chunk contains sentence2
      expect(result[1].text).toContain(sentence2.slice(0, -1));

      // Verify both sentences are preserved in combined output
      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain(sentence1.slice(0, 10));
      expect(combined).toContain(sentence2.slice(0, -1));
    });

    it("should handle sentence that fits in new chunk after pushing current chunk", () => {
      // Tests line 111-112: when a sentence fits within maxChars after pushing current chunk
      const customConfig = { maxRequestChars: 80, safetyMargin: 10 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin; // 70

      // First chunk gets filled, then second sentence fits perfectly in new chunk
      const sentence1 = `${createText(65)}.`; // Fills first chunk
      const sentence2 = "Short second sentence."; // Fits in new chunk
      const paragraph = `${sentence1} ${sentence2}`;

      const result = chunkScript(paragraph, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(2);

      // All chunks should respect the limit
      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      // Both sentences should be present
      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain(sentence2.slice(0, -1));
    });

    it("should accumulate multiple short sentences that together exceed limit", () => {
      // Tests the accumulation logic where multiple short sentences together exceed limit
      const customConfig = { maxRequestChars: 150, safetyMargin: 10 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      // Three longer sentences that together exceed the 140 char limit
      // Each sentence is ~50 chars, total ~150 chars + spaces = ~152
      const script =
        "This is the very first sentence with extra words for length. This is the second sentence also quite long. This is the third sentence making it overflow.";

      const result = chunkScript(script, customConfig);

      // Should split into at least 2 chunks
      expect(result.length).toBeGreaterThanOrEqual(2);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      // All content preserved
      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("first sentence");
      expect(combined).toContain("second sentence");
      expect(combined).toContain("third sentence");
    });

    it("should handle exact boundary where sentence would exceed", () => {
      // Edge case: sentence that would exactly hit the boundary
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      // Create sentences where one fills chunk almost exactly
      const sentence1 = `${createText(42)}.`; // Leaves room for space + next sentence
      const sentence2 = "X.";

      const result = chunkScript(`${sentence1} ${sentence2}`, customConfig);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("X");
    });

    it("should handle single word longer than chunk limit", () => {
      // Tests line 76 FALSE branch: word doesn't fit, currentChunk is empty
      const customConfig = { maxRequestChars: 20, safetyMargin: 5 };

      // One very long word that exceeds the chunk limit
      const longWord = "supercalifragilisticexpialidocious";
      const script = longWord;

      const result = chunkScript(script, customConfig);

      // Should create at least one chunk
      expect(result.length).toBeGreaterThanOrEqual(1);

      // The word should be preserved (may exceed limit since we don't break words)
      const combined = result.map((c) => c.text).join("");
      expect(combined).toBe(longWord);
    });

    it("should handle word that exceeds limit when currentChunk is empty", () => {
      // Tests line 76 FALSE branch specifically:
      // When processing a long sentence, after pushing currentChunk,
      // the next word might exceed limit on its own, triggering the false branch
      const customConfig = { maxRequestChars: 50, safetyMargin: 10 };

      // A long sentence where a word in the middle exceeds the chunk limit
      // Pattern: short words + very long word + short words
      const script =
        "Short word. Supercalifragilisticexpialidociousisareallylongwordthatexceedslimits. More text.";

      const result = chunkScript(script, customConfig);

      // Should handle without error
      expect(result.length).toBeGreaterThanOrEqual(1);

      // Verify content is preserved
      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("Short word");
      expect(combined).toContain("Supercalifragilistic");
      expect(combined).toContain("More text");
    });

    it("should handle multiple words where middle word exceeds limit alone", () => {
      // Tests the specific scenario for line 76:
      // First word fits, gets added to currentChunk
      // Second word doesn't fit even alone, triggers line 76 with currentChunk.length > 0
      // Wait, that tests line 76 TRUE branch. We need FALSE branch.
      // FALSE branch: currentChunk is empty and word doesn't fit
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };

      // First word fits (10 chars), second word is huge, third word fits
      const word1 = "Firstword"; // 9 chars
      const word2 = "Supercalifragilisticexpialidocious"; // 34 chars, exceeds max (25)
      const word3 = "Last"; // 4 chars
      const script = `${word1} ${word2} ${word3}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain(word1);
      expect(combined).toContain(word2);
      expect(combined).toContain(word3);
    });

    it("should handle multiple long words that don't fit together", () => {
      // Tests line 76 branch: multiple words, each fits alone but not together
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      // Two words that each fit but not together
      const word1 = "pneumonoultramicroscopic";
      const word2 = "silicovolcanoconiosis";
      const script = `${word1} ${word2}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(2);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      // Both words should be present
      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("pneumonoultramicroscopic");
      expect(combined).toContain("silicovolcanoconiosis");
    });

    it("should handle empty result from processParagraphs", () => {
      // Tests line 196: when processParagraphs returns empty string
      // This happens when all content is pushed during processing
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };

      // Content that gets fully processed and pushed during paragraph processing
      const para1 = "X".repeat(40);
      const para2 = "Y".repeat(40);
      const script = `${para1}\n\n${para2}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      // All content should be present
      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("X".repeat(10));
      expect(combined).toContain("Y".repeat(10));
    });

    it("should push remaining content after processing all paragraphs", () => {
      // Verifies that remaining content in currentChunk is pushed after processing
      // Script MUST exceed maxTextLength to bypass early return, then have remaining content
      const customConfig = { maxRequestChars: 100, safetyMargin: 10 };
      const maxTextLength =
        customConfig.maxRequestChars - customConfig.safetyMargin; // 90

      // Create a script that:
      // 1. Exceeds maxTextLength (so it doesn't return early at line 181)
      // 2. After processing paragraphs, has remaining content in currentChunk
      // para1 fills most of a chunk, para2 is small and accumulates without triggering push
      const para1 = createText(80); // 80 chars, fits, doesn't exceed
      const para2 = createText(20); // 20 chars, will be accumulated
      // Total: 100 chars > 90 (maxTextLength), so no early return
      // After processing: para1 (80) + "\n\n" + para2 (20) = 84 chars, stays in currentChunk
      const script = `${para1}\n\n${para2}`;

      expect(script.length).toBeGreaterThan(maxTextLength); // Verify we don't early return

      const result = chunkScript(script, customConfig);

      // Should have at least 1 chunk with both paragraphs present
      expect(result.length).toBeGreaterThanOrEqual(1);
      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain(para1.slice(0, 20));
      expect(combined).toContain(para2.slice(0, 10));
    });

    it("should handle paragraphs where all content gets pushed leaving no remainder", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };

      // Multiple paragraphs that each get pushed immediately
      const paras = [
        "First paragraph here.",
        "Second paragraph here.",
        "Third paragraph here.",
      ];
      const script = paras.join("\n\n");

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(3);

      // All content should be present
      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("First paragraph");
      expect(combined).toContain("Second paragraph");
      expect(combined).toContain("Third paragraph");
    });
  });
});
