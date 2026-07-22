import PDFDocument from "pdfkit";
import { createVisualRuns, resolveDirection, type VisualRun } from "./bidi.js";
import type {
  Alignment,
  Direction,
  DocumentBlock,
  FontSource,
  PageMargins,
  RtlPdfOptions,
  TextBlock,
} from "./types.js";

export type {
  Alignment,
  Direction,
  DocumentBlock,
  FontSet,
  FontSource,
  PageMargins,
  PdfMetadata,
  RtlPdfOptions,
  RuleBlock,
  SpacerBlock,
  TextBlock,
} from "./types.js";
export { createVisualRuns, resolveDirection } from "./bidi.js";

interface MeasuredRun extends VisualRun {
  font: "rtl" | "ltr";
  width: number;
  x: number;
}

const DEFAULT_MARGINS: PageMargins = {
  top: 56,
  right: 56,
  bottom: 56,
  left: 56,
};

/** Generate a PDF containing correctly positioned RTL and mixed-direction text. */
export async function createPdf(options: RtlPdfOptions): Promise<Uint8Array> {
  validateOptions(options);
  const margins = { ...DEFAULT_MARGINS, ...options.page?.margins };
  const info: PDFKit.DocumentInfo = {};
  if (options.metadata?.title) info.Title = options.metadata.title;
  if (options.metadata?.author) info.Author = options.metadata.author;
  if (options.metadata?.subject) info.Subject = options.metadata.subject;
  if (options.metadata?.keywords) info.Keywords = options.metadata.keywords.join(", ");
  const documentOptions: PDFKit.PDFDocumentOptions = {
    autoFirstPage: false,
    bufferPages: true,
    compress: options.compress ?? true,
    displayTitle: true,
    info,
    pdfVersion: "1.7ext3",
  };
  if (options.metadata?.language) documentOptions.lang = options.metadata.language;
  const doc = new PDFDocument(documentOptions);

  registerFont(doc, "rtl", options.fonts.rtl);
  registerFont(doc, "ltr", options.fonts.ltr ?? options.fonts.rtl);

  const chunks: Uint8Array[] = [];
  doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  const completed = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(concat(chunks)));
    doc.on("error", reject);
  });

  const size = options.page?.size ?? "A4";
  addPage(doc, size, margins);
  let y = margins.top;

  const availableWidth = () => doc.page.width - margins.left - margins.right;
  const pageBottom = () => doc.page.height - margins.bottom;
  const ensureSpace = (height: number) => {
    if (y + height <= pageBottom()) return;
    addPage(doc, size, margins);
    y = margins.top;
  };

  for (const block of options.blocks) {
    if (block.type === "spacer") {
      ensureSpace(block.height);
      y += block.height;
      continue;
    }

    if (block.type === "rule") {
      const marginTop = block.marginTop ?? 4;
      const marginBottom = block.marginBottom ?? 12;
      ensureSpace(marginTop + (block.width ?? 1) + marginBottom);
      y += marginTop;
      doc
        .save()
        .lineWidth(block.width ?? 1)
        .strokeColor(block.color ?? "#d1d5db")
        .moveTo(margins.left, y)
        .lineTo(doc.page.width - margins.right, y)
        .stroke()
        .restore();
      y += (block.width ?? 1) + marginBottom;
      continue;
    }

    const style = resolveTextStyle(block, options);
    doc.fontSize(style.fontSize).fillColor(style.color);
    const paragraphs = block.text.split(/\r?\n/u);

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const paragraph = paragraphs[paragraphIndex]!;
      const lines = wrapText(doc, paragraph, availableWidth(), style.direction);
      for (const line of lines.length > 0 ? lines : [""]) {
        ensureSpace(style.lineHeight);
        if (line.length > 0) {
          drawLine(
            doc,
            line,
            margins.left,
            y,
            availableWidth(),
            style.direction,
            style.align,
          );
        }
        y += style.lineHeight;
      }
      if (paragraphIndex < paragraphs.length - 1) y += style.lineHeight * 0.25;
    }
    y += style.marginBottom;
  }

  doc.end();
  return completed;
}

