import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import heic2any from "heic2any";

import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Download, Loader2, Wand2, FileArchive, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Moat layer (adjust paths if your project differs) */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

type MimeOut = "image/jpeg" | "image/webp" | "image/avif";
type PresetId = "email-1mb" | "email-5mb" | "instagram-post" | "instagram-story" | "linkedin" | "website" | "custom";

type BgMode = "white" | "black" | "custom";

interface ImgItem {
  id: string;

  originalFile: File;
  workingFile: File;

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
  outBlob?: Blob;
}

type Preset = {
  id: PresetId;
  name: string;
  description: string;
  targetBytes?: number; // per-image target
  maxWidth?: number;
};

const PRESETS: Preset[] = [
  {
    id: "email-1mb",
    name: "Email (≤ 1MB each)",
    description: "Great for fast attachments",
    targetBytes: 1 * 1024 * 1024,
    maxWidth: 1600,
  },
  {
    id: "email-5mb",
    name: "Email (≤ 5MB each)",
    description: "Safer for bigger images",
    targetBytes: 5 * 1024 * 1024,
    maxWidth: 2400,
  },
  {
    id: "instagram-post",
    name: "Instagram Post (1080px)",
    description: "Feeds nicely at 1080px width",
    targetBytes: 900 * 1024,
    maxWidth: 1080,
  },
  {
    id: "instagram-story",
    name: "Instagram Story/Reel (1080px)",
    description: "Fits story width (no crop)",
    targetBytes: 1200 * 1024,
    maxWidth: 1080,
  },
  {
    id: "linkedin",
    name: "LinkedIn Post (1200px)",
    description: "Sharp for LinkedIn feed",
    targetBytes: 1200 * 1024,
    maxWidth: 1200,
  },
  {
    id: "website",
    name: "Website (1600px)",
    description: "Good for blogs/hero images",
    targetBytes: 1600 * 1024,
    maxWidth: 1600,
  },
  { id: "custom", name: "Custom", description: "Pick your own size + quality + target", maxWidth: 1600 },
];

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

function extFromMime(m: MimeOut) {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/webp") return "webp";
  return "avif";
}

