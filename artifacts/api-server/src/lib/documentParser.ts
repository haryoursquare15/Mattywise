import path from "path";
import { logger } from "./logger";

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileType: string,
  fileName: string,
): Promise<{ text: string; pageCount?: number }> {
  const ext = path.extname(fileName).toLowerCase().replace(".", "") || fileType.toLowerCase();

  // PDF
  if (ext === "pdf" || fileType.includes("pdf")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> = require("pdf-parse");
      const data = await pdfParse(buffer);
      return { text: data.text, pageCount: data.numpages };
    } catch (err) {
      logger.warn({ err, fileName }, "pdf-parse failed");
      return { text: `[PDF content from ${fileName} could not be parsed. Try re-uploading or converting to text.]` };
    }
  }

  // DOCX
  if (
    ext === "docx" ||
    fileType.includes("word") ||
    fileType.includes("officedocument.wordprocessingml")
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> } =
        require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value };
    } catch (err) {
      logger.warn({ err, fileName }, "mammoth failed");
      return { text: `[Word document content from ${fileName} could not be parsed.]` };
    }
  }

  // XLSX / XLS
  if (
    ext === "xlsx" ||
    ext === "xls" ||
    fileType.includes("spreadsheet") ||
    fileType.includes("excel")
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX: {
        read: (b: Buffer, opts: object) => { SheetNames: string[]; Sheets: Record<string, unknown> };
        utils: { sheet_to_csv: (s: unknown) => string };
      } = require("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const texts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
          texts.push(`Sheet: ${sheetName}\n${csv}`);
        }
      }
      return { text: texts.join("\n\n"), pageCount: workbook.SheetNames.length };
    } catch (err) {
      logger.warn({ err, fileName }, "xlsx parsing failed");
      return { text: `[Excel content from ${fileName} could not be parsed.]` };
    }
  }

  // CSV
  if (ext === "csv" || fileType.includes("csv")) {
    return { text: buffer.toString("utf-8") };
  }

  // TXT
  if (ext === "txt" || fileType.includes("text/plain")) {
    return { text: buffer.toString("utf-8") };
  }

  // JSON
  if (ext === "json" || fileType.includes("json")) {
    try {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      return { text: JSON.stringify(parsed, null, 2) };
    } catch {
      return { text: buffer.toString("utf-8") };
    }
  }

  // XML
  if (ext === "xml" || fileType.includes("xml")) {
    return { text: buffer.toString("utf-8") };
  }

  // PPTX — extract text from XML inside the zip archive
  if (ext === "pptx" || fileType.includes("presentation") || fileType.includes("powerpoint")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const JSZip: new () => {
        loadAsync: (buf: Buffer) => Promise<{ files: Record<string, { name: string; async: (type: string) => Promise<string> }> }>;
      } = require("jszip");
      const zip = new JSZip();
      const loaded = await zip.loadAsync(buffer);

      // pptx slides live at ppt/slides/slide{n}.xml
      const slideFiles = Object.keys(loaded.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] ?? "0");
          const numB = parseInt(b.match(/\d+/)?.[0] ?? "0");
          return numA - numB;
        });

      if (slideFiles.length === 0) {
        return {
          text: `[PowerPoint file "${fileName}" — could not locate slide content. Consider converting to PDF for best results.]`,
          pageCount: 0,
        };
      }

      const slideTexts: string[] = [];
      for (let i = 0; i < slideFiles.length; i++) {
        const xmlContent = await loaded.files[slideFiles[i]].async("string");
        // Strip all XML tags; collapse whitespace
        const plainText = xmlContent
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        if (plainText) {
          slideTexts.push(`[Slide ${i + 1}]\n${plainText}`);
        }
      }

      return {
        text: slideTexts.join("\n\n"),
        pageCount: slideFiles.length,
      };
    } catch (err) {
      logger.warn({ err, fileName }, "PPTX extraction failed");
      return {
        text: `[PowerPoint presentation "${fileName}" — text extraction failed. Please convert to PDF for full analysis.]`,
      };
    }
  }

  return { text: `[File: ${fileName} (${fileType}). Content type not directly parseable.]` };
}
