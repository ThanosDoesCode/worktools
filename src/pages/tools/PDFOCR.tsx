import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, ScanSearch, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// OCR
import { createWorker } from "tesseract.js";

// Build output PDF
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/** Moat */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

/**
 * Tesseract language codes.
 * NOTE: Availability depends on how tesseract.js fetches language data in your build.
 * Some may fail in-browser; we fallback to English if preferred fails.
 */
type OcrLang =
  | "eng" // English
  | "ell" // Greek
  | "spa" // Spanish
  | "fra" // French
  | "deu" // German
  | "ita" // Italian
  | "por" // Portuguese
  | "nld" // Dutch
  | "swe" // Swedish
  | "nor" // Norwegian
  | "dan" // Danish
  | "fin" // Finnish
  | "pol" // Polish
  | "tur" // Turkish
  | "ces" // Czech
  | "ron" // Romanian
  | "hun" // Hungarian
  | "ukr" // Ukrainian
  | "rus" // Russian
  | "ara" // Arabic
  | "heb" // Hebrew
  | "hin" // Hindi
  | "tha" // Thai
  | "vie" // Vietnamese
  | "ind" // Indonesian
  | "jpn" // Japanese
  | "kor" // Korean
  | "chi_sim" // Chinese (Simplified)
  | "chi_tra"; // Chinese (Traditional)

type Settings = {
  preferredLang: OcrLang;
  fallbackLang: OcrLang;
  scale: 1 | 2 | 3;
};

const DEFAULT_SETTINGS: Settings = {
  preferredLang: "eng",
  fallbackLang: "eng",
  scale: 2,
};

