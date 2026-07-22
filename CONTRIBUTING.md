# Contributing

Thank you for helping make documents work for right-to-left languages.

## Before contributing

For rendering bugs, include:

- Logical input text in a code block
- Language and script
- Expected visual order
- Font name, source, and license
- A screenshot or minimal PDF when possible
- Whether copying and searching the text works

Never submit private invoices, identity documents, contracts, or personal data.
Replace sensitive values with representative test data.

## Development

Use Node.js 18 or newer.

```sh
npm install
npm run check
npm run example
```

Every rendering change needs a focused unit test and, when visual output changes,
an updated example or golden fixture. Do not fix RTL text by reversing code
points or replacing logical text with Arabic Presentation Forms.

## Pull requests

- Keep changes focused and explain the affected writing system.
- Cite the relevant Unicode or language-layout rule when applicable.
- Confirm that `npm run check` passes.
- Verify the generated PDF visually.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Contributions are licensed under the repository's MIT License.
