import { useState, useCallback, useMemo, useEffect } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDropzone } from "react-dropzone";
import { jsPDF } from "jspdf";
import { Copy, Download, Trash2, Image as ImageIcon, FileText, GripVertical, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Moat layer (adjust paths if your project differs) */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";
type FitMode = "contain" | "cover";

type Settings = {
  pageSize: PageSize;
  orientation: Orientation;
  marginMm: number;
  fitMode: FitMode;
  imageQuality: number; // 0.5..1 (jpeg)
  addFilenameCaption: boolean;
  captionFontSize: number;
  background: "white" | "black";
};

const DEFAULT_SETTINGS: Settings = {
  pageSize: "a4",
  orientation: "portrait",
  marginMm: 8,
  fitMode: "contain",
  imageQuality: 0.92,
  addFilenameCaption: false,
  captionFontSize: 10,
  background: "white",
};

const RECOMMENDED_PRESETS = [
  {
    name: "A4 (clean) — contain",
    settings: { ...DEFAULT_SETTINGS, pageSize: "a4", orientation: "portrait", fitMode: "contain", marginMm: 10 },
  },
  {
    name: "Letter — contain",
    settings: { ...DEFAULT_SETTINGS, pageSize: "letter", orientation: "portrait", fitMode: "contain", marginMm: 10 },
  },
  {
    name: "Photos (full-bleed) — cover",
    settings: { ...DEFAULT_SETTINGS, pageSize: "a4", fitMode: "cover", marginMm: 0, background: "white" },
  },
  {
    name: "Black background (slides feel)",
    settings: { ...DEFAULT_SETTINGS, background: "black", fitMode: "contain", marginMm: 8 },
  },
  {
    name: "Add filename captions",
    settings: { ...DEFAULT_SETTINGS, addFilenameCaption: true, captionFontSize: 10, marginMm: 12 },
  },
] as const;

type ImgItem = {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;

  width?: number;
  height?: number;
};

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Convert any image file to a JPEG dataURL (stable for jsPDF.addImage) */
async function fileToJpegDataUrl(file: File, quality = 0.85): Promise<{ dataUrl: string; w: number; h: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImg(objectUrl);
    const w = img.width || 1;
    const h = img.height || 1;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // draw with white bg (JPEG has no alpha)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", clamp(quality, 0.5, 1));
    return { dataUrl, w, h };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Fit/cover rectangle math */
function computePlacement(params: {
  pageW: number;
  pageH: number;
  margin: number;
  imgW: number;
  imgH: number;
  fitMode: FitMode;
  captionH: number;
}) {
  const { pageW, pageH, margin, imgW, imgH, fitMode, captionH } = params;

  const availableW = Math.max(1, pageW - margin * 2);
  const availableH = Math.max(1, pageH - margin * 2 - captionH);

  const scaleContain = Math.min(availableW / imgW, availableH / imgH);
  const scaleCover = Math.max(availableW / imgW, availableH / imgH);
  const scale = fitMode === "cover" ? scaleCover : scaleContain;

  const drawW = imgW * scale;
  const drawH = imgH * scale;

  const x = margin + (availableW - drawW) / 2;
  const y = margin + (availableH - drawH) / 2;

  return { x, y, w: drawW, h: drawH, availableW, availableH };
}

export default function ImageToPDF() {
  const [images, setImages] = useState<ImgItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  /** Moat settings only (never files) */
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "images-to-pdf";
  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  /** Simple reorder state (no extra deps): move item with arrows / drag handle UI only */
  const moveImage = (from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setPdfUrl(null);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.map((file) => ({
      id: safeId(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));

    setImages((prev) => [...prev, ...imageFiles]);
    setPdfUrl(null);
    toast.success(`Added ${acceptedFiles.length} image${acceptedFiles.length > 1 ? "s" : ""}`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".tiff", ".tif"],
    },
    multiple: true,
  });

  useEffect(() => {
    // best-effort: fetch dimensions for nicer UI (optional)
    (async () => {
      const missing = images.filter((i) => !i.width || !i.height);
      if (missing.length === 0) return;

      for (const it of missing) {
        try {
          const img = await loadImg(it.preview);
          setImages((prev) => prev.map((p) => (p.id === it.id ? { ...p, width: img.width, height: img.height } : p)));
        } catch {
          // ignore
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPdfUrl(null);
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  const totalSize = useMemo(() => images.reduce((acc, img) => acc + img.size, 0), [images]);

  const convertToPDF = async () => {
    if (images.length === 0) {
      toast.error("Please add at least one image");
      return;
    }

    setConverting(true);

    try {
      // Create pdf with user page settings
      const pdf = new jsPDF({
        unit: "mm",
        format: settings.pageSize,
        orientation: settings.orientation,
        compress: true,
      });

      // background fill uses a rect page by page (jsPDF has no page bg option)
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = clamp(settings.marginMm, 0, 50);

      for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();

        // background
        if (settings.background === "black") {
          pdf.setFillColor(0, 0, 0);
          pdf.rect(0, 0, pageW, pageH, "F");
        } else {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, pageH, "F");
        }

        const captionH = settings.addFilenameCaption ? Math.max(6, settings.captionFontSize * 0.45 + 4) : 0;

        // Convert to JPEG dataURL reliably for jsPDF
        const { dataUrl, w: imgW, h: imgH } = await fileToJpegDataUrl(images[i].file, settings.imageQuality);

        const placement = computePlacement({
          pageW,
          pageH,
          margin,
          imgW,
          imgH,
          fitMode: settings.fitMode,
          captionH,
        });

        // draw image
        pdf.addImage(dataUrl, "JPEG", placement.x, placement.y, placement.w, placement.h, undefined, "FAST");

        // optional caption
        if (settings.addFilenameCaption) {
          const textY = pageH - margin - 2;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(clamp(settings.captionFontSize, 8, 18));
          pdf.setTextColor(settings.background === "black" ? 255 : 30);
          const caption = images[i].name;
          pdf.text(caption, margin, textY, { maxWidth: pageW - margin * 2 });
        }
      }

      const pdfBlob = pdf.output("blob") as Blob;
      const url = URL.createObjectURL(pdfBlob);

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);

      moat.recordJob();
      toast.success("PDF created successfully!");
    } catch (error) {
      console.error("Conversion error:", error);
      toast.error("Failed to convert images to PDF");
    } finally {
      setConverting(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `images-to-pdf-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    moat.recordJob();
    toast.success("PDF downloaded");
  };

  const handleCopy = () => {
    const text = `Images to PDF
Images: ${images.length}
Total input size: ${formatBytes(totalSize)}
Settings: ${settings.pageSize.toUpperCase()} • ${settings.orientation} • ${settings.fitMode} • margin ${settings.marginMm}mm
Status: ${pdfUrl ? "PDF generated" : "Ready to convert"}`;

    navigator.clipboard.writeText(text);
    toast.success("Info copied to clipboard");
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setPdfUrl(null);
    toast.success("Settings reset");
    moat.recordJob();
  };

  return (
    <ToolLayout title="Images to PDF" description="Convert images to a PDF — private, fast, no uploads.">
      <div className="grid lg:grid-cols-3 gap-8">
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

        {/* INPUT PANEL */}
        <div className="order-1 lg:order-2 space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground hover:bg-surface"
                }
              `}
            >
              <input {...getInputProps()} />
              <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-medium text-foreground mb-2">
                {isDragActive ? "Drop images here" : "Drop images here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground">JPG, PNG, WebP, HEIC, TIFF</p>
            </div>

            {/* Settings (moat-aware) */}
            <div className="mt-6 grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Page size</Label>
                  <Select
                    value={settings.pageSize}
                    onValueChange={(v) => setSettings((p) => ({ ...p, pageSize: v as PageSize }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <Select
                    value={settings.orientation}
                    onValueChange={(v) => setSettings((p) => ({ ...p, orientation: v as Orientation }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Fit mode</Label>
                  <Select
                    value={settings.fitMode}
                    onValueChange={(v) => setSettings((p) => ({ ...p, fitMode: v as FitMode }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contain">Contain (no crop)</SelectItem>
                      <SelectItem value="cover">Cover (crop)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Margin (mm)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={settings.marginMm}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, marginMm: clamp(Number(e.target.value || 0), 0, 50) }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Background</Label>
                  <Select
                    value={settings.background}
                    onValueChange={(v) => setSettings((p) => ({ ...p, background: v as Settings["background"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="black">Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Image quality</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(settings.imageQuality * 100)}%</span>
                  </div>
                  <Input
                    type="range"
                    min={50}
                    max={100}
                    value={Math.round(settings.imageQuality * 100)}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, imageQuality: clamp(Number(e.target.value) / 100, 0.5, 1) }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">Lower quality = smaller PDF</p>
                </div>

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Add filename captions</Label>
                      <p className="text-xs text-muted-foreground">Adds each image name at the bottom of the page</p>
                    </div>
                    <Switch
                      checked={settings.addFilenameCaption}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, addFilenameCaption: v }))}
                    />
                  </div>

                  {settings.addFilenameCaption && (
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <Label>Font size</Label>
                        <Input
                          type="number"
                          min={8}
                          max={18}
                          value={settings.captionFontSize}
                          onChange={(e) =>
                            setSettings((p) => ({ ...p, captionFontSize: clamp(Number(e.target.value || 10), 8, 18) }))
                          }
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tip: increase margin a bit if captions overlap.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Image Preview */}
            {images.length > 0 && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-foreground">
                      {images.length} image{images.length > 1 ? "s" : ""} selected
                    </h3>
                    <p className="text-sm text-muted-foreground">Total size: {formatBytes(totalSize)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Clear All
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-72 overflow-y-auto p-2">
                  {images.map((img, index) => (
                    <div key={img.id} className="relative group">
                      <div className="absolute left-1 top-1 z-10 rounded-md bg-background/80 border px-1.5 py-0.5 flex items-center gap-1">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{index + 1}</span>
                      </div>

                      <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                        <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{img.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {img.width && img.height ? `${img.width}×${img.height} • ` : ""}
                            {formatBytes(img.size)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => moveImage(index, index - 1)}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => moveImage(index, index + 1)}
                            disabled={index === images.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                            aria-label="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Button onClick={convertToPDF} disabled={converting} className="w-full" size="lg">
                    {converting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Convert {images.length} Image{images.length > 1 ? "s" : ""} to PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleCopy} variant="outline">
              <Copy className="h-4 w-4 mr-2" /> Copy Info
            </Button>
            <Button onClick={resetSettings} variant="outline">
              <Trash2 className="h-4 w-4 mr-2" /> Reset Settings
            </Button>
            {pdfUrl && (
              <Button onClick={downloadPDF} className="flex-1 min-w-[220px]">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            )}
          </div>
        </div>

        {/* RESULTS PANEL */}
        <div className="order-2 lg:order-3 space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="text-xl font-semibold text-foreground mb-6">Conversion Status</h3>

            {images.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium">No images added yet</p>
                <p className="text-muted-foreground text-sm mt-1">Drop images on the left to get started</p>
              </div>
            ) : !pdfUrl ? (
              <div className="space-y-4">
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Ready to Convert</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      • {images.length} image{images.length > 1 ? "s" : ""} will be converted
                    </li>
                    <li>
                      • Page: {settings.pageSize.toUpperCase()} • {settings.orientation}
                    </li>
                    <li>
                      • Fit: {settings.fitMode} • Margin: {settings.marginMm}mm
                    </li>
                    <li>• Captions: {settings.addFilenameCaption ? "On" : "Off"}</li>
                  </ul>
                </div>

                <Button onClick={convertToPDF} disabled={converting} className="w-full" size="lg">
                  {converting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Convert to PDF
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <h4 className="font-medium text-green-600 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    PDF Generated Successfully!
                  </h4>
                  <p className="text-sm text-muted-foreground">Your PDF is ready. Download it below.</p>
                </div>

                <Button onClick={downloadPDF} className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>

                <Button
                  onClick={() => {
                    clearAll();
                    toast.info("Start a new conversion");
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Convert New Images
                </Button>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="font-medium text-foreground mb-3">How it works:</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">1.</span>
                  Drop images or click to select files
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">2.</span>
                  Choose page + fit settings (optional captions)
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">3.</span>
                  Convert and download — runs locally in your browser
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
