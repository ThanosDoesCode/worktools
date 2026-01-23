import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import heic2any from "heic2any";

import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OutputFormat =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/avif"
  | "image/x-icon";

type BgMode = "white" | "black" | "custom";

interface ImgItem {
  id: string;

  /** Original file as uploaded (for naming/traceability) */
  originalFile: File;

  /** File we actually decode/render (HEIC -> PNG conversion becomes this) */
  workingFile: File;

  name: string;
  size: number;

  previewUrl: string;
  width?: number;
  height?: number;

  convertedUrl?: string;
  convertedName?: string;
  convertedType?: OutputFormat;
  convertedSize?: number;
}

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

function extFromMime(mime: OutputFormat) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return "ico";
}

function isHeicLike(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function isSvgLike(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/svg+xml" || name.endsWith(".svg");
}

function isIcoLike(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/x-icon" ||
    file.type === "image/vnd.microsoft.icon" ||
    name.endsWith(".ico")
  );
}

function isBmpLike(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/bmp" || name.endsWith(".bmp");
}

// Checks whether the browser can encode a specific MIME type
async function supportsEncoding(mime: string): Promise<boolean> {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1, 1);

  try {
    const dataUrl = c.toDataURL(mime);
    return dataUrl.startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return loadImageFromBlob(file);
}

/**
 * Minimal ICO encoder:
 * Creates a single-icon ICO file containing one PNG image (commonly 256x256).
 * This is enough for favicon usage in most cases.
 */
async function canvasToIcoBlob(canvas: HTMLCanvasElement, size = 256): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(canvas, 0, 0, size, size);

  const pngBlob: Blob | null = await new Promise((resolve) => {
    c.toBlob((b) => resolve(b), "image/png");
  });
  if (!pngBlob) throw new Error("Could not encode PNG for ICO");

  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  // ICONDIR (6 bytes): reserved(2)=0, type(2)=1, count(2)=1
  const header = new Uint8Array(6);
  header[0] = 0;
  header[1] = 0;
  header[2] = 1;
  header[3] = 0;
  header[4] = 1;
  header[5] = 0;

  // ICONDIRENTRY (16 bytes)
  // width(1), height(1), colorCount(1)=0, reserved(1)=0,
  // planes(2)=1, bitCount(2)=32, bytesInRes(4), imageOffset(4)
  const entry = new Uint8Array(16);
  entry[0] = size === 256 ? 0 : size; // 0 means 256 in ICO
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry[4] = 1;
  entry[5] = 0;
  entry[6] = 32;
  entry[7] = 0;

  const bytesInRes = pngBytes.length;
  const imageOffset = 6 + 16; // header + entry

  // bytesInRes (LE)
  entry[8] = bytesInRes & 0xff;
  entry[9] = (bytesInRes >> 8) & 0xff;
  entry[10] = (bytesInRes >> 16) & 0xff;
  entry[11] = (bytesInRes >> 24) & 0xff;

  // imageOffset (LE)
  entry[12] = imageOffset & 0xff;
  entry[13] = (imageOffset >> 8) & 0xff;
  entry[14] = (imageOffset >> 16) & 0xff;
  entry[15] = (imageOffset >> 24) & 0xff;

  const out = new Uint8Array(header.length + entry.length + pngBytes.length);
  out.set(header, 0);
  out.set(entry, header.length);
  out.set(pngBytes, header.length + entry.length);

  return new Blob([out], { type: "image/x-icon" });
}

