import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, BookOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import JSZip from "jszip";
import { saveAs } from "file-saver";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "book";
}

function escapeXml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function uuidLike() {
  // good enough for client-side: not a real UUID but unique enough
  return `urn:uuid:${crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function chunkIntoParagraphs(text: string) {
  // Simple paragraphing: split by ". " heuristics and keep it readable
  // We keep it conservative: EPUB readers handle reflow.
  const t = normalizeText(text);
  if (!t) return [];
  const parts: string[] = [];
  const max = 900;

  let buf = t;
  while (buf.length > max) {
    const cut = buf.lastIndexOf(". ", max);
    const idx = cut > 200 ? cut + 1 : max;
    parts.push(buf.slice(0, idx).trim());
    buf = buf.slice(idx).trim();
  }
  if (buf) parts.push(buf);

  return parts;
}

export default function PDFToEPUB() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile({ file, name: file.name });
        setProgress(null);
      } else {
        toast({
          title: "Only PDFs supported",
          description: "Please upload a .pdf file.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => {
    setPdfFile(null);
    setProgress(null);
  };

  const convertToEPUB = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const title = baseName(pdfFile.name);
      const bookId = uuidLike();

      // Extract text per page
      const pageTexts: string[] = [];

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const strings = (textContent.items as any[])
          .map((it) => (typeof it.str === "string" ? it.str : ""))
          .filter(Boolean);

        const pageText = normalizeText(strings.join(" "));
        pageTexts.push(pageText);
      }

      // Build EPUB (ZIP)
      const zip = new JSZip();

      // 1) mimetype MUST be first + uncompressed
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

      // 2) META-INF/container.xml
      zip.folder("META-INF")!.file(
        "container.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      );

      const oebps = zip.folder("OEBPS")!;

      // Basic CSS
      oebps.file(
        "styles.css",
        `body { font-family: serif; line-height: 1.6; }
h1,h2 { font-family: sans-serif; }
p { margin: 0 0 1em; }`,
      );

      // 3) Chapters: one per page (reliable)
      const manifestItems: string[] = [
        `<item id="css" href="styles.css" media-type="text/css"/>`,
        `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
      ];
      const spineItems: string[] = [];
      const navLinks: string[] = [];

      for (let i = 0; i < pageTexts.length; i++) {
        const pageNum = i + 1;
        const fileName = `page-${String(pageNum).padStart(3, "0")}.xhtml`;
        const itemId = `p${pageNum}`;

        const paras = chunkIntoParagraphs(pageTexts[i]);
        const body = paras.length
          ? paras.map((p) => `<p>${escapeXml(p)}</p>`).join("\n")
          : `<p><em>No selectable text found on this page. If this PDF is scanned, run OCR first.</em></p>`;

        const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)} — Page ${pageNum}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h2>Page ${pageNum}</h2>
  ${body}
</body>
</html>`;

        oebps.file(fileName, xhtml);

        manifestItems.push(`<item id="${itemId}" href="${fileName}" media-type="application/xhtml+xml"/>`);
        spineItems.push(`<itemref idref="${itemId}"/>`);
        navLinks.push(`<li><a href="${fileName}">Page ${pageNum}</a></li>`);
      }

      // 4) nav.xhtml (EPUB 3)
      oebps.file(
        "nav.xhtml",
        `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>Contents</h1>
    <ol>
      ${navLinks.join("\n")}
    </ol>
  </nav>
</body>
</html>`,
      );

      // 5) content.opf
      oebps.file(
        "content.opf",
        `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    ${spineItems.join("\n    ")}
  </spine>
</package>`,
      );

      // Generate EPUB blob
      setProgress({ current: totalPages, total: totalPages });

      const epubBlob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/epub+zip",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });

      saveAs(epubBlob, `${title}.epub`);

      toast({
        title: "Done!",
        description: "Downloaded EPUB file.",
      });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to EPUB.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to EPUB (Text-based)"
      description="Convert selectable PDF text into a reflowable EPUB e-book."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Processing page {progress.current} / {progress.total}…
                </div>
              )}
            </Card>
          )}

          <Button onClick={convertToEPUB} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download EPUB
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload your PDF file</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract selectable text (best for non-scanned PDFs)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a valid EPUB 3 e-book</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Output is text-based and reflowable (great for reading)</li>
              <li>• Chapter detection is page-based for reliability</li>
              <li>• For scanned PDFs, run PDF OCR first</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