function resolveTextStyle(block: TextBlock, options: RtlPdfOptions) {
  const fontSize = block.fontSize ?? options.defaults?.fontSize ?? 12;
  const multiplier = block.lineHeight ?? options.defaults?.lineHeight ?? 1.45;
  return {
    direction: block.direction ?? options.defaults?.direction ?? "auto",
    align: block.align ?? "auto",
    fontSize,
    lineHeight: fontSize * multiplier,
    color: block.color ?? options.defaults?.color ?? "#111827",
    marginBottom: block.marginBottom ?? fontSize * 0.65,
  } as const;
}

function wrapText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  direction: Direction,
): string[] {
  if (text.length === 0) return [];
  const words = text.trim().split(/\s+/u);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (measureLine(doc, candidate, direction) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line.length > 0) lines.push(line);
    if (measureLine(doc, word, direction) <= maxWidth) {
      line = word;
      continue;
    }

    const pieces = breakLongToken(doc, word, maxWidth, direction);
    lines.push(...pieces.slice(0, -1));
    line = pieces.at(-1) ?? "";
  }

  if (line.length > 0) lines.push(line);
  return lines;
}

function breakLongToken(
  doc: PDFKit.PDFDocument,
  token: string,
  maxWidth: number,
  direction: Direction,
): string[] {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(token)]
    .map(({ segment }) => segment);
  const pieces: string[] = [];
  let piece = "";
  for (const grapheme of graphemes) {
    const candidate = piece + grapheme;
    if (piece && measureLine(doc, candidate, direction) > maxWidth) {
      pieces.push(piece);
      piece = grapheme;
    } else {
      piece = candidate;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

function measureLine(doc: PDFKit.PDFDocument, text: string, direction: Direction): number {
  return createVisualRuns(text, direction).reduce((total, run) => {
    doc.font(run.level % 2 === 1 ? "rtl" : "ltr");
    return total + doc.widthOfString(run.text);
  }, 0);
}

function drawLine(
  doc: PDFKit.PDFDocument,
  text: string,
  left: number,
  y: number,
  width: number,
  direction: Direction,
  align: Alignment,
) {
  const runs = createVisualRuns(text, direction);
  const measured = runs.map<MeasuredRun>((run) => {
    const font = run.level % 2 === 1 ? "rtl" : "ltr";
    doc.font(font);
    return { ...run, font, width: doc.widthOfString(run.text), x: 0 };
  });
  const totalWidth = measured.reduce((total, run) => total + run.width, 0);
  const resolvedDirection = resolveDirection(text, direction);
  const resolvedAlign = align === "auto" ? (resolvedDirection === "rtl" ? "right" : "left") : align;
  let x =
    resolvedAlign === "right"
      ? left + width - totalWidth
      : resolvedAlign === "center"
        ? left + (width - totalWidth) / 2
        : left;

  for (const run of measured) {
    run.x = x;
    x += run.width;
  }

  doc.markContent("Span", { actual: text });
  for (const run of measured
    .filter((run) => !run.whitespace)
    .sort((a, b) => a.start - b.start)) {
    doc.font(run.font);
    doc.text(run.text, run.x, y, { lineBreak: false });
  }
  doc.endMarkedContent();
}

function registerFont(doc: PDFKit.PDFDocument, name: string, source: FontSource) {
  doc.registerFont(name, typeof source === "string" ? source : Buffer.from(source));
}

function addPage(
  doc: PDFKit.PDFDocument,
  size: "A4" | "LETTER" | [number, number],
  margins: PageMargins,
) {
  doc.addPage({ size, margins });
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function validateOptions(options: RtlPdfOptions) {
  if (!options.fonts?.rtl) throw new TypeError("fonts.rtl is required");
  if (!Array.isArray(options.blocks)) throw new TypeError("blocks must be an array");
  for (const block of options.blocks) validateBlock(block);
}

function validateBlock(block: DocumentBlock) {
  if (!block || typeof block !== "object") throw new TypeError("every block must be an object");
  if (!["text", "spacer", "rule"].includes(block.type)) {
    throw new TypeError(`unsupported block type: ${String((block as { type?: unknown }).type)}`);
  }
  if (block.type === "text" && typeof block.text !== "string") {
    throw new TypeError("text blocks require a text string");
  }
  if (block.type === "spacer" && (!Number.isFinite(block.height) || block.height < 0)) {
    throw new RangeError("spacer height must be a non-negative number");
  }
}
