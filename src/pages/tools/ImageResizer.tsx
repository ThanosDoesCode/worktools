import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Upload,
  Download,
  RefreshCw,
  Image as ImageIcon,
  Ruler,
  Percent,
  Ratio,
  Monitor,
  Share2,
  Link as LinkIcon,
  Mail,
  Tablet,
  Smartphone,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";

type Format = "png" | "jpeg" | "webp";
type Mode = "dimensions" | "percentage" | "aspect" | "device" | "social";
type Handling = "stretch" | "fill" | "fit-white" | "fit-black" | "fit-blur";

const ASPECTS: { label: string; w: number; h: number }[] = [
  { label: "1:1", w: 1, h: 1 },
  { label: "16:9", w: 16, h: 9 },
  { label: "9:16", w: 9, h: 16 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:4", w: 3, h: 4 },
  { label: "3:2", w: 3, h: 2 },
  { label: "2:3", w: 2, h: 3 },
];

const DEVICES: { id: string; label: string; icon: typeof Mail; w: number; h: number }[] = [
  { id: "email", label: "Email", icon: Mail, w: 600, h: 800 },
  { id: "desktop", label: "Desktop", icon: Monitor, w: 1920, h: 1080 },
  { id: "tablet", label: "Tablet", icon: Tablet, w: 1024, h: 768 },
  { id: "mobile", label: "Mobile", icon: Smartphone, w: 750, h: 1334 },
];

const SOCIAL: {
  id: string;
  brand: string;
  label: string;
  icon: typeof Instagram;
  color: string;
  w: number;
  h: number;
}[] = [
  { id: "ig-post", brand: "Instagram", label: "Post", icon: Instagram, color: "#E1306C", w: 1080, h: 1080 },
  { id: "ig-story", brand: "Instagram", label: "Story", icon: Instagram, color: "#E1306C", w: 1080, h: 1920 },
  { id: "fb-post", brand: "Facebook", label: "Post", icon: Facebook, color: "#1877F2", w: 1200, h: 630 },
  { id: "fb-story", brand: "Facebook", label: "Story", icon: Facebook, color: "#1877F2", w: 1080, h: 1920 },
  { id: "x-post", brand: "X", label: "Post", icon: Twitter, color: "#0F1419", w: 1200, h: 675 },
  { id: "pin", brand: "Pinterest", label: "Pin", icon: ImageIcon, color: "#E60023", w: 1000, h: 1500 },
  { id: "li-post", brand: "LinkedIn", label: "Post", icon: Linkedin, color: "#0A66C2", w: 1200, h: 627 },
];

const HANDLINGS: { id: Handling; label: string; sub?: string }[] = [
  { id: "stretch", label: "Stretch" },
  { id: "fill", label: "Fill", sub: "Zoom" },
  { id: "fit-white", label: "Fit", sub: "white bars" },
  { id: "fit-black", label: "Fit", sub: "black bars" },
  { id: "fit-blur", label: "Fit", sub: "blurry bars" },
];

export default function ImageResizer() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null);

  const [mode, setMode] = useState<Mode>("dimensions");

  // dimensions
  const [width, setWidth] = useState<string>("1000");
  const [height, setHeight] = useState<string>("1000");
  const [keepAspect, setKeepAspect] = useState(true);
  const [dimHandling, setDimHandling] = useState<Handling>("stretch");

  // percentage
  const [percent, setPercent] = useState<number>(100);

  // aspect
  const [aspectIdx, setAspectIdx] = useState<number>(0);
  const [aspectHandling, setAspectHandling] = useState<Handling>("fill");

  // device
  const [deviceId, setDeviceId] = useState<string>("desktop");

  // social
  const [socialId, setSocialId] = useState<string>("ig-post");
  const [socialHandling, setSocialHandling] = useState<Handling>("fill");

  const [format, setFormat] = useState<Format>("png");
  const [quality, setQuality] = useState<number>(92);
  const [resizedUrl, setResizedUrl] = useState<string>("");
  const [resizedSize, setResizedSize] = useState<number>(0);
  const [resizedDims, setResizedDims] = useState<{ w: number; h: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalUrlRef = useRef<string>("");
  const resizedUrlRef = useRef<string>("");

  useEffect(() => { originalUrlRef.current = originalUrl; }, [originalUrl]);
  useEffect(() => { resizedUrlRef.current = resizedUrl; }, [resizedUrl]);
  useEffect(() => () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resizedUrlRef.current) URL.revokeObjectURL(resizedUrlRef.current);
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resizedUrlRef.current) URL.revokeObjectURL(resizedUrlRef.current);
    setResizedUrl("");
    setResizedSize(0);
    setResizedDims(null);
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

  const handleWidthChange = (v: string) => {
    setWidth(v);
    const n = Number(v);
    if (keepAspect && originalDims && v !== "" && Number.isFinite(n) && n > 0) {
      setHeight(String(Math.round(n * (originalDims.h / originalDims.w))));
    }
  };
  const handleHeightChange = (v: string) => {
    setHeight(v);
    const n = Number(v);
    if (keepAspect && originalDims && v !== "" && Number.isFinite(n) && n > 0) {
      setWidth(String(Math.round(n * (originalDims.w / originalDims.h))));
    }
  };

  // Compute the target width/height and the handling mode from the current mode
  const computeTarget = (): { w: number; h: number; handling: Handling } | null => {
    if (!originalDims) return null;
    if (mode === "dimensions") {
      const w = Number(width), h = Number(height);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null;
      return { w: Math.round(w), h: Math.round(h), handling: keepAspect ? "stretch" : dimHandling };
    }
    if (mode === "percentage") {
      const p = percent / 100;
      return {
        w: Math.max(1, Math.round(originalDims.w * p)),
        h: Math.max(1, Math.round(originalDims.h * p)),
        handling: "stretch",
      };
    }
    if (mode === "aspect") {
      const a = ASPECTS[aspectIdx];
      // Fit source into given ratio, keeping longer dimension close to original.
      const srcRatio = originalDims.w / originalDims.h;
      const tgtRatio = a.w / a.h;
      let w = originalDims.w, h = originalDims.h;
      if (tgtRatio >= srcRatio) {
        w = originalDims.w;
        h = Math.round(w / tgtRatio);
      } else {
        h = originalDims.h;
        w = Math.round(h * tgtRatio);
      }
      return { w, h, handling: aspectHandling };
    }
    if (mode === "device") {
      const d = DEVICES.find((x) => x.id === deviceId)!;
      return { w: d.w, h: d.h, handling: "fit-white" };
    }
    // social
    const s = SOCIAL.find((x) => x.id === socialId)!;
    return { w: s.w, h: s.h, handling: socialHandling };
  };

  const drawWithHandling = (
    ctx: CanvasRenderingContext2D,
    src: CanvasImageSource,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number,
    handling: Handling,
  ) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (handling === "stretch") {
      ctx.drawImage(src, 0, 0, dstW, dstH);
      return;
    }

    const srcRatio = srcW / srcH;
    const dstRatio = dstW / dstH;

    if (handling === "fill") {
      // cover: scale to fill, crop overflow
      let sw = srcW, sh = srcH, sx = 0, sy = 0;
      if (srcRatio > dstRatio) {
        sw = srcH * dstRatio;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / dstRatio;
        sy = (srcH - sh) / 2;
      }
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dstW, dstH);
      return;
    }

    // fit variants: contain
    let dw = dstW, dh = dstH;
    if (srcRatio > dstRatio) {
      dh = Math.round(dstW / srcRatio);
    } else {
      dw = Math.round(dstH * srcRatio);
    }
    const dx = Math.round((dstW - dw) / 2);
    const dy = Math.round((dstH - dh) / 2);

    if (handling === "fit-white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dstW, dstH);
    } else if (handling === "fit-black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, dstW, dstH);
    } else if (handling === "fit-blur") {
      // draw a blurred cover version as background, then the fitted image on top
      ctx.save();
      ctx.filter = "blur(24px)";
      let sw = srcW, sh = srcH, sx = 0, sy = 0;
      if (srcRatio > dstRatio) {
        sw = srcH * dstRatio;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / dstRatio;
        sy = (srcH - sh) / 2;
      }
      ctx.drawImage(src, sx, sy, sw, sh, -20, -20, dstW + 40, dstH + 40);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, srcW, srcH, dx, dy, dw, dh);
  };

  const resize = async () => {
    if (!file || !originalUrl) {
      toast.error("Upload an image first");
      return;
    }
    const target = computeTarget();
    if (!target) {
      toast.error("Enter valid dimensions");
      return;
    }
    const { w, h, handling } = target;
    if (w < 1 || h < 1 || w > 10000 || h > 10000) {
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

      // Stepped downscale of the SOURCE for sharpness (only if downscaling significantly).
      // Target here approximates the largest dimension we'll actually draw.
      const drawTargetMax = Math.max(w, h);
      let srcCanvas: CanvasImageSource = img;
      let curW = img.naturalWidth;
      let curH = img.naturalHeight;
      while (Math.max(curW, curH) * 0.5 > drawTargetMax) {
        const nextW = Math.round(curW * 0.5);
        const nextH = Math.round(curH * 0.5);
        const step = document.createElement("canvas");
        step.width = nextW;
        step.height = nextH;
        const sctx = step.getContext("2d");
        if (!sctx) throw new Error("Canvas not supported");
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(srcCanvas, 0, 0, nextW, nextH);
        srcCanvas = step;
        curW = nextW;
        curH = nextH;
      }

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      if (format === "jpeg" && (handling === "stretch" || handling === "fill")) {
        // no transparency issues, but jpeg needs opaque base
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }

      drawWithHandling(ctx, srcCanvas, curW, curH, w, h, handling);

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
      setResizedDims({ w, h });
      toast.success(`Resized to ${w} x ${h}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resize image");
    } finally {
      setIsProcessing(false);
    }
  };

  const download = () => {
    if (!resizedUrl || !file || !resizedDims) return;
    const a = document.createElement("a");
    const base = file.name.replace(/\.[^.]+$/, "");
    a.href = resizedUrl;
    a.download = `${base}-${resizedDims.w}x${resizedDims.h}.${format === "jpeg" ? "jpg" : format}`;
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
    setResizedDims(null);
    setOriginalDims(null);
    setWidth("1000");
    setHeight("1000");
    setPercent(100);
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const sizeDelta = file && resizedSize ? ((resizedSize - file.size) / file.size) * 100 : 0;

  const MODES: { id: Mode; label: string; desc: string; icon: typeof Ruler }[] = [
    { id: "dimensions", label: "Resize by dimensions", desc: "Set exact width and height in pixels.", icon: Ruler },
    { id: "percentage", label: "Resize by percentage", desc: "Scale the image up or down proportionally.", icon: Percent },
    { id: "aspect", label: "Resize by aspect ratio", desc: "Fit the image into a chosen aspect ratio.", icon: Ratio },
    { id: "device", label: "Resize for", desc: "Optimize for a device or email.", icon: Monitor },
    { id: "social", label: "Resize for social media", desc: "Pick a platform-perfect size.", icon: Share2 },
  ];

  const HandlingRow = ({
    value,
    onChange,
  }: {
    value: Handling;
    onChange: (h: Handling) => void;
  }) => (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Resize handling</Label>
      <div className="grid grid-cols-5 gap-2">
        {HANDLINGS.map((h) => {
          const active = value === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onChange(h.id)}
              className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-all ${
                active
                  ? "border-primary bg-accent text-foreground ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <HandlingIcon id={h.id} active={active} />
              <div className="text-center leading-tight">
                <div className="font-medium">{h.label}</div>
                {h.sub && <div className="text-[10px] text-muted-foreground">{h.sub}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <ToolLayout
      title="Image Resizer"
      description="Resize any image by dimensions, percentage, aspect ratio, device, or social platform — all locally in your browser."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
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
              <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, WebP, GIF, BMP</p>
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

          {/* Mode selector — accordion-style radio cards */}
          <div className="space-y-3">
            {MODES.map((m) => {
              const selected = mode === m.id;
              const Icon = m.icon;
              return (
                <Card
                  key={m.id}
                  className={`overflow-hidden transition-all ${
                    selected
                      ? "border-primary shadow-md ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMode(m.id)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selected ? "border-primary" : "border-muted-foreground/40"
                      }`}
                    >
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {m.label}
                      </div>
                      {selected && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{m.desc}</p>
                      )}
                    </div>
                  </button>

                  {selected && (
                    <div className="border-t border-border bg-muted/20 p-4 space-y-4">
                      {m.id === "dimensions" && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="width" className="text-xs uppercase tracking-wide text-muted-foreground">Width (px)</Label>
                              <Input id="width" type="number" min={1} max={10000} value={width}
                                onChange={(e) => handleWidthChange(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="height" className="text-xs uppercase tracking-wide text-muted-foreground">Height (px)</Label>
                              <Input id="height" type="number" min={1} max={10000} value={height}
                                onChange={(e) => handleHeightChange(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                            <div>
                              <Label htmlFor="aspect" className="cursor-pointer">Lock aspect ratio</Label>
                              <p className="text-xs text-muted-foreground">Keep original proportions</p>
                            </div>
                            <Switch id="aspect" checked={keepAspect} onCheckedChange={setKeepAspect} />
                          </div>
                          {!keepAspect && <HandlingRow value={dimHandling} onChange={setDimHandling} />}
                        </>
                      )}

                      {m.id === "percentage" && (
                        <div className="space-y-4">
                          <Slider
                            value={[percent]}
                            min={1}
                            max={400}
                            step={1}
                            onValueChange={(v) => setPercent(v[0])}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>1%</span><span>100%</span><span>200%</span><span>400%</span>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={400}
                              value={percent}
                              onChange={(e) => setPercent(Math.max(1, Math.min(400, Number(e.target.value) || 1)))}
                              className="w-24 text-center"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                          {originalDims && (
                            <p className="text-center text-xs text-muted-foreground">
                              New size ≈ {Math.round(originalDims.w * percent / 100)} × {Math.round(originalDims.h * percent / 100)} px
                            </p>
                          )}
                        </div>
                      )}

                      {m.id === "aspect" && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {ASPECTS.map((a, i) => {
                              const active = aspectIdx === i;
                              return (
                                <button
                                  key={a.label}
                                  type="button"
                                  onClick={() => setAspectIdx(i)}
                                  className={`min-w-[56px] rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                                    active
                                      ? "border-primary bg-accent text-foreground ring-2 ring-primary/20"
                                      : "border-border bg-card hover:border-primary/40"
                                  }`}
                                >
                                  {a.label}
                                </button>
                              );
                            })}
                          </div>
                          <HandlingRow value={aspectHandling} onChange={setAspectHandling} />
                        </>
                      )}

                      {m.id === "device" && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {DEVICES.map((d) => {
                            const active = deviceId === d.id;
                            const Icon = d.icon;
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setDeviceId(d.id)}
                                className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-all ${
                                  active
                                    ? "border-primary bg-accent ring-2 ring-primary/20"
                                    : "border-border bg-card hover:border-primary/40"
                                }`}
                              >
                                <Icon className="h-6 w-6 text-foreground" />
                                <div className="text-center">
                                  <div className="text-sm font-medium">{d.label}</div>
                                  <div className="text-[10px] text-muted-foreground">{d.w}×{d.h}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {m.id === "social" && (
                        <>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {SOCIAL.map((s) => {
                              const active = socialId === s.id;
                              const Icon = s.icon;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setSocialId(s.id)}
                                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                                    active
                                      ? "border-primary bg-accent ring-2 ring-primary/20"
                                      : "border-border bg-card hover:border-primary/40"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" style={{ color: s.color }} />
                                  <div className="text-center leading-tight">
                                    <div className="text-xs font-medium">{s.brand}</div>
                                    <div className="text-[10px] text-muted-foreground">{s.label} · {s.w}×{s.h}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <HandlingRow value={socialHandling} onChange={setSocialHandling} />
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Output settings */}
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Output</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Input id="quality" type="range" min={10} max={100} value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))} />
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

        {/* Right column: Preview */}
        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          <Card className="p-6">
            <h2 className="mb-4 font-semibold text-foreground">Preview</h2>
            {resizedUrl && resizedDims ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center rounded-md bg-muted/30 p-4 min-h-[240px]">
                  <img src={resizedUrl} alt="Resized preview"
                    className="max-h-[400px] max-w-full rounded-md object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">New size</p>
                    <p className="font-semibold">{resizedDims.w} × {resizedDims.h}</p>
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
                <img src={originalUrl} alt="Original"
                  className="max-h-[300px] max-w-full rounded-md object-contain opacity-70" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Choose a mode and click "Resize Image"
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-md bg-muted/20 p-10 text-center min-h-[240px]">
                <ImageIcon className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Upload an image to get started</p>
              </div>
            )}
          </Card>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {/* prevent unused import warning */}
      <span className="hidden"><LinkIcon /></span>
    </ToolLayout>
  );
}

/** Small inline SVG icons for the handling row — match the reference screenshots */
function HandlingIcon({ id, active }: { id: Handling; active: boolean }) {
  const stroke = active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
  const fill = active ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))";
  const common = { width: 34, height: 22, viewBox: "0 0 34 22", fill: "none" } as const;
  if (id === "stretch") {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="32" height="20" rx="2" stroke={stroke} fill={fill} />
        <path d="M6 11h22M6 11l3-3M6 11l3 3M28 11l-3-3M28 11l-3 3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "fill") {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="32" height="20" rx="2" stroke={stroke} fill={fill} />
        <path d="M11 6v10M23 6v10M11 11h12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  const bar = id === "fit-white" ? "#ffffff" : id === "fit-black" ? "#111111" : "url(#blur)";
  return (
    <svg {...common}>
      <defs>
        <pattern id="blur" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill={stroke} opacity="0.5" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="32" height="20" rx="2" stroke={stroke} fill={bar} />
      <rect x="10" y="1" width="14" height="20" fill={fill} stroke={stroke} />
      <path d="M12 4l10 14M22 4L12 18" stroke={stroke} strokeWidth="1" />
    </svg>
  );
}
