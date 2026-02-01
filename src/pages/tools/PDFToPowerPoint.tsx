import { useMemo, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Presentation, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// MOAT
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

type SlideSize = "wide" | "standard";
type ImageFormat = "png" | "jpeg";

type Settings = {
  slideSize: SlideSize;
  scale: 1 | 2 | 3;
  imageFormat: ImageFormat;
  jpegQuality: number; // 0.5..1
  useObjectStreams: boolean; // pptx packaging hint (kept as setting only)
};

const DEFAULT_SETTINGS: Settings = {
  slideSize: "wide",
  scale: 2,
  imageFormat: "png",
  jpegQuality: 0.92,
  useObjectStreams: true,
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "Widescreen • PNG • 2x", settings: { ...DEFAULT_SETTINGS, slideSize: "wide", imageFormat: "png", scale: 2 } },
  {
    name: "Widescreen • JPG • 2x (smaller)",
    settings: { ...DEFAULT_SETTINGS, slideSize: "wide", imageFormat: "jpeg", scale: 2, jpegQuality: 0.85 },
  },
  {
    name: "Standard • PNG • 2x",
    settings: { ...DEFAULT_SETTINGS, slideSize: "standard", imageFormat: "png", scale: 2 },
  },
  {
    name: "High quality • PNG • 3x",
    settings: { ...DEFAULT_SETTINGS, slideSize: "wide", imageFormat: "png", scale: 3 },
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

// canvas -> dataURL
function canvasToDataUrl(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number) {
  return canvas.toDataURL(type, quality);
}

export default function PDFToPowerPoint() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Moat settings (only settings get saved/shared; files never do)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-to-powerpoint";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile({ file, name: file.name });
        setProgress(null);
        toast({ title: "Loaded", description: "PDF ready to convert." });
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

  const settingsSummary = useMemo(() => {
    const size = settings.slideSize === "wide" ? "16:9" : "4:3";
    const fmt = settings.imageFormat === "jpeg" ? `JPG (${Math.round(settings.jpegQuality * 100)}%)` : "PNG";
    return `${size} • ${settings.scale}x • ${fmt}`;
  }, [settings]);

  const convertToPowerPoint = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const pptx = new PptxGenJS();
      pptx.layout = settings.slideSize === "wide" ? "LAYOUT_WIDE" : "LAYOUT_4X3";

      // pptxgen slide sizes (in inches)
      const slideW = settings.slideSize === "wide" ? 13.333 : 10;
      const slideH = 7.5;

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: settings.scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const mime = settings.imageFormat === "png" ? "image/png" : "image/jpeg";
        const dataUrl = canvasToDataUrl(
          canvas,
          mime,
          settings.imageFormat === "jpeg" ? clamp(settings.jpegQuality, 0.5, 1) : undefined,
        );

        const slide = pptx.addSlide();

        // Fit image to slide with aspect preserved
        const imgAspect = canvas.width / canvas.height;
        const slideAspect = slideW / slideH;

        let w = slideW,
          h = slideH,
          x = 0,
          y = 0;

        if (imgAspect > slideAspect) {
          w = slideW;
          h = w / imgAspect;
          y = (slideH - h) / 2;
        } else {
          h = slideH;
          w = h * imgAspect;
          x = (slideW - w) / 2;
        }

        slide.addImage({ data: dataUrl, x, y, w, h });
      }

      // Export PPTX
      const blob = (await pptx.write({ outputType: "blob" })) as Blob;
      saveAs(blob, `${baseName(pdfFile.name)}.pptx`);

      toast({
        title: "Done!",
        description: `Created ${totalPages} slide(s) and downloaded a PPTX.`,
      });

      moat.recordJob();
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to PPTX.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to PowerPoint (Slides)"
      description="Convert each PDF page into a PowerPoint slide (as an image)."
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

        {/* LEFT */}
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
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Presentation className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Rendering page {progress.current} / {progress.total}…
                </div>
              )}
            </Card>
          )}

          {/* Options */}
          <Card className="p-6 space-y-4">
            <div className="text-xs text-muted-foreground">{settingsSummary}</div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Slide size</p>
                <p className="text-xs text-muted-foreground">Widescreen is best for most decks.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.slideSize}
                onChange={(e) => setSettings((p) => ({ ...p, slideSize: e.target.value as SlideSize }))}
                disabled={converting}
              >
                <option value="wide">Widescreen (16:9)</option>
                <option value="standard">Standard (4:3)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Quality / scale</p>
                <p className="text-xs text-muted-foreground">Higher = sharper slides, slower.</p>
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

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Image format</p>
                <p className="text-xs text-muted-foreground">PNG is lossless; JPG is smaller.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.imageFormat}
                onChange={(e) => setSettings((p) => ({ ...p, imageFormat: e.target.value as ImageFormat }))}
                disabled={converting}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPG</option>
              </select>
            </div>

            {settings.imageFormat === "jpeg" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">JPG quality</p>
                    <p className="text-xs text-muted-foreground">Lower = smaller PPTX.</p>
                  </div>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    className="h-10 w-24 rounded-md border bg-background px-3 text-sm text-right"
                    value={Math.round(settings.jpegQuality * 100)}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, jpegQuality: clamp(Number(e.target.value || 0), 50, 100) / 100 }))
                    }
                    disabled={converting}
                  />
                </div>
              </div>
            )}
          </Card>

          <Button onClick={convertToPowerPoint} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PPTX
              </>
            )}
          </Button>
        </div>

        {/* RIGHT */}
        <div className="order-2 lg:order-3 space-y-6">
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
                <span>Each page is rendered as an image</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>We create a PPTX with one slide per page</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Slides are image-based (great for presenting)</li>
              <li>• True “editable elements” needs backend conversion</li>
              <li>• Works fully in your browser (no uploads)</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