function isHeicLike(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

function isSvgLike(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/svg+xml" || name.endsWith(".svg");
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

async function canvasEncode(params: {
  img: HTMLImageElement;
  outType: MimeOut;
  width: number;
  height: number;
  quality01: number;
  jpgBgMode: BgMode;
  jpgBgCustom: string;
}): Promise<Blob> {
  const { img, outType, width, height, quality01, jpgBgMode, jpgBgCustom } = params;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  if (outType === "image/jpeg") {
    const bg = jpgBgMode === "white" ? "#ffffff" : jpgBgMode === "black" ? "#000000" : jpgBgCustom || "#ffffff";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      outType,
      outType === "image/jpeg" || outType === "image/webp" || outType === "image/avif" ? quality01 : undefined,
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
  minQ: number;
  maxQ: number;
  jpgBgMode: BgMode;
  jpgBgCustom: string;
}): Promise<{ blob: Blob; w: number; h: number; q: number }> {
  const { img, outType, origW, origH, maxWidth, targetBytes, minQ, maxQ, jpgBgMode, jpgBgCustom } = params;

  const aspect = origH / origW;
  let w = Math.min(origW, maxWidth);
  let h = Math.round(w * aspect);

  const encodeAt = async (q: number) =>
    canvasEncode({ img, outType, width: w, height: h, quality01: q, jpgBgMode, jpgBgCustom });

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

    if (bestBlob) return { blob: bestBlob, w, h, q: bestQ };

    w = Math.max(320, Math.round(w * 0.85));
    h = Math.round(w * aspect);

    if (w <= 340) {
      const blob = await canvasEncode({
        img,
        outType,
        width: w,
        height: h,
        quality01: minQ,
        jpgBgMode,
        jpgBgCustom,
      });
      return { blob, w, h, q: minQ };
    }
  }

  const blob = await canvasEncode({
    img,
    outType,
    width: w,
    height: h,
    quality01: minQ,
    jpgBgMode,
    jpgBgCustom,
  });

  return { blob, w, h, q: minQ };
}

function allocateBudgets(params: {
  items: ImgItem[];
  totalBytes: number;
  minPerImageBytes: number;
  perImageCapBytes?: number;
}): number[] {
  const { items, totalBytes, minPerImageBytes, perImageCapBytes } = params;

  const n = items.length;
  if (n === 0) return [];

  const minTotal = n * minPerImageBytes;
  const effectiveTotal = Math.max(minTotal, totalBytes);

  const totalWeight = items.reduce((acc, it) => acc + Math.max(1, it.size), 0);
  let budgets = items.map((it) => (effectiveTotal * Math.max(1, it.size)) / totalWeight);

  budgets = budgets.map((b) => clamp(b, minPerImageBytes, perImageCapBytes ?? Number.POSITIVE_INFINITY));

  const sum = budgets.reduce((a, b) => a + b, 0);
  if (sum <= totalBytes) return budgets;

  const fixedMin = n * minPerImageBytes;
  const remaining = Math.max(0, totalBytes - fixedMin);
  const variable = budgets.map((b) => Math.max(0, b - minPerImageBytes));
  const varSum = variable.reduce((a, b) => a + b, 0) || 1;

  return budgets.map((b, i) => minPerImageBytes + (variable[i] / varSum) * remaining);
}

/** -----------------------------
 *  MOAT SETTINGS (what we store/share)
 *  - We do NOT store uploaded files.
 *  - Only store knobs the user cares about.
 * ------------------------------ */
type CompressorSettings = {
  presetId: PresetId;
  outType: MimeOut;

  jpgBgMode: BgMode;
  jpgBgCustom: string;

  customTargetMB: number;
  customMaxWidth: number;

  minQuality: number;
  maxQuality: number;

  renameToCompressed: boolean;

  fitTotalLimit: boolean;
  totalLimitMB: number;
};

const DEFAULT_SETTINGS: CompressorSettings = {
  presetId: "email-1mb",
  outType: "image/webp",

  jpgBgMode: "white",
  jpgBgCustom: "#ffffff",

  customTargetMB: 1,
  customMaxWidth: 1600,

  minQuality: 55,
  maxQuality: 90,

  renameToCompressed: true,

  fitTotalLimit: false,
  totalLimitMB: 10,
};

const RECOMMENDED_MOAT_PRESETS = [
  {
    name: "Email safe (1MB, ZIP)",
    settings: {
      ...DEFAULT_SETTINGS,
      presetId: "email-1mb",
      outType: "image/jpeg",
      fitTotalLimit: true,
      totalLimitMB: 10,
      minQuality: 50,
      maxQuality: 85,
      renameToCompressed: true,
      jpgBgMode: "white",
    } satisfies CompressorSettings,
  },
  {
    name: "Instagram post (1080 WebP)",
    settings: {
      ...DEFAULT_SETTINGS,
      presetId: "instagram-post",
      outType: "image/webp",
      minQuality: 60,
      maxQuality: 90,
      fitTotalLimit: false,
    } satisfies CompressorSettings,
  },
  {
    name: "Instagram story (1080 WebP)",
    settings: {
      ...DEFAULT_SETTINGS,
      presetId: "instagram-story",
      outType: "image/webp",
      minQuality: 60,
      maxQuality: 90,
      fitTotalLimit: false,
    } satisfies CompressorSettings,
  },
  {
    name: "LinkedIn (1200 JPG)",
    settings: {
      ...DEFAULT_SETTINGS,
      presetId: "linkedin",
      outType: "image/jpeg",
      minQuality: 55,
      maxQuality: 88,
      jpgBgMode: "white",
      fitTotalLimit: false,
    } satisfies CompressorSettings,
  },
  {
    name: "Website (1600 WebP)",
    settings: {
      ...DEFAULT_SETTINGS,
      presetId: "website",
      outType: "image/webp",
      minQuality: 60,
      maxQuality: 92,
      fitTotalLimit: false,
    } satisfies CompressorSettings,
  },
] as const;

export default function ImageCompressor() {
  const { toast } = useToast();

  /** Files (NOT in moat) */
  const [items, setItems] = useState<ImgItem[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [zipping, setZipping] = useState(false);

  /** Moat-managed settings */
  const toolSlug = "image-compressor";
  const [settings, setSettings] = useState<CompressorSettings>(DEFAULT_SETTINGS);
  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as CompressorSettings);

  const moat = useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_MOAT_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  /** Derived from settings */
  const presetId = settings.presetId;
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);
  const outType = settings.outType;

  const [webpSupported, setWebpSupported] = useState(true);
  const [avifSupported, setAvifSupported] = useState(false);

  useEffect(() => {
    (async () => {
      const w = await supportsEncoding("image/webp");
      const a = await supportsEncoding("image/avif");
      setWebpSupported(w);
      setAvifSupported(a);

      // if current outType becomes unsupported, fall back
      setSettings((prev) => {
        if (!w && prev.outType === "image/webp") return { ...prev, outType: "image/jpeg" };
        if (!a && prev.outType === "image/avif") return { ...prev, outType: w ? "image/webp" : "image/jpeg" };
        return prev;
      });
    })();
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
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

        if (isHeicLike(file)) {
          try {
            const converted = await heic2any({
              blob: file,
              toType: "image/png",
              quality: 0.92,
            });
            const blob = Array.isArray(converted) ? converted[0] : converted;
            const base = file.name.replace(/\.[^.]+$/, "");
            workingFile = new File([blob], `${base}.png`, { type: "image/png" });
          } catch {
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

      // Try to read dimensions (best-effort)
      try {
        for (const it of newItems) {
          let img: HTMLImageElement;
          try {
            img = await loadImageFromFile(it.workingFile);
          } catch {
            if (isSvgLike(it.workingFile)) {
              const svgText = await it.workingFile.text();
              const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
              img = await loadImageFromBlob(svgBlob);
            } else {
              throw new Error();
            }
          }

          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, width: img.width, height: img.height } : p)));
        }
      } catch {
        // ignore
      }
    },
    [toast],
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

    if (settings.outType === "image/webp" && !webpSupported) {
      toast({
        title: "WebP not supported here",
        description: "Switch output to JPG or AVIF.",
        variant: "destructive",
      });
      return;
    }
    if (settings.outType === "image/avif" && !avifSupported) {
      toast({
        title: "AVIF not supported here",
        description: "Switch output to WebP or JPG.",
        variant: "destructive",
      });
      return;
    }

    setCompressing(true);

    try {
      const perImageTargetBytes =
        settings.presetId === "custom" ? Math.max(0, settings.customTargetMB) * 1024 * 1024 : preset.targetBytes;

      const maxWidth =
        settings.presetId === "custom" ? Math.max(320, settings.customMaxWidth) : (preset.maxWidth ?? 1600);

      const minQ = clamp(settings.minQuality / 100, 0.1, 0.95);
      const maxQ = clamp(settings.maxQuality / 100, minQ, 0.98);

      const totalLimitBytes = Math.max(0.1, settings.totalLimitMB) * 1024 * 1024;
      const useTotal = settings.fitTotalLimit && items.length > 1;

      let budgets: number[] | null = null;
      if (useTotal) {
        budgets = allocateBudgets({
          items,
          totalBytes: totalLimitBytes,
          minPerImageBytes: 120 * 1024,
          perImageCapBytes: perImageTargetBytes,
        });
      }

      const MAX_PASSES = useTotal ? 3 : 1;

      let lastUpdated: ImgItem[] = items;
      let lastTotalOut = Number.POSITIVE_INFINITY;

      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const updated: ImgItem[] = [];

        for (let i = 0; i < lastUpdated.length; i++) {
          const it = lastUpdated[i];

          if (it.outUrl) URL.revokeObjectURL(it.outUrl);

          let img: HTMLImageElement;
          try {
            img = await loadImageFromFile(it.workingFile);
          } catch {
            if (isSvgLike(it.workingFile)) {
              const svgText = await it.workingFile.text();
              const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
              img = await loadImageFromBlob(svgBlob);
            } else {
              throw new Error(`Could not decode "${it.name}"`);
            }
          }

          const origW = img.width;
          const origH = img.height;

          const targetForThis = useTotal
            ? budgets![i]
            : perImageTargetBytes && perImageTargetBytes > 0
              ? perImageTargetBytes
              : undefined;

          const { blob, w, h, q } = await compressToTarget({
            img,
            outType: settings.outType,
            origW,
            origH,
            maxWidth,
            targetBytes: targetForThis,
            minQ,
            maxQ,
            jpgBgMode: settings.jpgBgMode,
            jpgBgCustom: settings.jpgBgCustom,
          });

          const base = it.name.replace(/\.[^.]+$/, "");
          const outExt = extFromMime(settings.outType);
          const outName = settings.renameToCompressed ? `${base}-compressed.${outExt}` : `${base}.${outExt}`;
          const outUrl = URL.createObjectURL(blob);

          updated.push({
            ...it,
            outUrl,
            outName,
            outType: settings.outType,
            outSize: blob.size,
            outWidth: w,
            outHeight: h,
            qualityUsed: Math.round(q * 100),
            outBlob: blob,
          });
        }

        const totalOut = updated.reduce((acc, it) => acc + (it.outSize ?? 0), 0);
        lastUpdated = updated;
        lastTotalOut = totalOut;

        if (!useTotal) break;
        if (totalOut <= totalLimitBytes) break;

        const ratio = (totalLimitBytes / totalOut) * 0.92;
        budgets = budgets!.map((b) => Math.max(90 * 1024, b * ratio));
      }

      setItems(lastUpdated);
      moat.recordJob();

      if (useTotal) {
        const totalLimitBytes2 = Math.max(0.1, settings.totalLimitMB) * 1024 * 1024;
        if (lastTotalOut <= totalLimitBytes2) {
          toast({
            title: "Compressed to total limit!",
            description: `All images fit under ${settings.totalLimitMB}MB total.`,
          });
        } else {
          toast({
            title: "Best-effort compression done",
            description:
              `Could not fully reach ${settings.totalLimitMB}MB total with current settings. ` +
              `Try lower Max quality or switch format.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Compressed!",
          description: "Your compressed images are ready to download.",
        });
      }
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
    moat.recordJob();
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
        title: "ZIP downloaded!",
        description: "A ZIP with all compressed images was created locally.",
      });

      moat.recordJob();
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

  const outTotal = useMemo(() => items.reduce((acc, it) => acc + (it.outSize ?? 0), 0), [items]);
  const outReady = items.some((it) => !!it.outBlob);

  const applyPresetId = (id: PresetId) => {
    setSettings((prev) => {
      // keep custom values, just change presetId
      const next = { ...prev, presetId: id };

      // if they choose a non-custom preset, it's safe to keep customTarget/maxWidth around
      // (used only when presetId === "custom")
      return next;
    });
  };

  const resetToDefaults = () => {
    // clear outputs but keep uploads (so reset feels safe)
    setItems((prev) => {
      prev.forEach((it) => {
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      });
      return prev.map((it) => ({
        ...it,
        outUrl: undefined,
        outBlob: undefined,
        outName: undefined,
        outSize: undefined,
      }));
    });

    setSettings(DEFAULT_SETTINGS);
    toast({ title: "Reset", description: "Settings reset. Uploads kept." });
    moat.recordJob();
  };

  return (
    <ToolLayout
      title="Image Compressor"
      description="Compress images for email, Instagram, LinkedIn, and web — private, fast."
    >
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

        {/* LEFT: UPLOAD + SETTINGS + ACTIONS */}
        <div className="order-1 lg:order-2 lg:col-span-1 space-y-6">
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
              <p className="text-xs text-muted-foreground mt-3">
                JPG/PNG/WebP/AVIF + HEIC/HEIF, BMP, SVG, ICO supported
              </p>
            </div>
          </Card>

          {/* Settings */}
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select value={settings.presetId} onValueChange={(v) => applyPresetId(v as PresetId)}>
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
              <Select
                value={settings.outType}
                onValueChange={(v) => setSettings((p) => ({ ...p, outType: v as MimeOut }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Output format" />
                </SelectTrigger>
                <SelectContent>
                  {webpSupported && <SelectItem value="image/webp">WebP (smaller)</SelectItem>}
                  {avifSupported && <SelectItem value="image/avif">AVIF (smallest)</SelectItem>}
                  <SelectItem value="image/jpeg">JPG (compatible)</SelectItem>
                </SelectContent>
              </Select>
              {!webpSupported && (
                <p className="text-xs text-muted-foreground">WebP encoding not supported in this browser.</p>
              )}
              {!avifSupported && (
                <p className="text-xs text-muted-foreground">AVIF encoding not supported in this browser.</p>
              )}
            </div>

            {settings.outType === "image/jpeg" && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="space-y-1">
                  <Label>JPG background (for transparent images)</Label>
                  <p className="text-xs text-muted-foreground">Prevents black backgrounds when compressing PNG/SVG</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 items-end">
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <Select
                      value={settings.jpgBgMode}
                      onValueChange={(v) => setSettings((p) => ({ ...p, jpgBgMode: v as BgMode }))}
                    >
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

                  {settings.jpgBgMode === "custom" && (
                    <div className="space-y-2">
                      <Label>Custom color</Label>
                      <Input
                        value={settings.jpgBgCustom}
                        onChange={(e) => setSettings((p) => ({ ...p, jpgBgCustom: e.target.value }))}
                        placeholder="#ffffff"
                      />
                      <p className="text-xs text-muted-foreground">Use hex like #ffffff</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total limit mode */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Fit ALL images into a total limit</Label>
                  <p className="text-xs text-muted-foreground">Best for email limits (example: 10MB total)</p>
                </div>
                <Switch
                  checked={settings.fitTotalLimit}
                  onCheckedChange={(v) => setSettings((p) => ({ ...p, fitTotalLimit: v }))}
                  disabled={items.length < 2}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 items-end">
                <div className="space-y-2">
                  <Label>Total limit (MB)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={settings.totalLimitMB}
                    onChange={(e) => setSettings((p) => ({ ...p, totalLimitMB: Math.max(1, Number(e.target.value)) }))}
                    disabled={!settings.fitTotalLimit}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {outReady ? (
                    <>
                      Current output total: <span className="font-medium text-foreground">{formatBytes(outTotal)}</span>
                    </>
                  ) : (
                    <>Upload 2+ images to enable</>
                  )}
                </div>
              </div>
            </div>

            {/* Custom options */}
            {settings.presetId === "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target size per image (MB)</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={settings.customTargetMB}
                    onChange={(e) => setSettings((p) => ({ ...p, customTargetMB: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max width (px)</Label>
                  <Input
                    type="number"
                    min={320}
                    step={10}
                    value={settings.customMaxWidth}
                    onChange={(e) => setSettings((p) => ({ ...p, customMaxWidth: Number(e.target.value) }))}
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
                  value={settings.minQuality}
                  onChange={(e) => setSettings((p) => ({ ...p, minQuality: clamp(Number(e.target.value), 10, 95) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max quality (%)</Label>
                <Input
                  type="number"
                  min={10}
                  max={98}
                  step={1}
                  value={settings.maxQuality}
                  onChange={(e) => setSettings((p) => ({ ...p, maxQuality: clamp(Number(e.target.value), 10, 98) }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Rename with “-compressed”</Label>
                <p className="text-xs text-muted-foreground">Keeps originals untouched</p>
              </div>
              <Switch
                checked={settings.renameToCompressed}
                onCheckedChange={(v) => setSettings((p) => ({ ...p, renameToCompressed: v }))}
              />
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

          <Button onClick={downloadZip} disabled={!outReady || zipping} className="w-full" size="lg" variant="outline">
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
            <div className="grid gap-2">
              <Button variant="ghost" onClick={clearAll} className="w-full">
                Clear uploads
              </Button>
              <Button variant="ghost" onClick={resetToDefaults} className="w-full">
                Reset settings
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT: LIST + HELP */}
        <div className="order-2 lg:order-3 lg:col-span-1 space-y-6">
          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{items.length}</span> image
                  {items.length === 1 ? "" : "s"} •{" "}
                  <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
                  {outReady && (
                    <>
                      {" "}
                      • output: <span className="font-medium text-foreground">{formatBytes(outTotal)}</span>
                    </>
                  )}
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
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            downloadOne(it);
                            moat.recordJob();
                          }}
                        >
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
                <span>Choose preset + output format + quality limits (optional total size limit)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Compress and download — runs locally in your browser</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• PNG/SVG can have transparency. JPG does not (choose a background above).</li>
              <li>• AVIF/WebP encoding depends on your browser.</li>
              <li>• HEIC/HEIF is decoded locally using a browser-side converter.</li>
              <li>• SVG is rasterized (converted to pixels) when compressing.</li>
              <li>• ZIP download stays client-side.</li>
              <li>• No files are uploaded anywhere.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
