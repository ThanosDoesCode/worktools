import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import imageCompression from "browser-image-compression";
import { zipSync } from "fflate";

interface ImgItem {
  id: string;
  file: File;
  name: string;
  size: number;
  out?: Blob;
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

type OutFormat = "keep" | "jpeg" | "webp";

export default function ImageCompressor() {
  const [items, setItems] = useState<ImgItem[]>([]);
  const [working, setWorking] = useState(false);

  const [maxWidthOrHeight, setMaxWidthOrHeight] = useState(1920);
  const [quality, setQuality] = useState(0.75);
  const [format, setFormat] = useState<OutFormat>("keep");

  const { toast } = useToast();

  const totalIn = useMemo(() => items.reduce((a, b) => a + b.size, 0), [items]);
  const totalOut = useMemo(
    () => items.reduce((a, b) => a + (b.out ? b.out.size : 0), 0),
    [items]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const imgs = accepted.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) {
        toast({ title: "Upload images", description: "JPG/PNG/WebP supported.", variant: "destructive" });
        return;
      }
      const newItems: ImgItem[] = imgs.map((f) => ({ id: safeId(), file: f, name: f.name, size: f.size }));
      setItems((prev) => [...prev, ...newItems]);
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 100,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
  });

  const clearAll = () => setItems([]);
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const compressAll = async () => {
    if (items.length === 0) return;

    setWorking(true);
    try {
      const updated: ImgItem[] = [];

      for (const it of items) {
        const options: any = {
          maxWidthOrHeight,
          initialQuality: quality,
          useWebWorker: true,
        };

        // browser-image-compression outputs same file type by default.
        // For format conversion, we do a second step via canvas.
        const compressedFile = await imageCompression(it.file, options);

        let outBlob: Blob = compressedFile;

        if (format !== "keep") {
          const bitmap = await createImageBitmap(compressedFile);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported");
          ctx.drawImage(bitmap, 0, 0);

          const mime = format === "jpeg" ? "image/jpeg" : "image/webp";
          outBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))),
              mime,
              quality
            );
          });
        }

        updated.push({ ...it, out: outBlob });
      }

      setItems(updated);
      toast({ title: "Done", description: "Images compressed. Download individually or as ZIP." });
    } catch (e: any) {
      toast({
        title: "Compression failed",
        description: e?.message ? String(e.message) : "Something went wrong compressing images.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const downloadOne = (it: ImgItem) => {
    if (!it.out) return;
    const url = URL.createObjectURL(it.out);
    const a = document.createElement("a");
    a.href = url;

    const ext =
      format === "jpeg" ? "jpg" : format === "webp" ? "webp" : it.name.split(".").pop() || "img";

    const base = it.name.replace(/\.[^/.]+$/, "");
    a.download = `${base}-compressed.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const downloadZip = async () => {
    const ready = items.filter((i) => i.out);
    if (ready.length === 0) {
      toast({ title: "Nothing to zip", description: "Compress images first.", variant: "destructive" });
      return;
    }

    const entries: Record<string, Uint8Array> = {};
    for (const it of ready) {
      const buf = await it.out!.arrayBuffer();
      const ext =
        format === "jpeg" ? "jpg" : format === "webp" ? "webp" : it.name.split(".").pop() || "img";
      const base = it.name.replace(/\.[^/.]+$/, "");
      entries[`${base}-compressed.${ext}`] = new Uint8Array(buf);
    }

    const zipped = zipSync(entries, { level: 6 });
    const blob = new Blob([zipped], { type: "application/zip" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `images-compressed-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <ToolLayout title="Image Compressor" description="Compress JPG/PNG/WebP images — client-side, private.">
      <div className="grid lg:grid-cols-2 gap-8">
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
            </div>
          </Card>

          {items.length > 0 && (
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  In: <b className="text-foreground">{formatBytes(totalIn)}</b>{" "}
                  {totalOut > 0 && (
                    <>
                      • Out: <b className="text-foreground">{formatBytes(totalOut)}</b>
                    </>
                  )}
                </div>
                <Button variant="ghost" onClick={clearAll} className="h-8 px-2" disabled={working}>
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Max dimension</div>
                  <input
                    type="number"
                    min={256}
                    max={8000}
                    value={maxWidthOrHeight}
                    onChange={(e) => setMaxWidthOrHeight(Number(e.target.value))}
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    disabled={working}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Output format</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutFormat)}
                    disabled={working}
                  >
                    <option value="keep">Keep original</option>
                    <option value="jpeg">JPG</option>
                    <option value="webp">WebP</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Quality</span>
                  <span className="text-muted-foreground">{quality.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.95"
                  step="0.01"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  disabled={working}
                  className="w-full"
                />
              </div>

              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          In {formatBytes(it.size)}
                          {it.out ? ` • Out ${formatBytes(it.out.size)}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => remove(it.id)} disabled={working}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => downloadOne(it)} disabled={!it.out || working}>
                        <Download className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                <Button onClick={compressAll} disabled={working}>
                  {working ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Compressing...
                    </>
                  ) : (
                    "Compress images"
                  )}
                </Button>
                <Button variant="secondary" onClick={downloadZip} disabled={working || items.every((i) => !i.out)}>
                  Download all as ZIP
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Tips</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• For web: max 1920 and quality 0.7–0.8</li>
              <li>• For very small: max 1280 and quality ~0.6</li>
              <li>• WebP is usually smaller than JPG</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