const LANG_OPTIONS: Array<{ code: OcrLang; label: string; note?: string }> = [
  { code: "eng", label: "English" },
  { code: "ell", label: "Greek" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "nld", label: "Dutch" },
  { code: "swe", label: "Swedish" },
  { code: "nor", label: "Norwegian" },
  { code: "dan", label: "Danish" },
  { code: "fin", label: "Finnish" },
  { code: "pol", label: "Polish" },
  { code: "tur", label: "Turkish" },
  { code: "ces", label: "Czech" },
  { code: "ron", label: "Romanian" },
  { code: "hun", label: "Hungarian" },
  { code: "ukr", label: "Ukrainian" },
  { code: "rus", label: "Russian" },
  { code: "ara", label: "Arabic" },
  { code: "heb", label: "Hebrew" },
  { code: "hin", label: "Hindi" },
  { code: "tha", label: "Thai" },
  { code: "vie", label: "Vietnamese" },
  { code: "ind", label: "Indonesian" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "chi_tra", label: "Chinese (Traditional)" },
];

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "English — Fast (1x)", settings: { preferredLang: "eng", fallbackLang: "eng", scale: 1 } },
  { name: "English — Balanced (2x)", settings: { preferredLang: "eng", fallbackLang: "eng", scale: 2 } },
  { name: "English — High (3x)", settings: { preferredLang: "eng", fallbackLang: "eng", scale: 3 } },
  { name: "Greek → English fallback", settings: { preferredLang: "ell", fallbackLang: "eng", scale: 2 } },
  { name: "Swedish → English fallback", settings: { preferredLang: "swe", fallbackLang: "eng", scale: 2 } },
];

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function PDFOCR() {
  const { toast } = useToast();

  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number; status: string } | null>(null);

  // Moat settings only
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-ocr";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const preferredLabel = useMemo(() => {
    return LANG_OPTIONS.find((l) => l.code === settings.preferredLang)?.label ?? settings.preferredLang;
  }, [settings.preferredLang]);

  const fallbackLabel = useMemo(() => {
    return LANG_OPTIONS.find((l) => l.code === settings.fallbackLang)?.label ?? settings.fallbackLang;
  }, [settings.fallbackLang]);

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

  const initWorkerWithFallback = async (worker: any, primary: OcrLang, fallback: OcrLang) => {
    // Try primary
    try {
      await worker.loadLanguage(primary);
      await worker.initialize(primary);
      return { used: primary as OcrLang, fellBack: false };
    } catch {
      // Try fallback
      try {
        await worker.loadLanguage(fallback);
        await worker.initialize(fallback);
        return { used: fallback as OcrLang, fellBack: true };
      } catch {
        // Final fallback: English
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
        return { used: "eng" as OcrLang, fellBack: true };
      }
    }
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

      const { used, fellBack } = await initWorkerWithFallback(
        worker,
        settings.preferredLang,
        settings.fallbackLang || "eng",
      );

      if (fellBack) {
        toast({
          title: "OCR language fallback",
          description: `Preferred "${preferredLabel}" wasn't available. Using "${LANG_OPTIONS.find((l) => l.code === used)?.label ?? used}".`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "OCR ready",
          description: `Using "${preferredLabel}".`,
        });
      }

      // Output PDF
      const outPdf = await PDFDocument.create();
      const font = await outPdf.embedFont(StandardFonts.Helvetica);

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ page: pageNumber, total: totalPages, status: "Rendering page…" });

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: settings.scale });

        // Render page to canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        // OCR
        setProgress({ page: pageNumber, total: totalPages, status: "Running OCR…" });

        const { data } = await worker.recognize(canvas);

        // Create PDF page with same pixel dimensions (1px ~ 1pt; fine for search)
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

        // Invisible text layer (word bounding boxes)
        const words = (data?.words || []) as Array<{
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
          confidence?: number;
        }>;

        // Tiny opacity so it stays invisible but searchable
        const textOpacity = 0.01;

        for (const word of words) {
          const t = (word.text || "").trim();
          if (!t) continue;

          const { x0, y0, x1, y1 } = word.bbox;
          const boxW = x1 - x0;
          const boxH = y1 - y0;

          if (boxW < 2 || boxH < 2) continue;

          // PDF origin bottom-left; image origin top-left.
          const x = clamp(x0, 0, w - 1);
          const y = clamp(h - y1, 0, h - 1);

          const fontSize = clamp(boxH, 6, 48);

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

      const langTag = settings.preferredLang === "eng" ? "ocr" : `ocr-${settings.preferredLang}`;
      saveAs(blob, `${baseName(pdfFile.name)}-${langTag}.pdf`);

      toast({
        title: "Done!",
        description: "Downloaded a searchable (OCR) PDF.",
      });

      moat.recordJob();
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
      <div className="grid gap-8 lg:grid-cols-3">
        {/* MOAT COLUMN */}
        <div className="order-3 lg:order-1 space-y-3">
          <LocalStatusIndicator />

          <PresetsPanel
            userPresets={moat.userPresets}
            recommendedPresets={moat.recommendedPresets}
            isLoading={moat.isLoadingPresets}
            onApply={moat.applyPreset}
            onSave={moat.saveCurrentAsPreset}
            onRename={moat.renamePreset}
            onDelete={moat.deletePreset}
            onTogglePinned={moat.togglePinned}
            onUseLastSettings={moat.useLastSettings}
            onReset={moat.resetToDefaults}
          />

          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
        </div>

        {/* LEFT: INPUTS + ACTION */}
        <div className="order-1 lg:order-2 space-y-6">
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
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting} aria-label="Clear file">
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

          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Preferred language</p>
                <p className="text-xs text-muted-foreground">If unavailable, we’ll fallback.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.preferredLang}
                onChange={(e) => setSettings((p) => ({ ...p, preferredLang: e.target.value as OcrLang }))}
                disabled={converting}
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Fallback language</p>
                <p className="text-xs text-muted-foreground">Used if preferred fails.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.fallbackLang}
                onChange={(e) => setSettings((p) => ({ ...p, fallbackLang: e.target.value as OcrLang }))}
                disabled={converting}
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Quality / scale</p>
                <p className="text-xs text-muted-foreground">Higher = better OCR, slower.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={String(settings.scale)}
                onChange={(e) => setSettings((p) => ({ ...p, scale: Number(e.target.value) as 1 | 2 | 3 }))}
                disabled={converting}
              >
                <option value="1">Fast (1x)</option>
                <option value="2">Balanced (2x)</option>
                <option value="3">High (3x)</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground">
              Current: <span className="font-medium text-foreground">{preferredLabel}</span>{" "}
              {settings.preferredLang !== settings.fallbackLang && (
                <>
                  → fallback <span className="font-medium text-foreground">{fallbackLabel}</span>
                </>
              )}{" "}
              • scale <span className="font-medium text-foreground">{settings.scale}x</span>
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

        {/* RIGHT: HELP */}
        <div className="order-2 lg:order-3 space-y-6">
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
              <li>• Runs locally in your browser (no server upload)</li>
              <li>• Large PDFs can be slow (OCR is heavy)</li>
              <li>• Language availability depends on your Tesseract.js setup</li>
              <li>• If a language isn’t available, we automatically fallback</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
