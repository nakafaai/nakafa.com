const CODE_BLOCK_CONTENT_PATTERN = /code:\s*`((?:\\[\s\S]|[^`])*)`/g;
const CODE_BLOCK_FILENAME_PATTERN = /filename:\s*["']([^"']+)["']/;
const CODE_BLOCK_LANGUAGE_PATTERN = /language:\s*["']([^"']+)["']/;
const TRIPLE_BACKTICKS_PATTERN = /```/g;
const TEMPLATE_LITERAL_ESCAPE_PATTERN = /\\([\\`$])/g;

/** Formats authored CodeBlock data as real markdown code fences. */
export function formatCodeBlockData(data: string) {
  if (!data) {
    return "";
  }

  const snippets: string[] = [];

  for (const match of data.matchAll(CODE_BLOCK_CONTENT_PATTERN)) {
    const index = match.index;
    const context = data.slice(Math.max(0, index - 320), index);
    const snippet = {
      code: decodeTemplateLiteralCode(match[1]),
      filename: readPattern(context, CODE_BLOCK_FILENAME_PATTERN),
      language: readPattern(context, CODE_BLOCK_LANGUAGE_PATTERN),
    };

    if (!snippet.code.trim()) {
      continue;
    }

    snippets.push(formatCodeFence(snippet));
  }

  return snippets.join("\n\n");
}

/** Decodes the source escapes that JavaScript template literals cook at runtime. */
function decodeTemplateLiteralCode(value: string) {
  return value.replace(TEMPLATE_LITERAL_ESCAPE_PATTERN, "$1");
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
