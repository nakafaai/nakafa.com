import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect";
import { strFromU8, unzipSync } from "fflate";
import { ImportFileRefused } from "@/components/tenant/exams/import/file";

/** The part of a Word document that holds its body. */
const MAIN_PART = "word/document.xml";

/** The part of a Word package that names the type of every part. */
const TYPES_PART = "[Content_Types].xml";

/** The type of the main part of a Word document that carries macros (PRONOM fmt/523). */
const MACRO_TYPE = "application/vnd.ms-word.document.macroEnabled.main+xml";

/** The namespaces of WordprocessingML and of Office Math. */
const WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MATH = "http://schemas.openxmlformats.org/officeDocument/2006/math";

/** The longest part of a Word file one read carries, so a read stays near five pages of text. */
const WORD_READ_LENGTH = 12_000;

/** The WordprocessingML elements whose words a student never reads: formatting, field codes and deleted text. */
const SKIPPED = [
  "rPr",
  "pPr",
  "tblPr",
  "instrText",
  "delText",
  "del",
  "fldChar",
];

/** The elements of Office Math that only style an equation, which the read leaves out. */
const MATH_STYLE = ["rPr", "ctrlPr"];

/** One Word document as the import reads it: its lines of text, and how many MathType equations it holds. */
const WordText = Schema.Struct({
  lines: Schema.Array(Schema.String),
  mathType: Schema.Int,
});

/** A list level, which Word writes as the text of a number. */
const ListLevel = Schema.FiniteFromString;

/** Whether a node is a WordprocessingML element of this name. */
const isWord = (node: Node, name: string): node is Element =>
  node instanceof Element &&
  node.namespaceURI === WORD &&
  node.localName === name;

/** The child elements of an element that are WordprocessingML elements of this name. */
const childrenNamed = (element: Element, name: string) =>
  Arr.filter(Arr.fromIterable(element.children), (child) =>
    isWord(child, name)
  );

/** The elements below an element, in document order. */
const descendants = (element: Element) =>
  Arr.fromIterable(element.getElementsByTagName("*"));

/**
 * An equation as Office Math XML without its styling, which Nina turns into LaTeX. The parsed
 * document is the read's own, so its styling is removed in place.
 */
const equationOf = (math: Element) => {
  Arr.forEach(
    Arr.filter(descendants(math), (child) =>
      Arr.contains(MATH_STYLE, child.localName)
    ),
    (style) => style.remove()
  );
  return new XMLSerializer().serializeToString(math);
};

/** Whether an embedded object is a MathType equation, which the read cannot turn into text. */
const isMathType = (object: Element) =>
  Arr.some(descendants(object), (child) =>
    (child.getAttribute("ProgID") ?? "").startsWith("Equation")
  );

/** The text of the children of a node, in reading order. */
const childrenText = (node: Node): string =>
  Arr.join(Arr.map(Arr.fromIterable(node.childNodes), textOf), "");

/** The text of a node in reading order, with equations as Office Math XML and pictures as a mark. */
const textOf = (node: Node): string => {
  if (!(node instanceof Element)) {
    return "";
  }
  if (node.namespaceURI === MATH) {
    return node.localName === "oMath" ? equationOf(node) : childrenText(node);
  }
  if (node.namespaceURI === WORD && Arr.contains(SKIPPED, node.localName)) {
    return "";
  }
  if (isWord(node, "t")) {
    return Arr.join(
      Arr.map(
        Arr.filter(
          Arr.fromIterable(node.childNodes),
          (child): child is Text => child instanceof Text
        ),
        (text) => text.data
      ),
      ""
    );
  }
  if (isWord(node, "tab")) {
    return "\t";
  }
  if (isWord(node, "br") || isWord(node, "cr")) {
    return " ";
  }
  if (isWord(node, "object")) {
    return isMathType(node) ? "[equation image]" : "[image]";
  }
  if (isWord(node, "drawing") || isWord(node, "pict")) {
    return "[image]";
  }
  return childrenText(node);
};

/** The list level of a paragraph that Word numbers, or none for a paragraph outside a list. */
const listLevelOf = (paragraph: Element) =>
  Arr.findFirst(
    Arr.fromIterable(paragraph.getElementsByTagNameNS(WORD, "numPr")),
    () => true
  ).pipe(
    Option.flatMap((numbering) =>
      Arr.findFirst(childrenNamed(numbering, "ilvl"), () => true)
    ),
    Option.flatMap((level) =>
      Option.fromNullOr(level.getAttributeNS(WORD, "val"))
    ),
    Option.flatMap(Schema.decodeOption(ListLevel))
  );

