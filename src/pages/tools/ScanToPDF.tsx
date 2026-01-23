import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  X,
  Download,
  ScanLine,
  Loader2,
  ArrowUp,
  ArrowDown,
  RotateCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";
type Mode = "color" | "grayscale" | "bw";

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  url: string;
  rotation: 0 | 90 | 180 | 270;
}

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function baseName(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, "") || "scan";
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Render image onto a canvas and apply:
 * - rotation
 * - mode: color/grayscale/bw
 * - enhance: contrast + white background boost
 */
async function renderProcessedCanvas(
  imgUrl: string,
  rotation: 0 | 90 | 180 | 270,
  mode: Mode,
  contrast: number, // 0..2 (1 = normal)
  whiten: number // 0..1
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imgUrl);

  // Create base canvas considering rotation
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context not available");

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const rotated = rotation === 90 || rotation === 270;
  canvas.width = rotated ? h : w;
  canvas.height = rotated ? w : h;

  // Draw rotated
  ctx.save();
  if (rotation === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else if (rotation === 180) {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate((180 * Math.PI) / 180);
  } else if (rotation === 270) {
    ctx.translate(0, canvas.height);
    ctx.rotate((270 * Math.PI) / 180);
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  // Process pixels
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Contrast factor mapping: 0..2 => -255..+255-ish curve
  // We'll use classic contrast formula with factor.
  const c = clamp(contrast, 0, 2);
  const factor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Optional whiten background boost (push light pixels toward white)
    if (whiten > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const boost = whiten * Math.max(0, (lum - 160) / 95); // only boost lighter tones
      r = r + (255 - r) * boost;
      g = g + (255 - g) * boost;
      b = b + (255 - b) * boost;
    }

    // Contrast adjust
    r = clamp(factor * (r - 128) + 128, 0, 255);
    g = clamp(factor * (g - 128) + 128, 0, 255);
    b = clamp(factor * (b - 128) + 128, 0, 255);

    if (mode === "grayscale" || mode === "bw") {
      const gray = clamp(0.299 * r + 0.587 * g + 0.114 * b, 0, 255);
      if (mode === "bw") {
        const bw = gray > 160 ? 255 : 0;
        r = g = b = bw;
      } else {
        r = g = b = gray;
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    // alpha stays
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export default function ScanToPDF() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [creating, setCreating] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const [mode, setMode] = useState<Mode>("color");
  const [contrast, setContrast] = useState(1.15); // a tiny boost
  const [whiten, setWhiten] = useState(0.35);

  const { toast } = useToast();

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles?.length) return;

      // Accept common image types
      const imgs = acceptedFiles.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) {
        toast({
          title: "Images only",
          description: "Upload scanned photos (JPG/PNG/WebP).",
          variant: "destructive",
        });
        return;
      }

      const newItems: ImageItem[] = imgs.map((file) => ({
        id: safeId(),
        file,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        rotation: 0,
      }));

      setItems((prev) => [...prev, ...newItems]);
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: 50,
  });

  const clearAll = () => {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const rotate = (id: string) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : p
      )
    );
  };

  const createPDF = async () => {
    if (items.length === 0) return;

    setCreating(true);
    try {
      const doc = new jsPDF({
        orientation: orientation === "portrait" ? "p" : "l",
        unit: "pt",
        format: pageSize,
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 24;

      // Process each image -> canvas -> add to PDF
      for (let i = 0; i < items.length; i++) {
        const it = items[i];

        // Convert image to processed canvas
        const canvas = await renderProcessedCanvas(it.url, it.rotation, mode, contrast, whiten);

        // Use JPEG for smaller output
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (i > 0) doc.addPage();

        // Fit image to page while keeping aspect ratio
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;

        const imgW = canvas.width;
        const imgH = canvas.height;

        const scale = Math.min(maxW / imgW, maxH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;

        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        doc.addImage(imgData, "JPEG", x, y, drawW, drawH, undefined, "FAST");
      }

      const filename = `${baseName(items[0]?.name || "scan")}-scan.pdf`;
      doc.save(filename);

      toast({ title: "Created!", description: "Your scanned PDF has been downloaded." });
    } catch (e: any) {
      toast({
        title: "Failed to create PDF",
        description: e?.message ? String(e.message) : "Something went wrong building the PDF.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ToolLayout
      title="Scan to PDF"
      description="Turn scanned photos into a clean PDF — enhance, rotate, reorder, and download (client-side)."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
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
              <p className="text-lg font-medium">Drop scanned images here</p>
              <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WebP (HEIC depends on browser)</p>
              <p className="text-xs text-muted-foreground mt-3">Add multiple images. Reorder before exporting.</p>
            </div>
          </Card>

          {/* Settings */}
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Page size</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                  disabled={creating}
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Orientation</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as Orientation)}
                  disabled={creating}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Mode</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  disabled={creating}
                >
                  <option value="color">Color</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="bw">Black & White</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Contrast</div>
                <input
                  type="number"
                  step="0.05"
                  min="0.7"
                  max="1.8"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  disabled={creating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Whiten background</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={whiten}
                onChange={(e) => setWhiten(Number(e.target.value))}
                disabled={creating}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Higher values make paper look whiter (helps shadowy scans).
              </div>
            </div>
          </Card>

          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{items.length}</span> image
                  {items.length === 1 ? "" : "s"} •{" "}
                  <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
                </div>
                <Button variant="ghost" onClick={clearAll} className="h-8 px-2" disabled={creating}>
                  Clear
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ScanLine className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(it.size)} • rotate {it.rotation}°
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0 || creating}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => move(idx, 1)}
                        disabled={idx === items.length - 1 || creating}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => rotate(it.id)}
                        disabled={creating}
                        aria-label="Rotate"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(it.id)}
                        disabled={creating}
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={createPDF} disabled={items.length === 0 || creating} className="w-full" size="lg">
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Create PDF
              </>
            )}
          </Button>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload photos of your documents</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Enhance (B&W, contrast, whiten), rotate and reorder</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download one clean PDF (one page per image)</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 100% client-side (private)</li>
              <li>• Multi-image PDF</li>
              <li>• Reorder + rotate pages</li>
              <li>• Cleanup filters for scanned photos</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
