import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { strFromU8, strToU8, zipSync } from "fflate";
import { MathTypeUnread } from "@/components/tenant/exams/import/mathtype/errors";
import { readWord } from "@/components/tenant/exams/import/word";

/** The MathType reader, which has its own tests: here an object's bytes say how it reads. */
const reader = vi.hoisted(() => ({ mathTypeEquation: vi.fn() }));
vi.mock("@/components/tenant/exams/import/mathtype/equation", () => reader);

/** The path of the MathType reader, which the Word read loads only for a document that needs it. */
const READER = "@/components/tenant/exams/import/mathtype/equation";

/** The namespaces a Word main part declares. */
const NAMESPACES =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** The content types of a Word package, with the type of its main part. */
const typesOf = (mainType: string) =>
  `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="${mainType}"/></Types>`;

/** The type of the main part of an ordinary Word document. */
const DOCUMENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

/** A Word package of these parts, zipped as Word writes one. */
const docx = (parts: Rec.ReadonlyRecord<string, string>) =>
  zipSync(Rec.map(parts, (text) => strToU8(text)));

/** A Word document whose body holds this WordprocessingML. */
const documentWith = (body: string) =>
  docx({
    "[Content_Types].xml": typesOf(DOCUMENT_TYPE),
    "word/document.xml": `<?xml version="1.0"?><w:document ${NAMESPACES}><w:body>${body}</w:body></w:document>`,
  });

describe("readWord", () => {
  it.effect(
    "reads paragraphs, numbered items by level, tables, equations as Office Math XML, and pictures as marks",
    () =>
      Effect.gen(function* () {
        const read = yield* readWord(
          documentWith(
            Arr.join(
              [
                '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Hasil dari</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><m:oMath><m:r><w:rPr><w:i/></w:rPr><m:t>x</m:t></m:r><m:ctrlPr/></m:oMath><w:r><w:tab/><w:t>adalah</w:t><w:br/><w:t>berapa</w:t><w:cr/><w:t>?</w:t></w:r></w:p>',
                '<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>4</w:t></w:r><w:del><w:r><w:delText>5</w:delText></w:r></w:del></w:p>',
                "<w:p></w:p>",
                "<w:p><m:oMathPara><m:oMath><m:r><m:t>y</m:t></m:r></m:oMath></m:oMathPara></w:p>",
                '<w:p> <w:r><w:drawing/></w:r><w:r><w:pict/></w:r><w:r><w:object><v:shape/><o:OLEObject ProgID="Equation.DSMT4"/></w:object></w:r><w:r><w:object><o:OLEObject ProgID="Excel.Sheet"/></w:object></w:r></w:p>',
                "<w:tbl><w:tblPr/><w:tr><w:tc><w:p><w:r><w:t>Nama</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Nilai</w:t></w:r></w:p></w:tc></w:tr></w:tbl>",
                "<w:sectPr/>",
              ],
              ""
            )
          )
        );
        expect(read.mathType).toBe(1);
        expect(read.lines).toEqual([
          '- Hasil dari <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x</m:t></m:r></m:oMath>\tadalah berapa ?',
          "  - 4",
          '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>y</m:t></m:r></m:oMath>',
          "[image][image][equation image][image]",
          "Nama | Nilai",
        ]);
      })
  );

  it.effect("refuses a Word document that carries macros", () =>
    Effect.gen(function* () {
      const refusal = yield* readWord(
        docx({
          "[Content_Types].xml": typesOf(
            "application/vnd.ms-word.document.macroEnabled.main+xml"
          ),
          "word/document.xml": `<w:document ${NAMESPACES}/>`,
        })
      ).pipe(Effect.flip);
      expect(refusal).toMatchObject({ reason: "macro" });
    })
  );

  it.effect(
    "refuses a ZIP that holds no Word document, a part that is no XML, and bytes that are no ZIP",
    () =>
      Effect.gen(function* () {
        const refusals = yield* Effect.forEach(
          [
            docx({ "[Content_Types].xml": typesOf(DOCUMENT_TYPE) }),
            docx({ "word/document.xml": `<w:document ${NAMESPACES}/>` }),
            docx({
              "[Content_Types].xml": typesOf(DOCUMENT_TYPE),
              "word/document.xml": "<w:document",
            }),
            new TextEncoder().encode("PK not a zip"),
          ],
          (bytes) => readWord(bytes).pipe(Effect.flip)
        );
        expect(Arr.map(refusals, (refusal) => refusal.reason)).toEqual([
          "type",
          "type",
          "type",
          "type",
        ]);
      })
  );
});

