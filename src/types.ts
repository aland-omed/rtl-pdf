export type Direction = "auto" | "ltr" | "rtl";
export type Alignment = "auto" | "left" | "right" | "center";
export type FontSource = string | Uint8Array;

export interface FontSet {
  /** Font used for Arabic, Hebrew, and other RTL runs. */
  rtl: FontSource;
  /** Font used for Latin and other LTR runs. Defaults to `rtl`. */
  ltr?: FontSource;
}

export interface TextBlock {
  type: "text";
  text: string;
  direction?: Direction;
  align?: Alignment;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  marginBottom?: number;
}

export interface ListBlock {
  type: "list";
  items: string[];
  ordered?: boolean;
  /** First number for ordered lists. Default: 1. */
  start?: number;
  direction?: Direction;
  align?: Alignment;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  marginBottom?: number;
  /** Space reserved for the marker and its gap. */
  indent?: number;
  markerGap?: number;
}

export interface SpacerBlock {
  type: "spacer";
  height: number;
}

export interface RuleBlock {
  type: "rule";
  color?: string;
  width?: number;
  marginTop?: number;
  marginBottom?: number;
}

export type DocumentBlock = TextBlock | ListBlock | SpacerBlock | RuleBlock;

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  language?: string;
}

export interface RtlPdfOptions {
  fonts: FontSet;
  blocks: DocumentBlock[];
  metadata?: PdfMetadata;
  page?: {
    size?: "A4" | "LETTER" | [number, number];
    margins?: Partial<PageMargins>;
  };
  defaults?: {
    direction?: Direction;
    fontSize?: number;
    lineHeight?: number;
    color?: string;
  };
  /** Compress PDF content streams. Default: true. */
  compress?: boolean;
}