export default function ImageConverter() {
  const { toast } = useToast();

  const [items, setItems] = useState<ImgItem[]>([]);
  const [converting, setConverting] = useState(false);

  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [quality, setQuality] = useState(85); // used for jpg/webp/avif

  // Resize
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [targetWidth, setTargetWidth] = useState<number>(1200);
  const [targetHeight, setTargetHeight] = useState<number>(0); // 0 means "auto" when aspect locked
  const [keepAspect, setKeepAspect] = useState(true);
  const [dontUpscale, setDontUpscale] = useState(true);

  // JPG background when transparency exists
  const [jpgBgMode, setJpgBgMode] = useState<BgMode>("white");
  const [jpgBgCustom, setJpgBgCustom] = useState<string>("#ffffff");

  const [avifSupported, setAvifSupported] = useState<boolean>(false);
  const [webpSupported, setWebpSupported] = useState<boolean>(true);

  // detect encoding support once
  useMemo(() => {
    (async () => {
      const w = await supportsEncoding("image/webp");
      const a = await supportsEncoding("image/avif");
      setWebpSupported(w);
      setAvifSupported(a);
      if (!w) setFormat("image/png");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Accept broad set of image extensions & types
      const allowed = acceptedFiles.filter((f) => {
        const nameOk = /\.(jpg|jpeg|png|webp|avif|bmp|svg|ico|heic|heif)$/i.test(f.name);
        const typeOk = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/avif",
          "image/bmp",
          "image/svg+xml",
          "image/x-icon",
          "image/vnd.microsoft.icon",
          "image/heic",
          "image/heif",
        ].includes(f.type);

        // Some browsers leave type empty for uncommon formats
        return typeOk || nameOk;
      });

      if (allowed.length === 0) {
        toast({
          title: "Upload images only",
          description: "Supported: JPG, PNG, WebP, AVIF, HEIC/HEIF, BMP, SVG, ICO",
          variant: "destructive",
        });
        return;
      }

      const newItems: ImgItem[] = [];

      for (const file of allowed) {
        let workingFile = file;

        // HEIC/HEIF -> PNG conversion for browser compatibility
        if (isHeicLike(file)) {
          try {
            const converted = await heic2any({
              blob: file,
              toType: "image/png",
              quality: 0.92,
            });

            // heic2any can return Blob or Blob[]
            const blob = Array.isArray(converted) ? converted[0] : converted;
            const base = file.name.replace(/\.[^.]+$/, "");
            workingFile = new File([blob], `${base}.png`, { type: "image/png" });
          } catch (e) {
            toast({
              title: "HEIC/HEIF decode failed",
              description: `Could not decode "${file.name}" in this browser.`,
              variant: "destructive",
            });
            continue;
          }
        }

        const previewUrl = URL.createObjectURL(workingFile);

        newItems.push({
          id: safeId(),
          originalFile: file,
          workingFile,
          name: file.name,
          size: file.size,
          previewUrl,
        });
      }

      setItems((prev) => [...prev, ...newItems]);

      // Try to read dimensions (nice UX)
      try {
        for (const it of newItems) {
          const img = await loadImageFromFile(it.workingFile);
          setItems((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, width: img.width, height: img.height } : p))
          );
        }
      } catch {
        // ignore
      }
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 50,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/avif": [".avif"],
      "image/bmp": [".bmp"],
      "image/svg+xml": [".svg"],
      "image/x-icon": [".ico"],
      "image/vnd.microsoft.icon": [".ico"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
  });

  const clearAll = () => {
    items.forEach((it) => {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      if (it.convertedUrl) URL.revokeObjectURL(it.convertedUrl);
    });
    setItems([]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      if (found?.convertedUrl) URL.revokeObjectURL(found.convertedUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const convertAll = async () => {
    if (items.length === 0) return;

    // guard: avif/webp support
    if (format === "image/avif" && !avifSupported) {
      toast({
        title: "AVIF not supported in this browser",
        description: "Choose WebP, PNG, JPG, or ICO instead.",
        variant: "destructive",
      });
      return;
    }
    if (format === "image/webp" && !webpSupported) {
      toast({
        title: "WebP not supported in this browser",
        description: "Choose PNG, JPG, or ICO instead.",
        variant: "destructive",
      });
      return;
    }

    setConverting(true);

    try {
      const updated: ImgItem[] = [];

      for (const it of items) {
        if (it.convertedUrl) URL.revokeObjectURL(it.convertedUrl);

        // Load image (SVG/BMP/ICO usually work if browser can decode them)
        let img: HTMLImageElement;
        try {
          img = await loadImageFromFile(it.workingFile);
        } catch (e) {
          // SVG can fail to render if it references external stuff; try as text->data url fallback
          if (isSvgLike(it.workingFile)) {
            const svgText = await it.workingFile.text();
            const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
            img = await loadImageFromBlob(svgBlob);
          } else {
            throw new Error(`Could not decode "${it.name}"`);
          }
        }

        const originalW = img.width || it.width || 0;
        const originalH = img.height || it.height || 0;

        let outW = originalW || 1;
        let outH = originalH || 1;

        if (resizeEnabled && originalW > 0 && originalH > 0) {
          const w = Math.max(1, targetWidth || originalW);
          const h = Math.max(1, targetHeight || 0);

          if (keepAspect) {
            // If height is 0, compute from width. If both set, fit by width.
            const baseW = w > 0 ? w : originalW;
            const computedH = Math.round((originalH * baseW) / originalW);
            outW = baseW;
            outH = targetHeight > 0 ? Math.round((originalH * baseW) / originalW) : computedH;
          } else {
            outW = w;
            outH = targetHeight > 0 ? h : originalH;
          }

          if (dontUpscale) {
            outW = Math.min(outW, originalW);
            outH = Math.min(outH, originalH);
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, outW);
        canvas.height = Math.max(1, outH);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");

        // If output is JPG, fill background first (since JPG has no alpha)
        if (format === "image/jpeg") {
          const bg =
            jpgBgMode === "white"
              ? "#ffffff"
              : jpgBgMode === "black"
                ? "#000000"
                : jpgBgCustom || "#ffffff";
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Create output blob
        let blob: Blob | null = null;

        if (format === "image/x-icon") {
          // ICO: generate favicon-style ico (single PNG icon embedded)
          // Choose 256 by default, but if smaller canvas, pick the min dimension
          const maxSize = Math.min(256, canvas.width, canvas.height);
          const icoSize = maxSize >= 256 ? 256 : maxSize >= 128 ? 128 : maxSize >= 64 ? 64 : 32;
          blob = await canvasToIcoBlob(canvas, icoSize);
        } else {
          const q = Math.max(0.1, Math.min(1, quality / 100));
          const needsQuality =
            format === "image/jpeg" || format === "image/webp" || format === "image/avif";

          blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), format, needsQuality ? q : undefined);
          });
        }

        if (!blob) throw new Error("Could not encode image");

        const outExt = extFromMime(format);
        const base = it.name.replace(/\.[^.]+$/, "");
        const outName = `${base}.${outExt}`;
        const outUrl = URL.createObjectURL(blob);

        updated.push({
          ...it,
          convertedUrl: outUrl,
          convertedName: outName,
          convertedType: format,
          convertedSize: blob.size,
          width: originalW,
          height: originalH,
        });
      }

      setItems(updated);

      toast({
        title: "Converted!",
        description: "Your converted files are ready to download.",
      });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong during conversion.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const downloadOne = (it: ImgItem) => {
    if (!it.convertedUrl || !it.convertedName) return;
    const a = document.createElement("a");
    a.href = it.convertedUrl;
    a.download = it.convertedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAll = () => {
    const ready = items.filter((x) => x.convertedUrl && x.convertedName);
    if (ready.length === 0) {
      toast({
        title: "Nothing to download",
        description: "Convert your images first.",
        variant: "destructive",
      });
      return;
    }
    ready.forEach(downloadOne);
  };

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  const supportedHint = useMemo(() => {
    const base = "Supports JPG, PNG, WebP, AVIF, BMP, SVG, ICO";
    return `${base}, HEIC/HEIF`;
  }, []);

  const qualityDisabled = format === "image/png" || format === "image/x-icon";

  return (
    <ToolLayout
      title="Image Converter"
      description="Convert images in your browser — private, fast, no uploads. Supports JPG/PNG/WebP/AVIF + HEIC/HEIF, BMP, SVG, ICO."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
        <div className="space-y-6">
          <Card className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drop images here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">{supportedHint}</p>
            </div>
          </Card>

          {/* Settings */}
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Output format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as OutputFormat)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image/png">PNG (best for transparency)</SelectItem>
                  <SelectItem value="image/jpeg">JPG (smaller, no transparency)</SelectItem>
                  {webpSupported && <SelectItem value="image/webp">WebP (great compression)</SelectItem>}
                  {avifSupported && <SelectItem value="image/avif">AVIF (smallest, modern)</SelectItem>}
                  <SelectItem value="image/x-icon">ICO (favicon)</SelectItem>
                </SelectContent>
              </Select>
              {!webpSupported && (
                <p className="text-xs text-muted-foreground">WebP encoding not supported in this browser.</p>
              )}
              {!avifSupported && (
                <p className="text-xs text-muted-foreground">AVIF encoding not supported in this browser.</p>
              )}
            </div>

            {format === "image/jpeg" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="text-sm font-medium">JPG background (for transparent images)</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <Select value={jpgBgMode} onValueChange={(v) => setJpgBgMode(v as BgMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="black">Black</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {jpgBgMode === "custom" && (
                    <div className="space-y-2">
                      <Label>Custom color</Label>
                      <Input
                        value={jpgBgCustom}
                        onChange={(e) => setJpgBgCustom(e.target.value)}
                        placeholder="#ffffff"
                      />
                      <p className="text-xs text-muted-foreground">Use hex like #ffffff</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quality</Label>
                <span className="text-sm text-muted-foreground">{quality}%</span>
              </div>
              <Slider
                value={[quality]}
                onValueChange={(v) => setQuality(v[0] ?? 85)}
                min={10}
                max={100}
                step={1}
                disabled={qualityDisabled}
              />
              <p className="text-xs text-muted-foreground">
                Quality applies to JPG/WebP/AVIF. PNG and ICO are lossless.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Resize</Label>
                <p className="text-xs text-muted-foreground">Scale images to a target width/height</p>
              </div>
              <Switch checked={resizeEnabled} onCheckedChange={setResizeEnabled} />
            </div>

            {resizeEnabled && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target width (px)</Label>
                    <Input
                      type="number"
                      value={targetWidth}
                      onChange={(e) => setTargetWidth(Math.max(1, Number(e.target.value || 1)))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target height (px)</Label>
                    <Input
                      type="number"
                      value={targetHeight}
                      onChange={(e) => setTargetHeight(Math.max(0, Number(e.target.value || 0)))}
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">0 = auto (when aspect ratio is on)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Keep aspect ratio</Label>
                  <Switch checked={keepAspect} onCheckedChange={setKeepAspect} />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Don’t upscale</Label>
                  <Switch checked={dontUpscale} onCheckedChange={setDontUpscale} />
                </div>
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={convertAll} disabled={items.length === 0 || converting} className="w-full" size="lg">
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Convert
                </>
              )}
            </Button>

            <Button
              onClick={downloadAll}
              disabled={items.every((x) => !x.convertedUrl)}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Download all
            </Button>
          </div>

          {items.length > 0 && (
            <Button variant="ghost" onClick={clearAll} className="w-full">
              Clear all
            </Button>
          )}
        </div>

        {/* Right */}
        <div className="space-y-6">
          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{items.length}</span> image
                  {items.length === 1 ? "" : "s"} •{" "}
                  <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={it.previewUrl} alt={it.name} className="h-12 w-12 rounded-md object-cover border" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.width && it.height ? `${it.width}×${it.height} • ` : ""}
                          {formatBytes(it.size)}
                          {it.convertedSize ? ` → ${formatBytes(it.convertedSize)}` : ""}
                          {it.convertedSize && (
                            <span
                              className={`ml-1 font-medium ${
                                it.convertedSize < it.size
                                  ? "text-green-600 dark:text-green-400"
                                  : it.convertedSize > it.size
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              ({it.convertedSize < it.size ? "−" : it.convertedSize > it.size ? "+" : ""}
                              {Math.abs(Math.round(((it.convertedSize - it.size) / it.size) * 100))}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {it.convertedUrl && it.convertedName ? (
                        <Button variant="secondary" size="sm" onClick={() => downloadOne(it)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled>
                          Not ready
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} aria-label="Remove">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload one or more images (including HEIC/HEIF, SVG, ICO)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Choose output format + quality (optional resize)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Convert and download — runs locally in your browser</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• PNG keeps transparency. JPG does not (choose a background above).</li>
              <li>• AVIF/WebP encoding depends on your browser.</li>
              <li>• HEIC/HEIF is decoded locally using a browser-side converter.</li>
              <li>• SVG is rasterized (converted to pixels) when exporting to PNG/JPG/WebP/AVIF/ICO.</li>
              <li>• No files are uploaded anywhere.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
