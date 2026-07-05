const CODE_BLOCK_CONTENT_PATTERN = /code:\s*`((?:\\[\s\S]|[^`])*)`/g;
const CODE_BLOCK_FILENAME_PATTERN = /filename:\s*["']([^"']+)["']/;
const CODE_BLOCK_LANGUAGE_PATTERN = /language:\s*["']([^"']+)["']/;
const TRIPLE_BACKTICKS_PATTERN = /```/g;

/** Formats authored CodeBlock data as real markdown code fences. */
export function formatCodeBlockData(data: string) {
  if (!data) {
    return "";
  }

  const snippets = [...data.matchAll(CODE_BLOCK_CONTENT_PATTERN)].map(
    (match) => {
      const index = match.index;
      const context = data.slice(Math.max(0, index - 320), index);

      return {
        code: match[1].replace(/\\`/g, "`"),
        filename: readPattern(context, CODE_BLOCK_FILENAME_PATTERN),
        language: readPattern(context, CODE_BLOCK_LANGUAGE_PATTERN),
      };
    }
  );

  return snippets
    .filter(({ code }) => code.trim().length > 0)
    .map(formatCodeFence)
    .join("\n\n");
}

function formatCodeFence({
  code,
  filename,
  language,
}: {
  code: string;
  filename: string;
  language: string;
}) {
  const rows: string[] = [];

  if (filename) {
    rows.push(`File: ${filename}`);
  }

  rows.push(
    `\`\`\`${language}\n${code.trim().replace(TRIPLE_BACKTICKS_PATTERN, "``\\`")}\n\`\`\``
  );

  return rows.join("\n");
}

function readPattern(value: string, pattern: RegExp) {
  const match = value.match(pattern);

  if (!match) {
    return "";
  }

  return match[1];
}
