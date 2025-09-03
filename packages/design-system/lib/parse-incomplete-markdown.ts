const linkImagePattern = /(!?\[)([^\]]*?)$/;
const boldPattern = /(\*\*)([^*]*?)$/;
const italicPattern = /(__)([^_]*?)$/;
const boldItalicPattern = /(\*\*\*)([^*]*?)$/;
const singleAsteriskPattern = /(\*)([^*]*?)$/;
const singleUnderscorePattern = /(_)([^_]*?)$/;
const inlineCodePattern = /(`)([^`]*?)$/;
const strikethroughPattern = /(~~)([^~]*?)$/;
const inlineTripleBacktickPattern = /^```[^`\n]*```?$/;
const consecutiveAsterisksPattern = /^\*{4,}$/;
const listBulletPattern = /^\s*[-*+]\s/;

// Constants for magic numbers
const TRIPLE_ASTERISK_LENGTH = 3;

// Helper function to check if we have a complete code block
function hasCompleteCodeBlock(text: string): boolean {
  const tripleBackticks = (text.match(/```/g) || []).length;
  return (
    tripleBackticks > 0 && tripleBackticks % 2 === 0 && text.includes("\n")
  );
}

// Handles incomplete links and images by removing them if not closed
function handleIncompleteLinksAndImages(text: string): string {
  const linkMatch = text.match(linkImagePattern);

  if (linkMatch) {
    const startIndex = text.lastIndexOf(linkMatch[1]);
    return text.substring(0, startIndex);
  }

  return text;
}

// Completes incomplete bold formatting (**)
function handleIncompleteBold(text: string): string {
  // Don't process if inside a complete code block
  if (hasCompleteCodeBlock(text)) {
    return text;
  }

  const boldMatch = text.match(boldPattern);

  if (boldMatch) {
    const asteriskPairs = (text.match(/\*\*/g) || []).length;
    if (asteriskPairs % 2 === 1) {
      return `${text}**`;
    }
  }

  return text;
}

// Completes incomplete italic formatting with double underscores (__)
function handleIncompleteDoubleUnderscoreItalic(text: string): string {
  const italicMatch = text.match(italicPattern);

  if (italicMatch) {
    const underscorePairs = (text.match(/__/g) || []).length;
    if (underscorePairs % 2 === 1) {
      return `${text}__`;
    }
  }

  return text;
}

// Counts single asterisks that are not part of double asterisks and not escaped
// Excludes asterisks used as list bullets
function countSingleAsterisks(text: string): number {
  return text.split("").reduce((acc, char, index) => {
    if (char === "*") {
      const prevChar = text[index - 1];
      const nextChar = text[index + 1];
      // Skip if escaped with backslash
      if (prevChar === "\\") {
        return acc;
      }
      // Skip if this is a list bullet asterisk
      if (isListBulletAsterisk(text, index)) {
        return acc;
      }
      if (prevChar !== "*" && nextChar !== "*") {
        return acc + 1;
      }
    }
    return acc;
  }, 0);
}

// Checks if an asterisk at the given index is used as a list bullet
function isListBulletAsterisk(text: string, asteriskIndex: number): boolean {
  const nextChar = text[asteriskIndex + 1];

  // List bullets must be followed by a space
  if (nextChar !== " ") {
    return false;
  }

  // Check if this asterisk is at the start of a line (after newline + optional whitespace)
  // or at the very beginning of the text
  if (asteriskIndex === 0) {
    return true;
  }

  // Look backwards to see if we're at the start of a line
  let i = asteriskIndex - 1;
  while (i >= 0 && (text[i] === " " || text[i] === "\t")) {
    i--;
  }

  // If we reached a newline or the start of text, this is a list bullet
  return i < 0 || text[i] === "\n";
}

// Completes incomplete italic formatting with single asterisks (*)
function handleIncompleteSingleAsteriskItalic(text: string): string {
  // Don't process if inside a complete code block
  if (hasCompleteCodeBlock(text)) {
    return text;
  }

  const singleAsteriskMatch = text.match(singleAsteriskPattern);

  if (singleAsteriskMatch) {
    const singleAsterisks = countSingleAsterisks(text);
    if (singleAsterisks % 2 === 1) {
      return `${text}*`;
    }
  }

  return text;
}

