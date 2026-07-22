declare module "bidi-js" {
  export interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }

  export interface Bidi {
    getEmbeddingLevels(text: string, direction?: "ltr" | "rtl"): EmbeddingLevels;
    getReorderedIndices(
      text: string,
      embedding: EmbeddingLevels,
      start?: number,
      end?: number,
    ): number[];
    getMirroredCharactersMap(
      text: string,
      embedding: EmbeddingLevels,
      start?: number,
      end?: number,
    ): Map<number, string>;
  }

  export default function bidiFactory(): Bidi;
}
