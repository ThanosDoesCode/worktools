import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Download, Image as ImageIcon, Loader2, Wand2, FileArchive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type MimeOut = "image/jpeg" | "image/webp";

type PresetId =
  | "email-1mb"
  | "email-5mb"
  | "instagram-post"
  | "instagram-story"
  | "linkedin"
  | "website"
  | "custom";

interface ImgItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  width?: number;
  height?: number;

  outUrl?: string;
  outName?: string;
  outType?: MimeOut;
  outSize?: number;
  outWidth?: number;
  outHeight?: number;
  qualityUsed?: number;
  outBlob?: Blob; // <-- added for ZIP
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function extFromMime(m: MimeOut) {
  return m === "image/jpeg" ? "jpg" : "webp";
}

type Preset = {
  id: PresetId;
  name: string;
  description: string;
  targetBytes?: number; // if present, try to hit size
  maxWidth?: number; // scale down to this width (keep aspect)
  exactSize?: { w: number; h: number }; // informational
};

const PRESETS: Preset[] = [
  {
    id: "email-1mb",
    name: "Email (≤ 1MB each)",
    description: "Good for quick attachments and fast sending",
    targetBytes: 1 * 1024 * 1024,
    maxWidth: 1600,
  },
  {
    id: "email-5mb",
    name: "Email (≤ 5MB each)",
    description: "Safer for larger images / multiple attachments",
    targetBytes: 5 * 1024 * 1024,
    maxWidth: 2400,
  },
  {
    id: "instagram-post",
    name: "Instagram Post (1080px)",
    description: "Resizes to ~1080px wide (best practice)",
    maxWidth: 1080,
    targetBytes: 900 * 1024,
  },
  {
    id: "instagram-story",
    name: "Instagram Story/Reel (1080×1920)",
    description: "Fits to 1080px wide (no cropping)",
    maxWidth: 1080,
    targetBytes: 1200 * 1024,
    exactSize: { w: 1080, h: 1920 },
  },
  {
    id: "linkedin",
    name: "LinkedIn Post (1200px)",
    description: "Clean and sharp for LinkedIn feed",
    maxWidth: 1200,
    targetBytes: 1200 * 1024,
  },
  {
    id: "website",
    name: "Website (1600px)",
    description: "Great quality for hero images / blogs",
    maxWidth: 1600,
    targetBytes: 1600 * 1024,
  },
  {
    id: "custom",
    name: "Custom",
    description: "Pick your own size + quality + target MB",
  },
];

async function canvasEncode(
  img: HTMLImageElement,
  outType: MimeOut,
  width: number,
  height: number,
  quality01: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      outType,
      outType === "image/jpeg" || outType === "image/webp" ? quality01 : undefined
    );
  });

  if (!blob) throw new Error("Could not encode image");
  return blob;
}