// Counts single underscores that are not part of double underscores and not escaped
// Excludes underscores in math expressions and after list bullets
function countSingleUnderscores(text: string): number {
  return text.split("").reduce((acc, char, index) => {
    if (char === "_") {
      const prevChar = text[index - 1];
      const nextChar = text[index + 1];
      // Skip if escaped with backslash
      if (prevChar === "\\") {
        return acc;
      }
      // Skip if this underscore is inside a math expression
      if (isInsideMathExpression(text, index)) {
        return acc;
      }
      // Skip if this underscore appears after a list bullet
      if (isAfterListBullet(text, index)) {
        return acc;
      }
      if (prevChar !== "_" && nextChar !== "_") {
        return acc + 1;
      }
    }
    return acc;
  }, 0);
}

// Checks if an underscore at the given index is inside a math expression
// Supports: $...$, $$...$$, \(...\), \[...\]
function isInsideMathExpression(
  text: string,
  underscoreIndex: number
): boolean {
  return (
    isInsideBlockMath(text, underscoreIndex) ||
    isInsideInlineMath(text, underscoreIndex)
  );
}

// Checks if position is inside block math ($$...$$) or LaTeX display math (\[...\])
function isInsideBlockMath(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);
  const afterText = text.substring(position);

  // Check $$...$$
  const beforeDollarMatches = beforeText.match(/\$\$/g) || [];
  const afterDollarMatches = afterText.match(/\$\$/g) || [];
  if (beforeDollarMatches.length % 2 === 1 && afterDollarMatches.length > 0) {
    return true;
  }

  // Check \[...\]
  const beforeBracketMatch = beforeText.lastIndexOf("\\[");
  const beforeBracketCloseMatch = beforeText.lastIndexOf("\\]");
  if (
    beforeBracketMatch !== -1 &&
    (beforeBracketCloseMatch === -1 ||
      beforeBracketMatch > beforeBracketCloseMatch)
  ) {
    const afterBracketCloseMatch = afterText.indexOf("\\]");
    if (afterBracketCloseMatch !== -1) {
      return true;
    }
  }

  return false;
}

// Checks if position is inside inline math ($...$) or LaTeX inline math (\(...\))
function isInsideInlineMath(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);
  const afterText = text.substring(position);

  // Check $...$
  let dollarCount = 0;
  for (let i = 0; i < position; i++) {
    if (
      text[i] === "$" &&
      text[i + 1] !== "$" &&
      text[i - 1] !== "$" &&
      text[i - 1] !== "\\"
    ) {
      dollarCount++;
    }
  }
  if (dollarCount % 2 === 1) {
    for (let i = position + 1; i < text.length; i++) {
      if (
        text[i] === "$" &&
        text[i + 1] !== "$" &&
        text[i - 1] !== "$" &&
        text[i - 1] !== "\\"
      ) {
        return true;
      }
    }
  }

  // Check \(...\)
  const beforeParenMatch = beforeText.lastIndexOf("\\(");
  const beforeParenCloseMatch = beforeText.lastIndexOf("\\)");
  if (
    beforeParenMatch !== -1 &&
    (beforeParenCloseMatch === -1 || beforeParenMatch > beforeParenCloseMatch)
  ) {
    const afterParenCloseMatch = afterText.indexOf("\\)");
    if (afterParenCloseMatch !== -1) {
      return true;
    }
  }

  return false;
}

// Checks if an underscore appears after a list bullet (-, *, +)
function isAfterListBullet(text: string, underscoreIndex: number): boolean {
  // Look backwards from the underscore to find the start of the current line
  let lineStart = underscoreIndex;
  while (lineStart > 0 && text[lineStart - 1] !== "\n") {
    lineStart--;
  }

  // Check if this line starts with a list bullet (optionally preceded by whitespace)
  const lineContent = text.substring(
    lineStart,
    text.indexOf("\n", underscoreIndex) || text.length
  );
  const listBulletMatch = lineContent.match(listBulletPattern);

  return !!listBulletMatch;
}

// Completes incomplete italic formatting with single underscores (_)
function handleIncompleteSingleUnderscoreItalic(text: string): string {
  // Don't process if inside a complete code block
  if (hasCompleteCodeBlock(text)) {
    return text;
  }

  const singleUnderscoreMatch = text.match(singleUnderscorePattern);

  if (singleUnderscoreMatch) {
    const singleUnderscores = countSingleUnderscores(text);
    if (singleUnderscores % 2 === 1) {
      return `${text}_`;
    }
  }

  return text;
}