describe("readWord pictures", () => {
  it.effect(
    "numbers the pictures a browser draws in the order the text first shows them, and keeps their files",
    () =>
      Effect.gen(function* () {
        const read = yield* readWord(
          docx({
            "[Content_Types].xml": typesOf(DOCUMENT_TYPE),
            "word/_rels/document.xml.rels":
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Target="media/image1.png"/><Relationship Id="rId6" Target="media/image2.emf"/><Relationship Id="rId7" Target="media/image3.jpeg"/><Relationship Id="rId8" Target="media/missing.png"/><Relationship Target="media/image1.png"/><Relationship Id="rId9"/></Relationships>',
            "word/document.xml": `<?xml version="1.0"?><w:document ${NAMESPACES}><w:body><w:p><w:r><w:t>Gambar</w:t></w:r><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:r><w:r><w:pict><v:imagedata r:id="rId7"/></w:pict></w:r><w:r><w:drawing><a:blip r:embed="rId6"/></w:drawing></w:r><w:r><w:drawing><a:blip r:embed="rId8"/></w:drawing></w:r><w:r><w:drawing><a:blip/></w:drawing></w:r></w:p></w:body></w:document>`,
            "word/media/image1.png": "png",
            "word/media/image2.emf": "emf",
            "word/media/image3.jpeg": "jpeg",
          })
        );
        expect(read.lines).toEqual([
          "Gambar[image 1]",
          "[image 2][image 1][image][image][image]",
        ]);
        expect(
          Arr.map(read.pictures, (picture) => [picture.name, picture.type])
        ).toEqual([
          ["word/media/image3.jpeg", "image/jpeg"],
          ["word/media/image1.png", "image/png"],
        ]);
      })
  );

  it.effect(
    "reads a document without relationships as one without pictures",
    () =>
      Effect.gen(function* () {
        const read = yield* readWord(
          documentWith(
            '<w:p><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p>'
          )
        );
        expect(read).toMatchObject({ lines: ["[image]"], pictures: [] });
      })
  );
});

/** A Word document with three MathType objects: one the reader reads, one it cannot, one with no file. */
const mathTypeDocument = () =>
  docx({
    "[Content_Types].xml": typesOf(DOCUMENT_TYPE),
    "word/_rels/document.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Target="embeddings/oleObject1.bin"/><Relationship Id="rId4" Target="embeddings/oleObject2.bin"/><Relationship Id="rId5" Target="embeddings/oleObject3.bin"/></Relationships>',
    "word/document.xml": `<?xml version="1.0"?><w:document ${NAMESPACES}><w:body><w:p><w:r><w:t xml:space="preserve">Hasil dari </w:t></w:r><w:r><w:object><v:shape/><o:OLEObject ProgID="Equation.DSMT4" r:id="rId3"/></w:object></w:r><w:r><w:t xml:space="preserve"> adalah </w:t></w:r><w:r><w:object><o:OLEObject ProgID="Equation.DSMT4" r:id="rId4"/></w:object></w:r></w:p><w:p><w:r><w:object><o:OLEObject ProgID="Equation.3" r:id="rId5"/></w:object></w:r></w:p></w:body></w:document>`,
    "word/embeddings/oleObject1.bin": "square",
    "word/embeddings/oleObject2.bin": "long division",
  });

describe("readWord MathType", () => {
  it.effect(
    "writes each MathType equation the reader reads as LaTeX, and counts the ones that keep their picture",
    () =>
      Effect.gen(function* () {
        reader.mathTypeEquation.mockImplementation((ole: Uint8Array) =>
          strFromU8(ole) === "square"
            ? Effect.succeed("x^{2}")
            : Effect.fail(new MathTypeUnread({ reason: "unsupported" }))
        );
        const read = yield* readWord(mathTypeDocument());
        expect(read.lines).toEqual([
          "Hasil dari \\(x^{2}\\) adalah [equation image]",
          "[equation image]",
        ]);
        expect(read.mathType).toBe(2);
      })
  );

  it.effect("keeps every MathType picture when the reader does not load", () =>
    Effect.gen(function* () {
      vi.resetModules();
      vi.doMock(READER, () => {
        throw new Error("The reader's chunk is gone.");
      });
      const fresh = yield* Effect.promise(
        () => import("@/components/tenant/exams/import/word")
      );
      const read = yield* fresh.readWord(mathTypeDocument());
      vi.doMock(READER, () => reader);
      expect(read.lines).toEqual([
        "Hasil dari [equation image] adalah [equation image]",
        "[equation image]",
      ]);
      expect(read.mathType).toBe(3);
    })
  );
});
