import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, ScanSearch, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// OCR
import { createWorker } from "tesseract.js";

// Build output PDF
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

type OcrLang = "eng" | "ell";

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function PDFOCR() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number; status: string } | null>(null);

  // Controls
  const [lang, setLang] = useState<OcrLang>("eng");
  const [scale, setScale] = useState<number>(2); // OCR quality
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

  // canvas -> png bytes
  const canvasToPngBytes = async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export page image."))), "image/png");
    });
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  };

  const performOCR = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    let worker: any = null;

    try {
      // Load source PDF
      setProgress({ page: 0, total: 0, status: "Loading PDF…" });
      const srcBytes = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: srcBytes });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ page: 0, total: totalPages, status: "Preparing OCR…" });

      // Create OCR worker
      worker = await createWorker();
      try {
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
      } catch {
        // Greek can be tricky in-browser depending on build; fallback.
        if (lang !== "eng") {
          toast({
            title: "Greek OCR fallback",
            description: "Greek language pack may not be available in-browser. Falling back to English OCR.",
            variant: "destructive",
          });
        }
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
      }

      // Output PDF
      const outPdf = await PDFDocument.create();
      const font = await outPdf.embedFont(StandardFonts.Helvetica);

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ page: pageNumber, total: totalPages, status: "Rendering page…" });

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        // Render page to canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        // OCR
        setProgress({ page: pageNumber, total: totalPages, status: "Running OCR…" });

        // Note: We OCR the canvas element directly
        const { data } = await worker.recognize(canvas);

        // Create PDF page with same pixel dimensions (1px = 1pt here; fine for search)
        const w = canvas.width;
        const h = canvas.height;
        const outPage = outPdf.addPage([w, h]);

        // Embed the rendered page image
        const pngBytes = await canvasToPngBytes(canvas);
        const png = await outPdf.embedPng(pngBytes);

        outPage.drawImage(png, {
          x: 0,
          y: 0,
          width: w,
          height: h,
        });

        // Add invisible text layer using word bounding boxes
        // Tesseract gives bbox in image coordinates (origin top-left).
        // PDF uses origin bottom-left, so we convert: y_pdf = h - y1
        const words = (data?.words || []) as Array<{
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
          confidence?: number;
        }>;

        // Use a tiny opacity so it stays “invisible” but reliably searchable
        const textOpacity = 0.01;

        for (const word of words) {
          const t = (word.text || "").trim();
          if (!t) continue;

          const { x0, y0, x1, y1 } = word.bbox;
          const boxW = x1 - x0;
          const boxH = y1 - y0;

          // Skip microscopic noise
          if (boxW < 2 || boxH < 2) continue;

          const x = clamp(x0, 0, w - 1);
          const y = clamp(h - y1, 0, h - 1);

          // Approximate font size from bbox height
          const fontSize = clamp(boxH, 6, 48);

          // Draw word
          outPage.drawText(t, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: textOpacity,
          });
        }
      }

      setProgress({ page: totalPages, total: totalPages, status: "Saving searchable PDF…" });

      const outBytes = await outPdf.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      saveAs(blob, `${baseName(pdfFile.name)}-searchable.pdf`);

      toast({
        title: "Done!",
        description: "Downloaded a searchable (OCR) PDF.",
      });
    } catch (e: any) {
      toast({
        title: "OCR failed",
        description: e?.message ? String(e.message) : "Something went wrong while creating a searchable PDF.",
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
      title="PDF OCR"
      description="Make scanned PDFs searchable by adding an invisible text layer (runs in your browser)."
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
                  {progress.status} ({progress.page}/{progress.total})
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Language</p>
                <p className="text-xs text-muted-foreground">English is the most reliable in-browser.</p>
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
                Make Searchable PDF
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
                <span>Upload a scanned PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We OCR each page in your browser</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>We generate a new PDF with an invisible text layer</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• This runs locally in your browser (no server upload)</li>
              <li>• Large PDFs can be slow (OCR is heavy)</li>
              <li>• Text alignment may vary, but search/copy works</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