/**
 * One paragraph as a line. A numbered paragraph starts with a dash, indented by its list level,
 * because Word writes its number as formatting, not text: that keeps each question and each
 * option apart for Nina.
 */
const lineOf = (paragraph: Element) => {
  const text = textOf(paragraph).trim();
  return Option.match(listLevelOf(paragraph), {
    onNone: () => text,
    onSome: (level) => `${"  ".repeat(level)}- ${text}`,
  });
};

/** One table as lines: a row to a line, its cells apart with a bar. */
const tableLines = (table: Element) =>
  Arr.map(childrenNamed(table, "tr"), (row) =>
    Arr.join(
      Arr.map(childrenNamed(row, "tc"), (cell) => textOf(cell).trim()),
      " | "
    )
  );

/** The lines of one block of the body: a paragraph, the rows of a table, or nothing. */
const blockLines = (block: Element) => {
  if (isWord(block, "p")) {
    return [lineOf(block)];
  }
  return isWord(block, "tbl") ? tableLines(block) : [];
};

/** Parses one XML part of the package; a part that does not parse refuses the file. */
const parsePart = (bytes: Uint8Array) =>
  Effect.gen(function* () {
    const document = new DOMParser().parseFromString(
      strFromU8(bytes),
      "application/xml"
    );
    if (document.getElementsByTagName("parsererror").length > 0) {
      return yield* new ImportFileRefused({ reason: "type" });
    }
    return document;
  });

/** One part of the package, or a refusal of the file as no Word document when it is missing. */
const partOf = (parts: Rec.ReadonlyRecord<string, Uint8Array>, name: string) =>
  Effect.fromOption(Rec.get(parts, name)).pipe(
    Effect.mapError(() => new ImportFileRefused({ reason: "type" }))
  );

/**
 * Reads a Word document as XML, never through an office program: the main part's paragraphs and
 * tables as lines, with every equation as Office Math XML. A ZIP without a Word main part is no
 * Word document, and a document whose main part carries macros is refused.
 */
export const readWord = Effect.fn("exams.import.word")(function* (
  bytes: Uint8Array
) {
  const parts = yield* Effect.try({
    catch: () => new ImportFileRefused({ reason: "type" }),
    try: () =>
      unzipSync(bytes, {
        filter: (file) => file.name === MAIN_PART || file.name === TYPES_PART,
      }),
  });
  const declared = yield* parsePart(yield* partOf(parts, TYPES_PART));
  if (
    Arr.some(
      Arr.fromIterable(declared.getElementsByTagName("*")),
      (element) => element.getAttribute("ContentType") === MACRO_TYPE
    )
  ) {
    return yield* new ImportFileRefused({ reason: "macro" });
  }
  const document = yield* parsePart(yield* partOf(parts, MAIN_PART));
  const blocks = Arr.flatMap(
    Arr.fromIterable(document.getElementsByTagNameNS(WORD, "body")),
    (body) => Arr.fromIterable(body.children)
  );
  return {
    lines: Arr.filter(Arr.flatMap(blocks, blockLines), (line) => line !== ""),
    mathType: Arr.length(
      Arr.filter(
        Arr.fromIterable(document.getElementsByTagNameNS(WORD, "object")),
        isMathType
      )
    ),
  } satisfies typeof WordText.Type;
});

/**
 * The reads of a Word document: its lines in parts of at most `length` characters. A part ends
 * before a line that starts a top-level list item when one is in its second half, so a numbered
 * question stays whole; otherwise it ends where the length runs out. A single line longer than a
 * part is a part of its own.
 */
export const wordReads = (
  lines: readonly string[],
  length = WORD_READ_LENGTH
): string[] => {
  if (!Arr.isReadonlyArrayNonEmpty(lines)) {
    return [];
  }
  const totals = Arr.drop(
    Arr.scan(lines, 0, (sum, line) => sum + line.length + 1),
    1
  );
  const end = Math.max(
    Arr.length(Arr.filter(totals, (total) => total <= length)),
    1
  );
  const starts = Arr.filter(
    Arr.makeBy(end, (index) => index),
    (index) =>
      index >= Math.ceil(end / 2) &&
      Option.exists(Arr.get(lines, index), (line) => line.startsWith("- "))
  );
  const cut =
    end < lines.length ? Option.getOrElse(Arr.last(starts), () => end) : end;
  return [
    Arr.join(Arr.take(lines, cut), "\n"),
    ...wordReads(Arr.drop(lines, cut), length),
  ];
};
