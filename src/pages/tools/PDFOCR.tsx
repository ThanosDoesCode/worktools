import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, ScanSearch, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import JSZip from "jszip";
import { saveAs } from "file-saver";

// PDF render (PDF.js)
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// OCR
import { createWorker } from "tesseract.js";

// DOCX (optional)
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

type OcrLang = "eng" | "ell";

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

export default function PDFOCR() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number; status: string } | null>(null);
  const [lang, setLang] = useState<OcrLang>("eng");
  const [scale, setScale] = useState<number>(2); // higher = better OCR, slower
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
          description: "Please upload a scanned PDF (.pdf).",
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

  const performOCR = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    let worker: any = null;

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();

      // Load PDF
      setProgress({ page: 0, total: 0, status: "Loading PDF…" });
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ page: 0, total: totalPages, status: "Preparing OCR…" });

      // OCR worker
      worker = await createWorker();

      // Language packs:
      // - "eng" is commonly available
      // - "ell" (Greek) may require extra language data; if it fails, we fallback to eng.
      try {
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
      } catch {
        if (lang !== "eng") {
          toast({
            title: "Greek OCR not available",
            description: "Falling back to English OCR. For Greek OCR, a backend is more reliable.",
            variant: "destructive",
          });
        }
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
      }

      const zip = new JSZip();
      const base = baseName(pdfFile.name);

      const allPagesText: string[] = [];

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ page: pageNumber, total: totalPages, status: "Rendering page…" });

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        setProgress({ page: pageNumber, total: totalPages, status: "Running OCR…" });

        // OCR from canvas image
        const { data } = await worker.recognize(canvas);
        const text = (data?.text || "").trim();

        const pageHeader = `\n\n=== Page ${pageNumber} ===\n\n`;
        allPagesText.push(pageHeader + (text || "(No text recognized)"));

        zip.file(`${base}-page-${String(pageNumber).padStart(3, "0")}.txt`, text || "");
      }

      // Create combined TXT
      const combinedText = allPagesText.join("\n");
      zip.file(`${base}-ocr.txt`, combinedText);

      // Create a DOCX (editable)
      const docChildren: Paragraph[] = [
        new Paragraph({ text: `${base} — OCR Extract`, heading: HeadingLevel.TITLE }),
        new Paragraph({
          children: [
            new TextRun({
              text: "OCR runs in your browser. Output is editable text (not a perfect searchable-PDF layer).",
              italics: true,
            }),
          ],
        }),
      ];

      for (let i = 0; i < totalPages; i++) {
        docChildren.push(new Paragraph({ text: `Page ${i + 1}`, heading: HeadingLevel.HEADING_2 }));
        const pageText = (allPagesText[i] || "").replace(/^=== Page \d+ ===/g, "").trim();
        docChildren.push(new Paragraph(pageText || "(No text recognized)"));
      }

      const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });
      const docBlob = await Packer.toBlob(doc);
      zip.file(`${base}-ocr.docx`, docBlob);

      setProgress({ page: totalPages, total: totalPages, status: "Creating ZIP…" });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${base}-ocr.zip`);

      toast({
        title: "OCR complete!",
        description: "Downloaded a ZIP with per-page TXT + combined TXT + DOCX.",
      });
    } catch (e: any) {
      toast({
        title: "OCR failed",
        description: e?.message ? String(e.message) : "Something went wrong while running OCR.",
        variant: "destructive",
      });
    } finally {
      try {
        if (worker) await worker.terminate();
      } catch {
        // ignore
      }
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF OCR (Text Extract)"
      description="Extract text from scanned PDFs using in-browser OCR. Download TXT + DOCX as a ZIP."
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
              <p className="text-lg font-medium">Drop your scanned PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <ScanSearch className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {progress.status} {progress.total > 0 ? `(${progress.page}/${progress.total})` : ""}
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Language</p>
                <p className="text-xs text-muted-foreground">English is most reliable in-browser.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={lang}
                onChange={(e) => setLang(e.target.value as OcrLang)}
                disabled={converting}
              >
                <option value="eng">English</option>
                <option value="ell">Greek (may fallback)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Quality / scale</p>
                <p className="text-xs text-muted-foreground">Higher = better OCR, slower.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={String(scale)}
                onChange={(e) => setScale(Number(e.target.value))}
                disabled={converting}
              >
                <option value="1">Fast (1x)</option>
                <option value="2">Balanced (2x)</option>
                <option value="3">High (3x)</option>
              </select>
            </div>
          </Card>

          <Button onClick={performOCR} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing OCR…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                OCR & Download ZIP
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
                <span>Upload your scanned PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We render pages and run OCR in your browser</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download ZIP: per-page TXT + combined TXT + DOCX</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• OCR text extraction (client-side)</li>
              <li>• Download as ZIP (TXT + DOCX)</li>
              <li>• No uploads to a server</li>
              <li>• Great for searchable text workflows</li>
            </ul>

            <div className="mt-4 rounded-md border p-3 text-sm text-muted-foreground bg-background">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  This tool extracts text. Creating a “searchable PDF” with an invisible text layer is a bigger feature
                  and usually needs backend processing for reliability.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
