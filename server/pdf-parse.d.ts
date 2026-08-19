declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = { text: string };
  const pdf: (dataBuffer: Buffer) => Promise<PdfParseResult>;
  export default pdf;
}
