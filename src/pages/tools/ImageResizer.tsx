import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, Download, RefreshCw, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Format = "png" | "jpeg" | "webp";

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "1000 x 1000 (Square)", w: 1000, h: 1000 },
  { label: "1920 x 1080 (Full HD)", w: 1920, h: 1080 },
  { label: "1280 x 720 (HD)", w: 1280, h: 720 },
  { label: "1080 x 1080 (Instagram)", w: 1080, h: 1080 },
  { label: "1200 x 630 (OG Image)", w: 1200, h: 630 },
  { label: "800 x 600", w: 800, h: 600 },
  { label: "512 x 512 (Icon)", w: 512, h: 512 },
];

export default function ImageResizer() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState<string>("1000");
  const [height, setHeight] = useState<string>("1000");
  const [keepAspect, setKeepAspect] = useState(true);
  const [format, setFormat] = useState<Format>("png");
  const [quality, setQuality] = useState<number>(92);
  const [resizedUrl, setResizedUrl] = useState<string>("");
  const [resizedSize, setResizedSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalUrlRef = useRef<string>("");
  const resizedUrlRef = useRef<string>("");

  useEffect(() => {
    originalUrlRef.current = originalUrl;
  }, [originalUrl]);
  useEffect(() => {
    resizedUrlRef.current = resizedUrl;
  }, [resizedUrl]);

  useEffect(() => {
    return () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      if (resizedUrlRef.current) URL.revokeObjectURL(resizedUrlRef.current);
    };
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resizedUrlRef.current) URL.revokeObjectURL(resizedUrlRef.current);
    setResizedUrl("");
    setResizedSize(0);
    setFile(f);
    const url = URL.createObjectURL(f);
    setOriginalUrl(url);
    const img = new Image();
    img.onload = () => {
      setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight });
      setWidth(String(img.naturalWidth));
      setHeight(String(img.naturalHeight));
    };
    img.src = url;
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"] },
    multiple: false,
  });

  const handleWidthChange = (v: number) => {
    setWidth(v);
    if (keepAspect && originalDims) {
      const ratio = originalDims.h / originalDims.w;
      setHeight(Math.round(v * ratio));
    }
  };

  const handleHeightChange = (v: number) => {
    setHeight(v);
    if (keepAspect && originalDims) {
      const ratio = originalDims.w / originalDims.h;
      setWidth(Math.round(v * ratio));
    }
  };

  const applyPreset = (idx: string) => {
    const p = PRESETS[Number(idx)];
    if (!p) return;
    setKeepAspect(false);
    setWidth(String(p.w));
    setHeight(String(p.h));
  };

  const resize = async () => {
    if (!file || !originalUrl) {
      toast.error("Upload an image first");
      return;
    }
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > 10000 || h > 10000) {
      toast.error("Dimensions must be between 1 and 10000");
      return;
    }
    setIsProcessing(true);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Failed to load image"));
        img.src = originalUrl;
      });
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      const mime = `image/${format}`;
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("Failed to encode image"))),
          mime,
          format === "png" ? undefined : quality / 100,
        ),
      );
      if (resizedUrlRef.current) URL.revokeObjectURL(resizedUrlRef.current);
      const url = URL.createObjectURL(blob);
      setResizedUrl(url);
      setResizedSize(blob.size);
      toast.success(`Resized to ${w} x ${h}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resize image");
    } finally {
      setIsProcessing(false);
    }
  };

  const download = () => {
    if (!resizedUrl || !file) return;
    const a = document.createElement("a");
    const base = file.name.replace(/\.[^.]+$/, "");
    a.href = resizedUrl;
    a.download = `${base}-${width}x${height}.${format === "jpeg" ? "jpg" : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resizedUrlRef.current) URL.revokeObjectURL(resizedUrlRef.current);
    setFile(null);
    setOriginalUrl("");
    setResizedUrl("");
    setResizedSize(0);
    setOriginalDims(null);
    setWidth("1000");
    setHeight("1000");
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const sizeDelta =
    file && resizedSize
      ? ((resizedSize - file.size) / file.size) * 100
      : 0;

  return (
    <ToolLayout
      title="Image Resizer"
      description="Change the resolution of any image and download it in PNG, JPG, or WebP. All processing happens locally in your browser."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Upload + settings */}
        <div className="space-y-6">
          <Card className="p-6">
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">
                {isDragActive ? "Drop image here" : "Drag & drop or click to upload"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                PNG, JPG, WebP, GIF, BMP
              </p>
            </div>

            {file && originalDims && (
              <div className="mt-4 flex items-center justify-between rounded-md bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {originalDims.w} x {originalDims.h} · {formatBytes(file.size)}
                </span>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Resize Settings</h2>

            <div className="space-y-2">
              <Label>Preset Sizes</Label>
              <Select onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p, i) => (
                    <SelectItem key={p.label} value={String(i)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="width">Width (px)</Label>
                <Input
                  id="width"
                  type="number"
                  min={1}
                  max={10000}
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (px)</Label>
                <Input
                  id="height"
                  type="number"
                  min={1}
                  max={10000}
                  value={height}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="aspect" className="cursor-pointer">Lock aspect ratio</Label>
                <p className="text-xs text-muted-foreground">Keep original proportions</p>
              </div>
              <Switch id="aspect" checked={keepAspect} onCheckedChange={setKeepAspect} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (lossless)</SelectItem>
                    <SelectItem value="jpeg">JPG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {format !== "png" && (
                <div className="space-y-2">
                  <Label htmlFor="quality">Quality ({quality}%)</Label>
                  <Input
                    id="quality"
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={resize} disabled={!file || isProcessing} className="flex-1">
                {isProcessing ? "Resizing..." : "Resize Image"}
              </Button>
              <Button variant="outline" onClick={reset} disabled={!file}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: Preview + download */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 font-semibold text-foreground">Preview</h2>
            {resizedUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center rounded-md bg-muted/30 p-4 min-h-[240px]">
                  <img
                    src={resizedUrl}
                    alt="Resized preview"
                    className="max-h-[400px] max-w-full rounded-md object-contain"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">New size</p>
                    <p className="font-semibold">{width} x {height}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">File size</p>
                    <p className="font-semibold">
                      {formatBytes(resizedSize)}{" "}
                      {file && (
                        <span className={sizeDelta <= 0 ? "text-success text-xs" : "text-destructive text-xs"}>
                          ({sizeDelta > 0 ? "+" : ""}{sizeDelta.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button onClick={download} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Resized Image
                </Button>
              </div>
            ) : originalUrl ? (
              <div className="flex flex-col items-center justify-center rounded-md bg-muted/30 p-6 text-center min-h-[240px]">
                <img
                  src={originalUrl}
                  alt="Original"
                  className="max-h-[300px] max-w-full rounded-md object-contain opacity-70"
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  Adjust dimensions and click "Resize Image"
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-md bg-muted/20 p-10 text-center min-h-[240px]">
                <ImageIcon className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload an image to get started
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </ToolLayout>
  );
}
