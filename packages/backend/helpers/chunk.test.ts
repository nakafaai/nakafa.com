import { chunkScript, DEFAULT_CHUNK_CONFIG } from "@repo/backend/helpers/chunk";
import { describe, expect, it } from "vitest";

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

  describe("word and sentence boundary edge cases", () => {
    it("should handle text without sentence punctuation", () => {
      const customConfig = { maxRequestChars: 100, safetyMargin: 10 };
      const script = "This is text without any sentence ending punctuation";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].text).toContain("This is text");
    });

    it("should handle empty string input", () => {
      const result = chunkScript("");

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("");
      expect(result[0].index).toBe(0);
      expect(result[0].totalChunks).toBe(1);
    });

    it("should handle multiple empty paragraphs", () => {
      const script = "\n\n\n\n";

      const result = chunkScript(script);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle single character words", () => {
      const customConfig = { maxRequestChars: 20, safetyMargin: 5 };
      const script = "a b c d e f g h i j k l m n o p";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("a");
      expect(combined).toContain("p");
    });

    it("should preserve the first word without a leading space", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 10 };
      const script = "Firstword secondword thirdword fourthword fifthword";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("Firstword");
      expect(combined).toContain("fifthword");
    });

    it("should preserve spaces between accumulated words", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };
      const script = "one two three four five six seven eight nine ten";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

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

    it("should start a new chunk when the next sentence does not fit", () => {
      const customConfig = { maxRequestChars: 100, safetyMargin: 10 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      const sentence1 = `${createText(80)}.`;
      const sentence2 = "This is short text.";
      const paragraph = `${sentence1} ${sentence2}`;

      const result = chunkScript(paragraph, customConfig);

      expect(result.length).toBe(2);
      expect(result[0].text.length).toBeLessThanOrEqual(maxLength);
      expect(result[0].text).toContain(sentence1.slice(0, 10));
      expect(result[1].text).toContain(sentence2.slice(0, -1));

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain(sentence1.slice(0, 10));
      expect(combined).toContain(sentence2.slice(0, -1));
    });

    it("should handle sentence that fits in new chunk after pushing current chunk", () => {
      const customConfig = { maxRequestChars: 80, safetyMargin: 10 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      const sentence1 = `${createText(65)}.`;
      const sentence2 = "Short second sentence.";
      const paragraph = `${sentence1} ${sentence2}`;

      const result = chunkScript(paragraph, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(2);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain(sentence2.slice(0, -1));
    });

    it("should accumulate multiple short sentences that together exceed limit", () => {
      const customConfig = { maxRequestChars: 150, safetyMargin: 10 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      const script =
        "This is the very first sentence with extra words for length. This is the second sentence also quite long. This is the third sentence making it overflow.";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(2);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("first sentence");
      expect(combined).toContain("second sentence");
      expect(combined).toContain("third sentence");
    });

    it("should handle exact boundary where sentence would exceed", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      const sentence1 = `${createText(42)}.`;
      const sentence2 = "X.";

      const result = chunkScript(`${sentence1} ${sentence2}`, customConfig);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("X");
    });

    it("should preserve punctuated text with no trailing fragment", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };
      const maxLength = 25;
      const text = "First sentence here. Second!";

      expect(text.length).toBeGreaterThan(maxLength);

      const result = chunkScript(text, customConfig);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("First sentence");
      expect(combined).toContain("Second");
    });

    it("should preserve the first sentence after starting a fresh chunk", () => {
      const customConfig = { maxRequestChars: 40, safetyMargin: 5 };
      const maxLength = 35;
      const text = "Short. This is a longer second sentence.";

      expect(text.length).toBeGreaterThan(maxLength);

      const result = chunkScript(text, customConfig);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("Short");
      expect(combined).toContain("longer second");
    });

    it("should handle text with trailing content without punctuation", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };

      const script = "First sentence here. Second part no punctuation";

      const result = chunkScript(script, customConfig);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("First sentence here");
      expect(combined).toContain("Second part no punctuation");
    });

    it("should handle long first sentence that exceeds chunk with empty currentChunk", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };

      const script = "Thisisaverylongsentencethatexceedsthelimit. Short.";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("Thisisaverylongsentence");
      expect(combined).toContain("Short");
    });

    it("should handle single word longer than chunk limit", () => {
      const customConfig = { maxRequestChars: 20, safetyMargin: 5 };

      const longWord = "supercalifragilisticexpialidocious";
      const script = longWord;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join("");
      expect(combined).toBe(longWord);
    });

    it("should handle word that exceeds limit when currentChunk is empty", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 10 };

      const script =
        "Short word. Supercalifragilisticexpialidociousisareallylongwordthatexceedslimits. More text.";

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("Short word");
      expect(combined).toContain("Supercalifragilistic");
      expect(combined).toContain("More text");
    });

    it("should handle multiple words where middle word exceeds limit alone", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };

      const word1 = "Firstword";
      const word2 = "Supercalifragilisticexpialidocious";
      const word3 = "Last";
      const script = `${word1} ${word2} ${word3}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain(word1);
      expect(combined).toContain(word2);
      expect(combined).toContain(word3);
    });

    it("should handle multiple long words that don't fit together", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };
      const maxLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;

      const word1 = "pneumonoultramicroscopic";
      const word2 = "silicovolcanoconiosis";
      const script = `${word1} ${word2}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(2);

      for (const chunk of result) {
        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
      }

      const combined = result.map((c) => c.text).join(" ");
      expect(combined).toContain("pneumonoultramicroscopic");
      expect(combined).toContain("silicovolcanoconiosis");
    });

    it("should preserve all paragraphs when processing pushes chunks eagerly", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };

      const para1 = "X".repeat(40);
      const para2 = "Y".repeat(40);
      const script = `${para1}\n\n${para2}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("X".repeat(10));
      expect(combined).toContain("Y".repeat(10));
    });

    it("should push remaining content after processing all paragraphs", () => {
      const customConfig = { maxRequestChars: 100, safetyMargin: 10 };
      const maxTextLength =
        customConfig.maxRequestChars - customConfig.safetyMargin;
      const para1 = createText(80);
      const para2 = createText(20);
      const script = `${para1}\n\n${para2}`;

      expect(script.length).toBeGreaterThan(maxTextLength);

      const result = chunkScript(script, customConfig);

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

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("First paragraph");
      expect(combined).toContain("Second paragraph");
      expect(combined).toContain("Third paragraph");
    });

    it("should never push whitespace-only chunks that trim to empty", () => {
      const customConfig = { maxRequestChars: 30, safetyMargin: 5 };

      const script = "A.\n\nB.\n\nC.";

      const result = chunkScript(script, customConfig);

      for (const chunk of result) {
        const trimmed = chunk.text.trim();
        expect(trimmed.length).toBeGreaterThan(0);
        expect(trimmed).not.toBe("");
      }

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("A.");
      expect(combined).toContain("B.");
      expect(combined).toContain("C.");
    });

    it("should filter out empty chunks at final push", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };

      const paragraphs = ["X", "Y", "Z"].map((char) => char.repeat(45));
      const script = paragraphs.join("\n\n");

      const result = chunkScript(script, customConfig);

      const nonEmptyChunks = result.filter((c) => c.text.trim().length > 0);
      expect(nonEmptyChunks.length).toBe(result.length);

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("X".repeat(10));
      expect(combined).toContain("Y".repeat(10));
      expect(combined).toContain("Z".repeat(10));
    });

    it("should drop whitespace-only trailing chunks", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };

      const para1 = "A".repeat(40);
      const para2 = "   \n\n   ";
      const script = `${para1}\n\n${para2}`;

      const result = chunkScript(script, customConfig);

      expect(result.length).toBeGreaterThanOrEqual(1);

      for (const chunk of result) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("A".repeat(10));
    });

    it("should never push empty chunks when all content is processed in paragraphs", () => {
      const customConfig = { maxRequestChars: 50, safetyMargin: 5 };

      const para1 = "X".repeat(42);
      const para2 = "Y".repeat(42);
      const script = `${para1}\n\n${para2}`;

      const result = chunkScript(script, customConfig);

      for (const chunk of result) {
        expect(chunk.text).not.toBe("");
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("X".repeat(10));
      expect(combined).toContain("Y".repeat(10));
    });

    it("should handle edge case where last paragraph pushes all content via sentences", () => {
      const customConfig = { maxRequestChars: 45, safetyMargin: 5 };

      const para1 = "Short.";
      const para2 = "A. ".repeat(20);
      const script = `${para1}\n\n${para2}`;

      const result = chunkScript(script, customConfig);

      for (const chunk of result) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }

      const combined = result.map((c) => c.text).join("");
      expect(combined).toContain("Short");
      expect(combined).toContain("A.");
    });
  });
});
