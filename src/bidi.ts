import bidiFactory, { type EmbeddingLevels } from "bidi-js";
import type { Direction } from "./types.js";

const bidi = bidiFactory();

export interface VisualRun {
  text: string;
  actualText: string;
  start: number;
  end: number;
  level: number;
  whitespace: boolean;
}

export function resolveDirection(text: string, direction: Direction): "ltr" | "rtl" {
  if (direction !== "auto") return direction;
  const embedding = bidi.getEmbeddingLevels(text);
  return embedding.paragraphs[0]?.level === 1 ? "rtl" : "ltr";
}

/**
 * Turn logical Unicode text into left-to-right positioned shaping runs.
 * Characters inside RTL words remain in logical order so OpenType shaping
 * engines can join them correctly.
 */
export function createVisualRuns(
  text: string,
  direction: Direction = "auto",
): VisualRun[] {
  if (text.length === 0) return [];

  const resolved = resolveDirection(text, direction);
  const embedding = bidi.getEmbeddingLevels(text, resolved);
  const indices = bidi.getReorderedIndices(text, embedding);
  const mirrors = bidi.getMirroredCharactersMap(text, embedding);
  const runs: VisualRun[] = [];

  for (let cursor = 0; cursor < indices.length; ) {
    const first = indices[cursor]!;
    const next = indices[cursor + 1];
    const step = next === first - 1 ? -1 : 1;
    let visualEnd = cursor;

    while (
      visualEnd + 1 < indices.length &&
      indices[visualEnd + 1] === indices[visualEnd]! + step
    ) {
      visualEnd++;
    }

    const selected = indices.slice(cursor, visualEnd + 1);
    const start = Math.min(...selected);
    const end = Math.max(...selected) + 1;

    if (step === -1) {
      const value = text.slice(start, end);
      const tokens = [...value.matchAll(/\S+|\s+/gu)].map((match) => {
        const tokenStart = start + match.index;
        const tokenEnd = tokenStart + match[0].length;
        return makeRun(text, tokenStart, tokenEnd, embedding, mirrors);
      });
      runs.push(...tokens.reverse());
    } else {
      runs.push(makeRun(text, start, end, embedding, mirrors));
    }

    cursor = visualEnd + 1;
  }

  return addLogicalWhitespace(text, runs);
}

function makeRun(
  source: string,
  start: number,
  end: number,
  embedding: EmbeddingLevels,
  mirrors: Map<number, string>,
): VisualRun {
  let text = "";
  for (let index = start; index < end; index++) {
    text += mirrors.get(index) ?? source[index];
  }

  const actualText = source.slice(start, end);
  return {
    text,
    actualText,
    start,
    end,
    level: embedding.levels[start] ?? 0,
    whitespace: /^\s+$/u.test(actualText),
  };
}

function addLogicalWhitespace(source: string, runs: VisualRun[]): VisualRun[] {
  const contentRuns = runs.filter((run) => !run.whitespace);
  const inLogicalOrder = [...contentRuns].sort((a, b) => a.start - b.start);

  for (let index = 0; index < inLogicalOrder.length; index++) {
    const run = inLogicalOrder[index]!;
    const nextStart = inLogicalOrder[index + 1]?.start ?? source.length;
    let whitespaceEnd = run.end;
    while (whitespaceEnd < nextStart && /\s/u.test(source[whitespaceEnd]!)) {
      whitespaceEnd++;
    }
    run.actualText = source.slice(run.start, whitespaceEnd);
  }

  return runs;
}
