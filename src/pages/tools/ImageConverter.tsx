import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif";

interface ImgItem {
  id: string;
  file: File;
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
  return "avif";
}

// Checks whether the browser can encode a specific MIME type
async function supportsEncoding(mime: string): Promise<boolean> {
  // Very lightweight check: try canvas.toDataURL first
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1, 1);
  try {
    const dataUrl = c.toDataURL(mime);
    // if unsupported, browsers usually return image/png
    return dataUrl.startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
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

export default function ImageConverter() {
  const { toast } = useToast();

  const [items, setItems] = useState<ImgItem[]>([]);
  const [converting, setConverting] = useState(false);

  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [quality, setQuality] = useState(85); // used for jpg/webp/avif
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [targetWidth, setTargetWidth] = useState<number>(1200);
  const [keepAspect, setKeepAspect] = useState(true);

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
      const allowed = acceptedFiles.filter((f) =>
        ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(f.type) ||
        /\.(jpg|jpeg|png|webp|avif)$/i.test(f.name)
      );

      if (allowed.length === 0) {
        toast({
          title: "Upload images only",
          description: "Supported: JPG, PNG, WebP, AVIF",
          variant: "destructive",
        });
        return;
      }

      const newItems: ImgItem[] = [];
      for (const file of allowed) {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: safeId(),
          file,
          name: file.name,
          size: file.size,
          previewUrl,
        });
      }

      setItems((prev) => [...prev, ...newItems]);

      // Try to read dimensions (nice UX)
      try {
        for (const it of newItems) {
          const img = await loadImageFromFile(it.file);
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
    },
  });

  const clearAll = () => {
    // revoke previews + converted urls
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
        description: "Choose WebP, PNG, or JPG instead.",
        variant: "destructive",
      });
      return;
    }
    if (format === "image/webp" && !webpSupported) {
      toast({
        title: "WebP not supported in this browser",
        description: "Choose PNG or JPG instead.",
        variant: "destructive",
      });
      return;
    }

    setConverting(true);

    try {
      const updated: ImgItem[] = [];

      for (const it of items) {
        // clean previous conversion URL
        if (it.convertedUrl) URL.revokeObjectURL(it.convertedUrl);

        const img = await loadImageFromFile(it.file);

        const originalW = img.width || it.width || 0;
        const originalH = img.height || it.height || 0;

        let outW = originalW;
        let outH = originalH;

        if (resizeEnabled && targetWidth > 0 && originalW > 0 && originalH > 0) {
          outW = targetWidth;
          outH = keepAspect ? Math.round((originalH * targetWidth) / originalW) : originalH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, outW);
        canvas.height = Math.max(1, outH);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");

        // Draw
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const q = Math.max(0.1, Math.min(1, quality / 100));
        const needsQuality = format === "image/jpeg" || format === "image/webp" || format === "image/avif";

        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob(
            (b) => resolve(b),
            format,
            needsQuality ? q : undefined
          );
        });

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
    // Browser will download multiple files
    ready.forEach(downloadOne);
  };

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  return (
    <ToolLayout
      title="Image Converter"
      description="Convert JPG/PNG/WebP/AVIF images in your browser — private, fast, no uploads."
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
              <p className="text-lg font-medium">Drop images here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Supports JPG, PNG, WebP, AVIF</p>
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
                </SelectContent>
              </Select>
              {!webpSupported && (
                <p className="text-xs text-muted-foreground">WebP encoding not supported in this browser.</p>
              )}
              {!avifSupported && (
                <p className="text-xs text-muted-foreground">AVIF encoding not supported in this browser.</p>
              )}
            </div>

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
                disabled={format === "image/png"}
              />
              <p className="text-xs text-muted-foreground">
                Quality applies to JPG/WebP/AVIF. PNG is lossless.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Resize</Label>
                <p className="text-xs text-muted-foreground">Scale images to a target width</p>
              </div>
              <Switch checked={resizeEnabled} onCheckedChange={setResizeEnabled} />
            </div>

            {resizeEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Target width</Label>
                  <span className="text-sm text-muted-foreground">{targetWidth}px</span>
                </div>
                <Slider
                  value={[targetWidth]}
                  onValueChange={(v) => setTargetWidth(v[0] ?? 1200)}
                  min={320}
                  max={4000}
                  step={10}
                />
                <div className="flex items-center justify-between">
                  <Label>Keep aspect ratio</Label>
                  <Switch checked={keepAspect} onCheckedChange={setKeepAspect} />
                </div>
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={convertAll}
              disabled={items.length === 0 || converting}
              className="w-full"
              size="lg"
            >
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
                      <img
                        src={it.previewUrl}
                        alt={it.name}
                        className="h-12 w-12 rounded-md object-cover border"
                      />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.width && it.height ? `${it.width}×${it.height} • ` : ""}
                          {formatBytes(it.size)}
                          {it.convertedSize ? ` → ${formatBytes(it.convertedSize)}` : ""}
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
                <span>Upload one or more images</span>
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
              <li>• PNG keeps transparency. JPG does not.</li>
              <li>• AVIF/WebP support depends on your browser.</li>
              <li>• No files are uploaded anywhere.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
