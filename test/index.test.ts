import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPdf, createVisualRuns, resolveDirection } from "../src/index.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const rtlFont = path.resolve(
  directory,
  "../node_modules/@expo-google-fonts/noto-sans-arabic/400Regular/NotoSansArabic_400Regular.ttf",
);
const ltrFont = rtlFont;

describe("BiDi layout", () => {
  it("resolves paragraph direction", () => {
    expect(resolveDirection("کوردی text", "auto")).toBe("rtl");
    expect(resolveDirection("English کوردی", "auto")).toBe("ltr");
    expect(resolveDirection("123", "rtl")).toBe("rtl");
  });

  it("keeps RTL words logical while moving mixed runs visually", () => {
    const runs = createVisualRuns("سڵاو، ژمارە 123 و کۆدی AB-42 ـە.", "rtl");
    expect(runs.filter((run) => !run.whitespace).map((run) => run.text)).toEqual([
      "ـە.",
      "AB-42",
      "کۆدی",
      "و",
      "123",
      "ژمارە",
      "سڵاو،",
    ]);
    expect(runs.find((run) => run.text === "سڵاو،")?.actualText).toBe("سڵاو، ");
  });

  it("mirrors paired punctuation in RTL runs", () => {
    const runs = createVisualRuns("دەق (تاقیکردنەوە)", "rtl");
    expect(runs.map((run) => run.text).join("")).toContain("(");
    expect(runs.map((run) => run.text).join("")).toContain(")");
  });
});

describe("createPdf", () => {
  it("creates a searchable mixed-direction PDF with metadata", async () => {
    const text = "سڵاو، ژمارەی داواکاری 12345 و کۆدی AB-42 ـە.";
    const bytes = await createPdf({
      fonts: { rtl: rtlFont, ltr: ltrFont },
      metadata: {
        title: "RTL PDF test",
        author: "Aland",
        language: "ckb",
        keywords: ["rtl", "kurdish", "pdf"],
      },
      compress: false,
      blocks: [
        { type: "text", text: "RTL PDF", direction: "ltr", fontSize: 24 },
        { type: "rule" },
        { type: "text", text, direction: "rtl", fontSize: 16 },
      ],
    });

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF-1.7");
    const content = Buffer.from(bytes);
    const source = content.toString("latin1");
    expect(source.match(/\/Type\s*\/Page\b/gu)).toHaveLength(1);
    expect(source).toContain("/ActualText");
    expect(source).toContain("(RTL PDF test)");
    expect(source).toContain("(Aland)");
    expect(readActualText(content)).toContain(text);
  });

  it("wraps long text and adds pages without clipping", async () => {
    const paragraph = "ئەمە دەقێکی تاقیکردنەوەیە بۆ پشکنینی شکاندنی دێڕ و دروستکردنی لاپەڕە. ";
    const bytes = await createPdf({
      fonts: { rtl: fs.readFileSync(rtlFont), ltr: fs.readFileSync(ltrFont) },
      page: { size: [260, 220], margins: { top: 24, right: 24, bottom: 24, left: 24 } },
      blocks: [{ type: "text", text: paragraph.repeat(20), direction: "rtl", fontSize: 12 }],
    });
    const source = Buffer.from(bytes).toString("latin1");
    expect(source.match(/\/Type\s*\/Page\b/gu)?.length ?? 0).toBeGreaterThan(1);
  });

  it("renders direction-aware ordered and unordered lists with logical text", async () => {
    const rtlItem = "یەکەم خاڵ کۆدی AB-42 و ژمارەی 123 لەخۆدەگرێت.";
    const ltrItem = "Second item contains کوردی text.";
    const bytes = await createPdf({
      fonts: { rtl: rtlFont, ltr: ltrFont },
      compress: false,
      page: { size: [320, 260], margins: { top: 24, right: 24, bottom: 24, left: 24 } },
      blocks: [
        {
          type: "list",
          ordered: true,
          start: 3,
          items: [rtlItem, ltrItem],
          fontSize: 13,
        },
        {
          type: "list",
          items: ["خاڵێکی بێ ژمارە"],
          direction: "rtl",
        },
      ],
    });

    const actualText = readActualText(Buffer.from(bytes));
    expect(actualText).toContain("3.");
    expect(actualText).toContain("4.");
    expect(actualText).toContain("•");
    expect(actualText.join("")).toContain(rtlItem);
    expect(actualText.join("")).toContain(ltrItem);
  });

  it("validates required inputs", async () => {
    await expect(createPdf({ fonts: {} as never, blocks: [] })).rejects.toThrow("fonts.rtl");
    await expect(
      createPdf({ fonts: { rtl: rtlFont }, blocks: [{ type: "spacer", height: -1 }] }),
    ).rejects.toThrow("spacer height");
    await expect(
      createPdf({
        fonts: { rtl: rtlFont },
        blocks: [{ type: "list", items: [42] as never }],
      }),
    ).rejects.toThrow("array of strings");
    await expect(
      createPdf({
        fonts: { rtl: rtlFont },
        blocks: [{ type: "list", items: ["item"], indent: 10, markerGap: 10 }],
      }),
    ).rejects.toThrow("markerGap");
  });
});

function readActualText(pdf: Buffer): string[] {
  const marker = Buffer.from("/ActualText ");
  const values: string[] = [];
  let searchFrom = 0;

  while (true) {
    const markerAt = pdf.indexOf(marker, searchFrom);
    if (markerAt === -1) return values;
    const openAt = pdf.indexOf(0x28, markerAt + marker.length);
    if (openAt === -1) return values;

    const bytes: number[] = [];
    let depth = 1;
    let index = openAt + 1;
    for (; index < pdf.length && depth > 0; index++) {
      const byte = pdf[index]!;
      if (byte === 0x5c) {
        const escaped = pdf[++index]!;
        const named = new Map([
          [0x6e, 0x0a],
          [0x72, 0x0d],
          [0x74, 0x09],
          [0x62, 0x08],
          [0x66, 0x0c],
        ]);
        if (named.has(escaped)) bytes.push(named.get(escaped)!);
        else if (escaped === 0x0d && pdf[index + 1] === 0x0a) index++;
        else if (escaped !== 0x0a && escaped !== 0x0d) bytes.push(escaped);
        continue;
      }
      if (byte === 0x28) depth++;
      if (byte === 0x29 && --depth === 0) break;
      bytes.push(byte);
    }

    const encoded = Buffer.from(bytes);
    if (encoded[0] === 0xfe && encoded[1] === 0xff) {
      const utf16 = Buffer.from(encoded.subarray(2));
      utf16.swap16();
      values.push(utf16.toString("utf16le"));
    } else {
      values.push(encoded.toString("latin1"));
    }
    searchFrom = index;
  }
}
