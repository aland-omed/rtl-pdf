# rtl-pdf

Standards-based right-to-left and mixed-direction PDF generation for Node.js.
Create searchable documents containing Arabic, Kurdish, Persian, Urdu, Hebrew,
Pashto, English, numbers, and product codes without reversing strings.

> Early release: the core text, wrapping, pagination, and PDFKit renderer are
> implemented. Tables, forms, browser support, and renderer adapters are on the
> [roadmap](ROADMAP.md).

## Why

PDF is not a browser. Many JavaScript PDF libraries shape individual Arabic
words but do not apply the Unicode Bidirectional Algorithm to complete lines.
Common workarounds reverse strings, which breaks connected letters, numbers,
punctuation, copying, and search.

`rtl-pdf` keeps source text in logical Unicode order, computes visual runs with
the Unicode BiDi algorithm, lets OpenType shape each word, and positions the
runs independently. Each line also carries PDF `/ActualText` containing the
original logical text.

## Install

```sh
npm install rtl-pdf
```

You must provide fonts that cover the scripts in your document. Fonts are not
bundled, which keeps the package smaller and avoids imposing a font license.

## Example

```ts
import fs from "node:fs/promises";
import { createPdf } from "rtl-pdf";

const pdf = await createPdf({
  fonts: {
    rtl: "./fonts/NotoSansArabic-Regular.ttf",
    ltr: "./fonts/NotoSans-Regular.ttf",
  },
  metadata: {
    title: "Invoice INV-2026-123",
    language: "ar",
  },
  blocks: [
    {
      type: "text",
      text: "الفاتورة INV-2026-123",
      direction: "rtl",
      fontSize: 24,
    },
    { type: "rule" },
    {
      type: "text",
      text: "مرحباً، السعر 123.45 دولار ورقم الطلب AB-42.",
      direction: "rtl",
      fontSize: 14,
    },
  ],
});

await fs.writeFile("invoice.pdf", pdf);
```

`createPdf()` returns a `Promise<Uint8Array>`, so it works with Node file APIs,
HTTP responses, object storage, and serverless functions.

## Blocks

### Text

```ts
{
  type: "text",
  text: "سڵاو، order AB-42 costs $123.45.",
  direction: "auto", // auto | rtl | ltr
  align: "auto",     // auto | right | left | center
  fontSize: 14,
  lineHeight: 1.45,
  color: "#111827",
  marginBottom: 8,
}
```

Text wraps automatically and flows onto new pages. Overlong tokens are split at
Unicode grapheme boundaries instead of UTF-16 code units.

### Rule

```ts
{ type: "rule", color: "#cbd5e1", width: 1 }
```

### Spacer

```ts
{ type: "spacer", height: 16 }
```

## Fonts

The `rtl` font is required. The `ltr` font defaults to the RTL font, which is
convenient when using one font with Arabic and Latin coverage. Use a separate
LTR font when the primary font is an Arabic-only subset.

Font sources can be file paths or `Uint8Array` values. Make sure your license
allows embedding the font in generated documents.

## Correctness model

- Source strings stay in logical Unicode order.
- Paragraph direction can be detected or explicitly selected.
- BiDi reordering is performed per wrapped line.
- RTL words remain logical while OpenType applies contextual shaping.
- Mirrored punctuation is handled from Unicode BiDi data.
- `/ActualText` stores the logical line for readers that support it.
- Tests cover mixed Kurdish/Arabic, Latin numbers, codes, wrapping, pagination,
  metadata, ESM, CommonJS, and package types.

The BiDi implementation is provided by [`bidi-js`](https://github.com/lojjic/bidi-js),
which implements Unicode UAX #9. Glyph shaping and PDF embedding are provided by
PDFKit and fontkit.

## Current limitations

- Node.js only in `0.1.x`.
- A single RTL font and a single LTR font are supported per document.
- Complex tables, lists, forms, annotations, and tagged PDF/UA structure are not
  implemented yet.
- PDF viewers differ in how they expose `/ActualText` through text-extraction
  APIs. The logical semantic layer remains embedded in the file.
- Unicode conformance fixtures and additional script-specific visual fixtures
  will expand before a stable `1.0.0` release.

These limits are documented deliberately. Please report real examples instead
of working around them by reversing text.

## Development

```sh
npm install
npm run check
npm run example
```

The rendered example is written to `output/pdf/rtl-pdf-mixed-example.pdf`.

## Contributing

Arabic, Kurdish, Persian, Urdu, Hebrew, Pashto, and typography contributors are
welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [ROADMAP.md](ROADMAP.md).

## Security

See [SECURITY.md](SECURITY.md). The library performs no network requests and
collects no document content.

## License

MIT © Aland
