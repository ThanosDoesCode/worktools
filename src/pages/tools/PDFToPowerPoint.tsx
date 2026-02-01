import { useMemo, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Presentation, Loader2 } from "lucide-react";
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
  useObjectStreams: boolean;

  // NEW: editable overlay options
  editableOverlay: boolean;
  overlayOpacity: number; // 0..1 (0 = invisible but still editable)
  overlayMaxLinesPerSlide: number; // safety limit
  overlayMinFontPt: number; // clamp for pptx text
  overlayMaxFontPt: number; // clamp for pptx text
  overlayLineYBucket: number; // controls line grouping sensitivity in PDF space
  overlayMergeGapsPx: number; // merge text items within a line if gaps <= this (PDF px)
};

const DEFAULT_SETTINGS: Settings = {
  slideSize: "wide",
  scale: 2,
  imageFormat: "png",
  jpegQuality: 0.92,
  useObjectStreams: true,

  editableOverlay: false,
  overlayOpacity: 0.0, // default invisible overlay (still editable)
  overlayMaxLinesPerSlide: 500,
  overlayMinFontPt: 8,
  overlayMaxFontPt: 48,
  overlayLineYBucket: 2, // higher = more aggressive grouping
  overlayMergeGapsPx: 6,
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  {
    name: "Widescreen • PNG • 2x",
    settings: { ...DEFAULT_SETTINGS, slideSize: "wide", imageFormat: "png", scale: 2 },
  },
  {
    name: "Widescreen • JPG • 2x (smaller)",
    settings: { ...DEFAULT_SETTINGS, slideSize: "wide", imageFormat: "jpeg", scale: 2, jpegQuality: 0.85 },
  },
  {
    name: "High quality • PNG • 3x",
    settings: { ...DEFAULT_SETTINGS, slideSize: "wide", imageFormat: "png", scale: 3 },
  },
  {
    name: "Editable overlay • PNG • 2x",
    settings: {
      ...DEFAULT_SETTINGS,
      slideSize: "wide",
      imageFormat: "png",
      scale: 2,
      editableOverlay: true,
      overlayOpacity: 0,
    },
  },
  {
    name: "Editable overlay visible (50%)",
    settings: {
      ...DEFAULT_SETTINGS,
      slideSize: "wide",
      imageFormat: "png",
      scale: 2,
      editableOverlay: true,
      overlayOpacity: 0.5,
    },
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

type TextItem = {
  str: string;
  x: number;
  y: number;
  w: number; // item width in PDF space
  h: number; // item height approx in PDF space
};

type Line = {
  y: number; // baseline-ish y in PDF space
  items: TextItem[];
  text: string;
  minX: number;
  maxX: number;
  height: number;
};

/**
 * Extracts text items with simple geometry from PDF.js page.getTextContent().
 * We approximate item height from transform matrix.
 */
function extractTextItems(textContent: any): TextItem[] {
  const items = (textContent.items as any[]) || [];
  const out: TextItem[] = [];

  for (const it of items) {
    const raw = typeof it.str === "string" ? it.str : "";
    const str = raw.replace(/\s+/g, " ").trim();
    if (!str) continue;

    const t = it.transform || [1, 0, 0, 1, 0, 0];
    const x = t[4] ?? 0;
    const y = t[5] ?? 0;

    // PDF.js provides width sometimes
    const w = typeof it.width === "number" ? it.width : str.length * 6;

    // Approx height from transform scale (rough)
    const scaleY = Math.sqrt((t[1] ?? 0) * (t[1] ?? 0) + (t[3] ?? 1) * (t[3] ?? 1));
    const h = clamp(scaleY * 10, 6, 72);

    out.push({ str, x, y, w, h });
  }

  return out;
}

/**
 * Group items into lines by y bucketing, then sort by x.
 * Also merges adjacent items with small gaps to form more natural text.
 */
function groupIntoLines(items: TextItem[], yBucket = 2, mergeGapsPx = 6): Line[] {
  const map = new Map<number, TextItem[]>();

  for (const it of items) {
    const yKey = Math.round(it.y / yBucket) * yBucket;
    if (!map.has(yKey)) map.set(yKey, []);
    map.get(yKey)!.push(it);
  }

  const yKeys = Array.from(map.keys()).sort((a, b) => b - a); // top->bottom
  const lines: Line[] = [];

  for (const y of yKeys) {
    const row = map
      .get(y)!
      .slice()
      .sort((a, b) => a.x - b.x);
    if (!row.length) continue;

    // Merge adjacent items when x gap is small
    const merged: TextItem[] = [];
    for (const it of row) {
      const prev = merged[merged.length - 1];
      if (!prev) {
        merged.push({ ...it });
        continue;
      }

      const prevEnd = prev.x + prev.w;
      const gap = it.x - prevEnd;

      if (gap <= mergeGapsPx) {
        // merge text with space if needed
        const needsSpace = !prev.str.endsWith(" ") && !it.str.startsWith(" ");
        prev.str = `${prev.str}${needsSpace ? " " : ""}${it.str}`.trim();
        prev.w = Math.max(prev.w, it.x + it.w - prev.x);
        prev.h = Math.max(prev.h, it.h);
      } else {
        merged.push({ ...it });
      }
    }

    const minX = Math.min(...merged.map((m) => m.x));
    const maxX = Math.max(...merged.map((m) => m.x + m.w));
    const height = Math.max(...merged.map((m) => m.h));
    const text = merged
      .map((m) => m.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;

    lines.push({
      y,
      items: merged,
      text,
      minX,
      maxX,
      height,
    });
  }

  return lines;
}

/**
 * Map PDF viewport coords to PPT slide coords within the image frame (x,y,w,h).
 * PDF.js viewport: origin bottom-left (for text items), y increases upward.
 * Our slide image: origin top-left. We flip y.
 */
function pdfToSlideRect(
  pdfX: number,
  pdfY: number,
  pdfW: number,
  pdfH: number,
  viewportW: number,
  viewportH: number,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
) {
  const sx = frameX + (pdfX / viewportW) * frameW;
  const sy = frameY + ((viewportH - pdfY - pdfH) / viewportH) * frameH; // flip Y
  const sw = (pdfW / viewportW) * frameW;
  const sh = (pdfH / viewportH) * frameH;
  return { x: sx, y: sy, w: sw, h: sh };
}

export default function PDFToPowerPoint() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

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
    const overlay = settings.editableOverlay ? ` • overlay ${Math.round(settings.overlayOpacity * 100)}%` : "";
    return `${size} • ${settings.scale}x • ${fmt}${overlay}`;
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

        // Render page to canvas for background image
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

        let frameW = slideW,
          frameH = slideH,
          frameX = 0,
          frameY = 0;

        if (imgAspect > slideAspect) {
          frameW = slideW;
          frameH = frameW / imgAspect;
          frameX = 0;
          frameY = (slideH - frameH) / 2;
        } else {
          frameH = slideH;
          frameW = frameH * imgAspect;
          frameY = 0;
          frameX = (slideW - frameW) / 2;
        }

        slide.addImage({ data: dataUrl, x: frameX, y: frameY, w: frameW, h: frameH });

        // Optional: editable text overlay
        if (settings.editableOverlay) {
          const textContent = await page.getTextContent();
          const items = extractTextItems(textContent);
          const lines = groupIntoLines(items, settings.overlayLineYBucket, settings.overlayMergeGapsPx);

          // safety limit to avoid exploding PPT size
          const limited = lines.slice(0, clamp(settings.overlayMaxLinesPerSlide, 50, 5000));

          const opacity = clamp(settings.overlayOpacity, 0, 1);

          for (const ln of limited) {
            const text = ln.text;
            if (!text) continue;

            // Use bounding box spanning the line
            const pdfX = ln.minX;
            const pdfW = Math.max(1, ln.maxX - ln.minX);
            const pdfH = Math.max(ln.height, 6);
            const pdfY = ln.y;

            const r = pdfToSlideRect(
              pdfX,
              pdfY,
              pdfW,
              pdfH,
              viewport.width,
              viewport.height,
              frameX,
              frameY,
              frameW,
              frameH,
            );

            // Font size estimation:
            // Roughly convert PDF px height into slide points. Slide inches -> points is not 1:1 in pptxgen,
            // but pptxgen uses inches. We'll estimate: fontPt ~ pdfH * (frameH/viewportH) * 72
            const fontPt = clamp(
              Math.round(pdfH * (frameH / viewport.height) * 72),
              settings.overlayMinFontPt,
              settings.overlayMaxFontPt,
            );

            // Keep text boxes from being microscopic
            const w = Math.max(r.w, 0.15);
            const h = Math.max(r.h, 0.12);

            slide.addText(text, {
              x: clamp(r.x, 0, slideW - 0.01),
              y: clamp(r.y, 0, slideH - 0.01),
              w: clamp(w, 0.05, slideW),
              h: clamp(h, 0.05, slideH),
              fontSize: fontPt,
              // Make it “invisible” if opacity is 0, but still editable/selectable in PPT
              // PptxGen supports transparency as "transparency" (0..100) for fill/line; for text it's via color alpha
              // Many builds accept 8-digit hex. We'll use that. If your viewer ignores alpha, set overlayOpacity > 0.
              color:
                opacity === 0
                  ? "00000000"
                  : `000000${Math.round(opacity * 255)
                      .toString(16)
                      .padStart(2, "0")}`,
              // prevent wrapping weirdness
              valign: "top",
              // If you find boxes wrap too aggressively, uncomment next line:
              // autoFit: true,
            });
          }
        }
      }

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
    <ToolLayout title="PDF to PowerPoint (Slides)" description="Convert each PDF page into a PowerPoint slide.">
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

            {/* NEW: Editable overlay */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Editable text overlay</p>
                  <p className="text-xs text-muted-foreground">
                    Best-effort: keeps slide image, adds editable text boxes on top.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.editableOverlay}
                  onChange={(e) => setSettings((p) => ({ ...p, editableOverlay: e.target.checked }))}
                  disabled={converting}
                />
              </div>

              {settings.editableOverlay && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Overlay visibility</p>
                      <p className="text-xs text-muted-foreground">0% = invisible but still editable/selectable.</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      className="h-10 w-24 rounded-md border bg-background px-3 text-sm text-right"
                      value={Math.round(settings.overlayOpacity * 100)}
                      onChange={(e) =>
                        setSettings((p) => ({ ...p, overlayOpacity: clamp(Number(e.target.value || 0), 0, 100) / 100 }))
                      }
                      disabled={converting}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Max lines</p>
                      <p className="text-xs text-muted-foreground">Safety limit.</p>
                      <input
                        type="number"
                        min={50}
                        max={5000}
                        step={50}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={settings.overlayMaxLinesPerSlide}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            overlayMaxLinesPerSlide: clamp(Number(e.target.value || 0), 50, 5000),
                          }))
                        }
                        disabled={converting}
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium">Line grouping</p>
                      <p className="text-xs text-muted-foreground">Higher merges more text into one line.</p>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={settings.overlayLineYBucket}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            overlayLineYBucket: clamp(Number(e.target.value || 0), 1, 10),
                          }))
                        }
                        disabled={converting}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Tip: If text boxes look too fragmented, increase “Line grouping”. If they merge too much, decrease
                    it.
                  </div>
                </div>
              )}
            </div>
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
                <span>Optional: we add editable text boxes over the image (best effort)</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• “Editable overlay” works only when the PDF contains real text</li>
              <li>• Scanned PDFs need OCR first</li>
              <li>• Some PDFs use complex fonts/positioning and may not overlay perfectly</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