async function compressToTarget(params: {
  img: HTMLImageElement;
  outType: MimeOut;
  origW: number;
  origH: number;
  maxWidth: number;
  targetBytes?: number;
  minQ: number; // 0..1
  maxQ: number; // 0..1
}): Promise<{ blob: Blob; w: number; h: number; q: number }> {
  const { img, outType, origW, origH, maxWidth, targetBytes, minQ, maxQ } = params;

  const aspect = origH / origW;
  let w = Math.min(origW, maxWidth);
  let h = Math.round(w * aspect);

  const encodeAt = async (q: number) => canvasEncode(img, outType, w, h, q);

  if (!targetBytes) {
    const blob = await encodeAt(maxQ);
    return { blob, w, h, q: maxQ };
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    let lo = minQ;
    let hi = maxQ;
    let bestBlob: Blob | null = null;
    let bestQ = maxQ;

    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const blob = await encodeAt(mid);

      if (blob.size <= targetBytes) {
        bestBlob = blob;
        bestQ = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    if (bestBlob) {
      return { blob: bestBlob, w, h, q: bestQ };
    }

    w = Math.max(320, Math.round(w * 0.85));
    h = Math.round(w * aspect);

    if (w <= 340) {
      const blob = await canvasEncode(img, outType, w, h, minQ);
      return { blob, w, h, q: minQ };
    }
  }

  const blob = await canvasEncode(img, outType, w, h, minQ);
  return { blob, w, h, q: minQ };
}

export default function ImageCompressor() {
  const { toast } = useToast();

  const [items, setItems] = useState<ImgItem[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [zipping, setZipping] = useState(false);

  const [presetId, setPresetId] = useState<PresetId>("email-1mb");
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);

  const [outType, setOutType] = useState<MimeOut>("image/webp");
  const [webpSupported, setWebpSupported] = useState(true);

  const [customTargetMB, setCustomTargetMB] = useState<number>(1);
  const [customMaxWidth, setCustomMaxWidth] = useState<number>(1600);
  const [minQuality, setMinQuality] = useState<number>(55);
  const [maxQuality, setMaxQuality] = useState<number>(90);
  const [renameToCompressed, setRenameToCompressed] = useState(true);

  useMemo(() => {
    (async () => {
      const w = await supportsEncoding("image/webp");
      setWebpSupported(w);
      if (!w) setOutType("image/jpeg");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const allowed = acceptedFiles.filter(
        (f) =>
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

      const newItems: ImgItem[] = allowed.map((file) => ({
        id: safeId(),
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
      }));

      setItems((prev) => [...prev, ...newItems]);

      try {
        for (const it of newItems) {
          const img = await loadImageFromFile(it.file);
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, width: img.width, height: img.height } : p)));
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

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  const clearAll = () => {
    items.forEach((it) => {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    });
    setItems([]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      if (found?.outUrl) URL.revokeObjectURL(found.outUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const compressAll = async () => {
    if (items.length === 0) return;

    if (outType === "image/webp" && !webpSupported) {
      toast({
        title: "WebP not supported here",
        description: "Switch output to JPG.",
        variant: "destructive",
      });
      return;
    }

    setCompressing(true);

    try {
      const updated: ImgItem[] = [];

      const targetBytes =
        presetId === "custom" ? Math.max(0, customTargetMB) * 1024 * 1024 : preset.targetBytes;

      const maxWidth = presetId === "custom" ? Math.max(320, customMaxWidth) : preset.maxWidth ?? 1600;

      const minQ = clamp(minQuality / 100, 0.1, 0.95);
      const maxQ = clamp(maxQuality / 100, minQ, 0.98);

      for (const it of items) {
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);

        const img = await loadImageFromFile(it.file);
        const origW = img.width;
        const origH = img.height;

        const { blob, w, h, q } = await compressToTarget({
          img,
          outType,
          origW,
          origH,
          maxWidth,
          targetBytes: targetBytes && targetBytes > 0 ? targetBytes : undefined,
          minQ,
          maxQ,
        });

        const base = it.name.replace(/\.[^.]+$/, "");
        const outExt = extFromMime(outType);
        const outName = renameToCompressed ? `${base}-compressed.${outExt}` : `${base}.${outExt}`;

        const outUrl = URL.createObjectURL(blob);

        updated.push({
          ...it,
          outUrl,
          outName,
          outType,
          outSize: blob.size,
          outWidth: w,
          outHeight: h,
          qualityUsed: Math.round(q * 100),
          outBlob: blob,
        });
      }

      setItems(updated);

      toast({
        title: "Compressed!",
        description: "Your compressed images are ready to download.",
      });
    } catch (e: any) {
      toast({
        title: "Compression failed",
        description: e?.message ? String(e.message) : "Something went wrong during compression.",
        variant: "destructive",
      });
    } finally {
      setCompressing(false);
    }
  };

  const downloadOne = (it: ImgItem) => {
    if (!it.outUrl || !it.outName) return;
    const a = document.createElement("a");
    a.href = it.outUrl;
    a.download = it.outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAll = () => {
    const ready = items.filter((x) => x.outUrl && x.outName);
    if (ready.length === 0) {
      toast({
        title: "Nothing to download",
        description: "Compress your images first.",
        variant: "destructive",
      });
      return;
    }
    ready.forEach(downloadOne);
  };

  const downloadZip = async () => {
    const ready = items.filter((x) => x.outBlob && x.outName);
    if (ready.length === 0) {
      toast({
        title: "Nothing to zip",
        description: "Compress your images first.",
        variant: "destructive",
      });
      return;
    }

    setZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder("compressed-images") ?? zip;

      for (const it of ready) {
        // Ensure unique names inside zip
        let name = it.outName!;
        if (folder.file(name)) {
          const base = name.replace(/\.[^.]+$/, "");
          const ext = name.split(".").pop()!;
          name = `${base}-${it.id.slice(-4)}.${ext}`;
        }
        folder.file(name, it.outBlob!);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `compressed-images-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({
        title: "ZIP ready!",
        description: "Downloaded a ZIP with all compressed images.",
      });
    } catch (e: any) {
      toast({
        title: "ZIP failed",
        description: e?.message ? String(e.message) : "Could not create ZIP.",
        variant: "destructive",
      });
    } finally {
      setZipping(false);
    }
  };

  return (
    <ToolLayout
      title="Image Compressor"
      description="Compress images for email, Instagram, LinkedIn, and web — private, fast, client-side."
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
              <p className="text-xs text-muted-foreground mt-3">JPG/PNG/WebP/AVIF supported</p>
            </div>
          </Card>

          {/* Settings */}
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select value={presetId} onValueChange={(v) => setPresetId(v as PresetId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset" />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{preset.description}</p>
            </div>

            <div className="space-y-2">
              <Label>Output format</Label>
              <Select value={outType} onValueChange={(v) => setOutType(v as MimeOut)}>
                <SelectTrigger>
                  <SelectValue placeholder="Output format" />
                </SelectTrigger>
                <SelectContent>
                  {webpSupported && <SelectItem value="image/webp">WebP (smaller)</SelectItem>}
                  <SelectItem value="image/jpeg">JPG (compatible)</SelectItem>
                </SelectContent>
              </Select>
              {!webpSupported && (
                <p className="text-xs text-muted-foreground">WebP encoding not supported in this browser.</p>
              )}
            </div>

            {/* Custom options */}
            {presetId === "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target size (MB)</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={customTargetMB}
                    onChange={(e) => setCustomTargetMB(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max width (px)</Label>
                  <Input
                    type="number"
                    min={320}
                    step={10}
                    value={customMaxWidth}
                    onChange={(e) => setCustomMaxWidth(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Min quality (%)</Label>
                <Input
                  type="number"
                  min={10}
                  max={95}
                  step={1}
                  value={minQuality}
                  onChange={(e) => setMinQuality(clamp(Number(e.target.value), 10, 95))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max quality (%)</Label>
                <Input
                  type="number"
                  min={10}
                  max={98}
                  step={1}
                  value={maxQuality}
                  onChange={(e) => setMaxQuality(clamp(Number(e.target.value), 10, 98))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Rename with “-compressed”</Label>
                <p className="text-xs text-muted-foreground">Keeps originals untouched</p>
              </div>
              <Switch checked={renameToCompressed} onCheckedChange={setRenameToCompressed} />
            </div>
          </Card>

          {/* Actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={compressAll} disabled={items.length === 0 || compressing} className="w-full" size="lg">
              {compressing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Compressing...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Compress
                </>
              )}
            </Button>

            <Button
              onClick={downloadAll}
              disabled={items.every((x) => !x.outUrl)}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Download all
            </Button>
          </div>

          <Button
            onClick={downloadZip}
            disabled={items.every((x) => !x.outBlob) || zipping}
            className="w-full"
            size="lg"
            variant="outline"
          >
            {zipping ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating ZIP...
              </>
            ) : (
              <>
                <FileArchive className="h-4 w-4 mr-2" />
                Download ZIP
              </>
            )}
          </Button>

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
                          {it.outSize ? ` → ${formatBytes(it.outSize)}` : ""}
                          {it.outWidth && it.outHeight ? ` • ${it.outWidth}×${it.outHeight}` : ""}
                          {it.qualityUsed ? ` • q${it.qualityUsed}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {it.outUrl && it.outName ? (
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
                <span>Upload images (bulk supported)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Pick a preset (Email / Instagram / LinkedIn / Web)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Compress, then download individually or as a ZIP</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• WebP usually gives the smallest size (if supported).</li>
              <li>• PNG → JPG/WebP will remove transparency.</li>
              <li>• ZIP is created locally in your browser.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
