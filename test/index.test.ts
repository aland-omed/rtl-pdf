import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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
    expect(Buffer.from(bytes).includes(Buffer.from("/ActualText"))).toBe(true);
    const pdf = await getDocument({ data: bytes }).promise;
    expect(pdf.numPages).toBe(1);
    const metadata = await pdf.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    expect(info.Title).toBe("RTL PDF test");
    expect(info.Author).toBe("Aland");

    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const extracted = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("");
    expect(extracted).toContain("12345");
    expect(extracted).toContain("AB-42");
  });

  it("wraps long text and adds pages without clipping", async () => {
    const paragraph = "ئەمە دەقێکی تاقیکردنەوەیە بۆ پشکنینی شکاندنی دێڕ و دروستکردنی لاپەڕە. ";
    const bytes = await createPdf({
      fonts: { rtl: fs.readFileSync(rtlFont), ltr: fs.readFileSync(ltrFont) },
      page: { size: [260, 220], margins: { top: 24, right: 24, bottom: 24, left: 24 } },
      blocks: [{ type: "text", text: paragraph.repeat(20), direction: "rtl", fontSize: 12 }],
    });
    const pdf = await getDocument({ data: bytes }).promise;
    expect(pdf.numPages).toBeGreaterThan(1);
  });

  it("validates required inputs", async () => {
    await expect(createPdf({ fonts: {} as never, blocks: [] })).rejects.toThrow("fonts.rtl");
    await expect(
      createPdf({ fonts: { rtl: rtlFont }, blocks: [{ type: "spacer", height: -1 }] }),
    ).rejects.toThrow("spacer height");
  });
});