// Checks if a backtick at position i is part of a triple backtick sequence
function isPartOfTripleBacktick(text: string, i: number): boolean {
  const TRIPLE_BACKTICK_LENGTH = 3;
  const isTripleStart = text.substring(i, i + TRIPLE_BACKTICK_LENGTH) === "```";
  const isTripleMiddle = i > 0 && text.substring(i - 1, i + 2) === "```";
  const isTripleEnd = i > 1 && text.substring(i - 2, i + 1) === "```";

  return isTripleStart || isTripleMiddle || isTripleEnd;
}

// Counts single backticks that are not part of triple backticks
function countSingleBackticks(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "`" && !isPartOfTripleBacktick(text, i)) {
      count++;
    }
  }
  return count;
}

// Completes incomplete inline code formatting (`)
// Avoids completing if inside an incomplete code block
function handleIncompleteInlineCode(text: string): string {
  // Check if we have inline triple backticks (starts with ``` and should end with ```)
  // This pattern should ONLY match truly inline code (no newlines)
  // Examples: ```code``` or ```python code```
  const inlineTripleBacktickMatch = text.match(inlineTripleBacktickPattern);
  if (inlineTripleBacktickMatch && !text.includes("\n")) {
    // Check if it ends with exactly 2 backticks (incomplete)
    if (text.endsWith("``") && !text.endsWith("```")) {
      return `${text}\``;
    }
    // Already complete inline triple backticks
    return text;
  }

  // Check if we're inside a multi-line code block (complete or incomplete)
  const allTripleBackticks = (text.match(/```/g) || []).length;
  const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;

  // Special case: if text ends with ```\n (triple backticks followed by newline)
  // This is actually a complete code block, not incomplete
  if (
    (text.endsWith("```\n") || text.endsWith("```")) &&
    allTripleBackticks % 2 === 0
  ) {
    return text;
  }

  // Don't modify text if we have complete multi-line code blocks (even pairs of ```)
  if (
    allTripleBackticks > 0 &&
    allTripleBackticks % 2 === 0 &&
    text.includes("\n")
  ) {
    // We have complete multi-line code blocks, don't add any backticks
    return text;
  }

  const inlineCodeMatch = text.match(inlineCodePattern);

  if (inlineCodeMatch && !insideIncompleteCodeBlock) {
    const singleBacktickCount = countSingleBackticks(text);
    if (singleBacktickCount % 2 === 1) {
      return `${text}\``;
    }
  }

  return text;
}

// Completes incomplete strikethrough formatting (~~)
function handleIncompleteStrikethrough(text: string): string {
  const strikethroughMatch = text.match(strikethroughPattern);

  if (strikethroughMatch) {
    const tildePairs = (text.match(/~~/g) || []).length;
    if (tildePairs % 2 === 1) {
      return `${text}~~`;
    }
  }

  return text;
}

// Counts triple asterisks that are not part of quadruple or more asterisks
function countTripleAsterisks(text: string): number {
  let count = 0;
  const matches = text.match(/\*+/g) || [];

  for (const match of matches) {
    // Count how many complete triple asterisks are in this sequence
    const asteriskCount = match.length;
    if (asteriskCount >= TRIPLE_ASTERISK_LENGTH) {
      // Each group of exactly 3 asterisks counts as one triple asterisk marker
      count += Math.floor(asteriskCount / TRIPLE_ASTERISK_LENGTH);
    }
  }

  return count;
}

// Completes incomplete bold-italic formatting (***)
function handleIncompleteBoldItalic(text: string): string {
  // Don't process if inside a complete code block
  if (hasCompleteCodeBlock(text)) {
    return text;
  }

  // Don't process if text is only asterisks and has 4 or more consecutive asterisks
  // This prevents cases like **** from being treated as incomplete ***
  if (consecutiveAsterisksPattern.test(text)) {
    return text;
  }

  const boldItalicMatch = text.match(boldItalicPattern);

  if (boldItalicMatch) {
    const tripleAsteriskCount = countTripleAsterisks(text);
    if (tripleAsteriskCount % 2 === 1) {
      return `${text}***`;
    }
  }

  return text;
}

// Parses markdown text and removes incomplete tokens to prevent partial rendering
export function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  // Handle incomplete links and images first (removes content)
  result = handleIncompleteLinksAndImages(result);

  // Handle various formatting completions
  // Handle triple asterisks first (most specific)
  result = handleIncompleteBoldItalic(result);
  result = handleIncompleteBold(result);
  result = handleIncompleteDoubleUnderscoreItalic(result);
  result = handleIncompleteSingleAsteriskItalic(result);
  result = handleIncompleteSingleUnderscoreItalic(result);
  result = handleIncompleteInlineCode(result);
  result = handleIncompleteStrikethrough(result);

  return result;
}
