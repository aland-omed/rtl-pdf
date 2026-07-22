import fs from "node:fs/promises";
import path from "node:path";
import { createPdf } from "../src/index.js";

const rtlFont = path.resolve(
  "node_modules/@expo-google-fonts/noto-sans-arabic/400Regular/NotoSansArabic_400Regular.ttf",
);
const ltrFont = rtlFont;

const pdf = await createPdf({
  compress: false,
  fonts: { rtl: rtlFont, ltr: ltrFont },
  metadata: {
    title: "RTL PDF - Mixed-language example",
    author: "Aland",
    subject: "Correct Kurdish, Arabic, and English PDF text",
    language: "ckb",
    keywords: ["rtl", "pdf", "arabic", "kurdish", "bidi"],
  },
  blocks: [
    {
      type: "text",
      text: "RTL PDF",
      direction: "ltr",
      fontSize: 30,
      color: "#0f172a",
      marginBottom: 2,
    },
    {
      type: "text",
      text: "Correct mixed-direction documents",
      direction: "ltr",
      fontSize: 12,
      color: "#64748b",
    },
    { type: "rule", color: "#cbd5e1", marginBottom: 24 },
    {
      type: "text",
      text: "کوردی",
      direction: "rtl",
      fontSize: 18,
      color: "#0369a1",
      marginBottom: 6,
    },
    {
      type: "text",
      text: "سڵاو، ژمارەی داواکاری 12345 و کۆدی AB-42 ـە. ئەم دەقە بە شێوەیەکی دروست لە ڕاستەوە بۆ چەپ دەنووسرێت و ژمارە و کۆدی ئینگلیزی تێک ناچن.",
      direction: "rtl",
      fontSize: 15,
    },
    { type: "spacer", height: 12 },
    {
      type: "text",
      text: "العربية",
      direction: "rtl",
      fontSize: 18,
      color: "#0369a1",
      marginBottom: 6,
    },
    {
      type: "text",
      text: "مرحباً، رقم الفاتورة INV-2026-123 والسعر 123.45 دولار. يبقى النص العربي متصلاً وتظهر الأرقام والرموز بالترتيب الصحيح.",
      direction: "rtl",
      fontSize: 15,
    },
    { type: "spacer", height: 12 },
    {
      type: "text",
      text: "English with کوردی and العربية stays readable: order AB-42 costs $123.45.",
      direction: "ltr",
      fontSize: 14,
      color: "#334155",
    },
  ],
});

await fs.mkdir("output/pdf", { recursive: true });
await fs.writeFile("output/pdf/rtl-pdf-mixed-example.pdf", pdf);
console.log("Created output/pdf/rtl-pdf-mixed-example.pdf");
