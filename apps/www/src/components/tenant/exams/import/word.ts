import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect";
import { strFromU8, type Unzipped, unzipSync } from "fflate";
import { ImportFileRefused } from "@/components/tenant/exams/import/file";

/** The part of a Word document that holds its body. */
const MAIN_PART = "word/document.xml";

/** The part of a Word package that names the type of every part. */
const TYPES_PART = "[Content_Types].xml";

/** The part that names the file behind each relationship of the main part, its pictures among them. */
const RELATIONS_PART = "word/_rels/document.xml.rels";

/** The folder of a Word package that holds its pictures. */
const MEDIA_FOLDER = "word/media/";

/** The picture formats a browser draws. */
const PictureType = Schema.Literals([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** The type each picture is uploaded as, by the extension of its file. */
const PICTURE_TYPES: Rec.ReadonlyRecord<string, typeof PictureType.Type> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** The namespace of relationship IDs, which a picture uses to name its file. */
const RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** The type of the main part of a Word document that carries macros (PRONOM fmt/523). */
const MACRO_TYPE = "application/vnd.ms-word.document.macroEnabled.main+xml";

/** The namespaces of WordprocessingML and of Office Math. */
const WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MATH = "http://schemas.openxmlformats.org/officeDocument/2006/math";

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

/**
 * One Word document as the import reads it: its lines of text, with each picture a browser can
 * draw marked `[image N]`; how many MathType equations it holds; and those pictures, picture N
 * at index N - 1.
 */
const WordText = Schema.Struct({
  lines: Schema.Array(Schema.String),
  mathType: Schema.Int,
  pictures: Schema.Array(
    Schema.Struct({
      bytes: Schema.Uint8Array,
      name: Schema.String,
      type: PictureType,
    })
  ),
});

/** The number of a picture by the relationship ID that names its file, or none for a picture the read leaves out. */
type PictureNumbers = (relationship: string) => Option.Option<number>;

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

/** The relationship ID that names the file of a picture: a drawing's `blip`, or an old picture's `imagedata`. */
const pictureRelationship = (picture: Element) =>
  Arr.findFirst(descendants(picture), (child) =>
    Arr.contains(["blip", "imagedata"], child.localName)
  ).pipe(
    Option.flatMap((reference) =>
      Option.fromNullOr(
        reference.getAttributeNS(RELATIONSHIP, "embed") ??
          reference.getAttributeNS(RELATIONSHIP, "id")
      )
    )
  );

/** The mark of a picture: `[image N]` for a picture the read carries, and `[image]` for any other. */
const pictureMark = (picture: Element, numbers: PictureNumbers) =>
  Option.match(Option.flatMap(pictureRelationship(picture), numbers), {
    onNone: () => "[image]",
    onSome: (number) => `[image ${number}]`,
  });

/** The text of the children of a node, in reading order. */
const childrenText = (node: Node, numbers: PictureNumbers): string =>
  Arr.join(
    Arr.map(Arr.fromIterable(node.childNodes), (child) =>
      textOf(child, numbers)
    ),
    ""
  );

/** The text of a node in reading order, with equations as Office Math XML and pictures as marks. */
const textOf = (node: Node, numbers: PictureNumbers): string => {
  if (!(node instanceof Element)) {
    return "";
  }
  if (node.namespaceURI === MATH) {
    return node.localName === "oMath"
      ? equationOf(node)
      : childrenText(node, numbers);
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
    return pictureMark(node, numbers);
  }
  return childrenText(node, numbers);
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
const lineOf = (paragraph: Element, numbers: PictureNumbers) => {
  const text = textOf(paragraph, numbers).trim();
  return Option.match(listLevelOf(paragraph), {
    onNone: () => text,
    onSome: (level) => `${"  ".repeat(level)}- ${text}`,
  });
};

/** One table as lines: a row to a line, its cells apart with a bar. */
const tableLines = (table: Element, numbers: PictureNumbers) =>
  Arr.map(childrenNamed(table, "tr"), (row) =>
    Arr.join(
      Arr.map(childrenNamed(row, "tc"), (cell) => textOf(cell, numbers).trim()),
      " | "
    )
  );

/** The lines of one block of the body: a paragraph, the rows of a table, or nothing. */
const blockLines = (block: Element, numbers: PictureNumbers) => {
  if (isWord(block, "p")) {
    return [lineOf(block, numbers)];
  }
  return isWord(block, "tbl") ? tableLines(block, numbers) : [];
};

/** The extension of a file name, in lower case. */
const extensionOf = (name: string) =>
  name.slice(name.lastIndexOf(".") + 1).toLowerCase();

/**
 * The pictures of the main part that a browser can draw, in the order the document first shows
 * them, each with its file. A picture whose file is missing or in another format, such as a
 * Windows metafile, is left out and keeps the plain mark.
 */
const picturesOf = (
  document: Document,
  relations: Document,
  parts: Unzipped
) => {
  const targets = Arr.map(
    Arr.fromIterable(relations.getElementsByTagName("Relationship")),
    (relation) => ({
      id: relation.getAttribute("Id") ?? "",
      target: relation.getAttribute("Target") ?? "",
    })
  );
  const used = Arr.dedupe(
    Arr.getSomes(
      Arr.map(
        Arr.filter(
          descendants(document.documentElement),
          (element) => isWord(element, "drawing") || isWord(element, "pict")
        ),
        pictureRelationship
      )
    )
  );
  return Arr.getSomes(
    Arr.map(used, (relationship) =>
      Option.gen(function* () {
        const { target } = yield* Arr.findFirst(
          targets,
          (candidate) => candidate.id === relationship
        );
        const name = `word/${target}`;
        const type = yield* Rec.get(PICTURE_TYPES, extensionOf(target));
        const bytes = yield* Option.fromUndefinedOr(parts[name]);
        return { bytes, name, relationship, type };
      })
    )
  );
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
const partOf = (parts: Unzipped, name: string) =>
  Effect.fromOption(Option.fromUndefinedOr(parts[name])).pipe(
    Effect.mapError(() => new ImportFileRefused({ reason: "type" }))
  );

/**
 * Reads a Word document as XML, never through an office program: the main part's paragraphs and
 * tables as lines, with every equation as Office Math XML and every picture a browser can draw
 * marked by its number, and those pictures. A ZIP without a Word main part is no Word document,
 * and a document whose main part carries macros is refused.
 */
export const readWord = Effect.fn("exams.import.word")(function* (
  bytes: Uint8Array
) {
  const parts = yield* Effect.try({
    catch: () => new ImportFileRefused({ reason: "type" }),
    try: () =>
      unzipSync(bytes, {
        filter: (file) =>
          file.name === MAIN_PART ||
          file.name === TYPES_PART ||
          file.name === RELATIONS_PART ||
          file.name.startsWith(MEDIA_FOLDER),
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
  const relations = yield* Option.match(
    Option.fromUndefinedOr(parts[RELATIONS_PART]),
    {
      onNone: () =>
        Effect.succeed(
          new DOMParser().parseFromString("<Relationships/>", "application/xml")
        ),
      onSome: parsePart,
    }
  );
  const pictures = picturesOf(document, relations, parts);
  const numbers: PictureNumbers = (relationship) =>
    Option.map(
      Arr.findFirstIndex(
        pictures,
        (picture) => picture.relationship === relationship
      ),
      (index) => index + 1
    );
  const blocks = Arr.flatMap(
    Arr.fromIterable(document.getElementsByTagNameNS(WORD, "body")),
    (body) => Arr.fromIterable(body.children)
  );
  return {
    lines: Arr.filter(
      Arr.flatMap(blocks, (block) => blockLines(block, numbers)),
      (line) => line !== ""
    ),
    mathType: Arr.length(
      Arr.filter(
        Arr.fromIterable(document.getElementsByTagNameNS(WORD, "object")),
        isMathType
      )
    ),
    pictures: Arr.map(pictures, ({ bytes: data, name, type }) => ({
      bytes: data,
      name,
      type,
    })),
  } satisfies typeof WordText.Type;
});
