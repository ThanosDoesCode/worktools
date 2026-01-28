import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";

import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Loader2, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Mode = "safe" | "strong";

type SizePreset = "none" | "10mb" | "5mb" | "2mb" | "1mb";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function blobFromCanvasJpg(canvas: HTMLCanvasElement, quality01: number): Promise<Blob> {
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality01);
  });
  if (!blob) throw new Error("Could not encode page as JPEG");
  return blob;
}

function toGrayscaleInPlace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
    d[i] = y;
    d[i + 1] = y;
    d[i + 2] = y;
  }
  ctx.putImageData(imgData, 0, 0);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function presetTargetBytes(preset: SizePreset): number | null {
  switch (preset) {
    case "10mb":
      return 10 * 1024 * 1024;
    case "5mb":
      return 5 * 1024 * 1024;
    case "2mb":
      return 2 * 1024 * 1024;
    case "1mb":
      return 1 * 1024 * 1024;
    default:
      return null;
  }
}

function presetToLabel(p: SizePreset) {
  switch (p) {
    case "10mb":
      return "< 10 MB (email-friendly)";
    case "5mb":
      return "< 5 MB (strict)";
    case "2mb":
      return "< 2 MB (small)";
    case "1mb":
      return "< 1 MB (tiny)";
    default:
      return "No target";
  }
}

function estimateStartFromTarget(targetBytes: number, origBytes: number) {
  // Rough starting guess: bigger reduction => lower DPI/quality.
  const ratio = clamp(targetBytes / Math.max(1, origBytes), 0.05, 0.95);
  // Heuristic mapping
  const dpi = Math.round(clamp(72 + ratio * 168, 72, 240)); // ratio 0.05 -> ~81 dpi, 0.95 -> ~232 dpi
  const jpgQuality = Math.round(clamp(40 + ratio * 55, 40, 95)); // ratio 0.05 -> ~43, 0.95 -> ~92
  const grayscale = ratio < 0.35;
  return { dpi, jpgQuality, grayscale };
}

export default function CompressPDF() {
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string>("");
  const [pages, setPages] = useState<number>(0);
  const [origBytes, setOrigBytes] = useState<number>(0);

  const [mode, setMode] = useState<Mode>("safe");

  // Strong mode controls
  const [dpi, setDpi] = useState<number>(144);
  const [jpgQuality, setJpgQuality] = useState<number>(75);
  const [grayscale, setGrayscale] = useState<boolean>(false);

  // Safe mode controls
  const [removeMetadata, setRemoveMetadata] = useState<boolean>(true);

  // Size target (best-effort)
  const [sizePreset, setSizePreset] = useState<SizePreset>("none");
  const [autoTune, setAutoTune] = useState<boolean>(true); // only meaningful in strong mode

  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState<string | null>(null);
  const [outBytes, setOutBytes] = useState<number | null>(null);

  const targetBytes = useMemo(() => presetTargetBytes(sizePreset), [sizePreset]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const f = accepted?.[0];
      if (!f) return;

      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!isPdf) {
        toast({
          title: "Upload a PDF only",
          description: "Supported: .pdf",
          variant: "destructive",
        });
        return;
      }

      if (outUrl) URL.revokeObjectURL(outUrl);
      setOutUrl(null);
      setOutName(null);
      setOutBytes(null);

      setFile(f);
      setFileId(safeId());
      setOrigBytes(f.size);

      // If a preset is chosen, pre-tune strong settings based on file size.
      if (sizePreset !== "none") {
        const t = presetTargetBytes(sizePreset);
        if (t) {
          const tuned = estimateStartFromTarget(t, f.size);
          setDpi(tuned.dpi);
          setJpgQuality(tuned.jpgQuality);
          setGrayscale(tuned.grayscale);
        }
      }

      try {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        setPages(pdf.numPages);
      } catch {
        setPages(0);
      }
    },
    [toast, outUrl, sizePreset],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "application/pdf": [".pdf"] },
  });

  const clear = () => {
    if (outUrl) URL.revokeObjectURL(outUrl);
    setOutUrl(null);
    setOutName(null);
    setOutBytes(null);
    setFile(null);
    setFileId("");
    setPages(0);
    setOrigBytes(0);
    setProgress(null);
  };

  const applyPresetTuningIfNeeded = () => {
    if (!file) return;
    if (!targetBytes) return;
    if (mode !== "strong") return;
    if (!autoTune) return;

    const tuned = estimateStartFromTarget(targetBytes, origBytes || file.size);
    setDpi(tuned.dpi);
    setJpgQuality(tuned.jpgQuality);
    setGrayscale(tuned.grayscale);
  };

  const compressStrongOnce = async (
    buf: ArrayBuffer,
    baseNameNoExt: string,
    dpiNow: number,
    qualityNow: number,
    grayscaleNow: boolean,
  ) => {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const numPages = pdf.numPages;

    setProgress({ current: 0, total: numPages });

    const outPdf = await PDFDocument.create();

    const scale = clamp(dpiNow / 72, 0.5, 4);
    const q01 = clamp(qualityNow / 100, 0.4, 0.95);

    for (let p = 1; p <= numPages; p++) {
      setProgress({ current: p, total: numPages });

      const page = await pdf.getPage(p);
      const viewport1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      await page.render({ canvasContext: ctx as any, viewport }).promise;

      if (grayscaleNow) {
        toGrayscaleInPlace(ctx, canvas.width, canvas.height);
      }

      const jpgBlob = await blobFromCanvasJpg(canvas, q01);
      const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());

      const newPage = outPdf.addPage([viewport1.width, viewport1.height]);
      const jpg = await outPdf.embedJpg(jpgBytes);

      newPage.drawImage(jpg, {
        x: 0,
        y: 0,
        width: viewport1.width,
        height: viewport1.height,
      });
    }

    const outBytesArr = await outPdf.save({ useObjectStreams: true });
    const outBlob = new Blob([new Uint8Array(outBytesArr)], { type: "application/pdf" });
    const url = URL.createObjectURL(outBlob);

    return {
      url,
      blob: outBlob,
      bytes: outBlob.size,
      name: `${baseNameNoExt}-compressed.pdf`,
      used: { dpi: dpiNow, jpgQuality: qualityNow, grayscale: grayscaleNow },
    };
  };

  const compress = async () => {
    if (!file) return;

    setWorking(true);
    setProgress(null);

    try {
      const base = file.name.replace(/\.pdf$/i, "");
      const buf = await file.arrayBuffer();

      if (mode === "safe") {
        const pdfDoc = await PDFDocument.load(buf, { updateMetadata: true });

        if (removeMetadata) {
          pdfDoc.setTitle("");
          pdfDoc.setAuthor("");
          pdfDoc.setSubject("");
          pdfDoc.setKeywords([]);
          pdfDoc.setProducer("");
          pdfDoc.setCreator("");
        }

        // Note: Safe mode cannot guarantee size targets because we keep original structure.
        const bytes = await pdfDoc.save({ useObjectStreams: true });
        const outBlob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
        const url = URL.createObjectURL(outBlob);

        if (outUrl) URL.revokeObjectURL(outUrl);
        setOutUrl(url);
        setOutName(`${base}-optimized.pdf`);
        setOutBytes(outBlob.size);

        if (targetBytes && outBlob.size > targetBytes) {
          toast({
            title: "Optimized (but still above target)",
            description: `Safe Optimize keeps text selectable. Switch to Strong Compress to aim for ${presetToLabel(sizePreset)}.`,
          });
        } else {
          toast({
            title: "Optimized!",
            description: "Saved a clean, optimized PDF (text remains selectable).",
          });
        }

        return;
      }

      // Strong mode: best-effort meet target by iterating a few times.
      // We keep attempts low so users don’t wait forever.
      let attemptDpi = dpi;
      let attemptQuality = jpgQuality;
      let attemptGray = grayscale;

      if (targetBytes && autoTune) {
        const tuned = estimateStartFromTarget(targetBytes, origBytes || file.size);
        attemptDpi = tuned.dpi;
        attemptQuality = tuned.jpgQuality;
        attemptGray = tuned.grayscale;
      }

      let lastResult: {
        url: string;
        bytes: number;
        name: string;
        used: { dpi: number; jpgQuality: number; grayscale: boolean };
      } | null = null;

      const maxAttempts = targetBytes ? 3 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await compressStrongOnce(buf, base, attemptDpi, attemptQuality, attemptGray);

        // cleanup previous attempt blob URL if any
        if (lastResult?.url) URL.revokeObjectURL(lastResult.url);
        lastResult = { url: result.url, bytes: result.bytes, name: result.name, used: result.used };

        if (!targetBytes) break;

        if (result.bytes <= targetBytes) {
          // hit target
          break;
        }

        // Not small enough: make it more aggressive for next attempt
        // Lower DPI and quality, switch grayscale on for stricter targets.
        const overshootRatio = clamp(result.bytes / targetBytes, 1.05, 6);
        attemptDpi = clamp(Math.round(attemptDpi / Math.min(overshootRatio, 2.0)), 72, 240);
        attemptQuality = clamp(Math.round(attemptQuality - 10 - (overshootRatio > 2 ? 10 : 0)), 40, 95);
        attemptGray = true;
      }

      if (!lastResult) throw new Error("Compression failed");

      if (outUrl) URL.revokeObjectURL(outUrl);

      setOutUrl(lastResult.url);
      setOutName(lastResult.name);
      setOutBytes(lastResult.bytes);

      // Sync UI sliders to what we used (so user sees final settings)
      setDpi(lastResult.used.dpi);
      setJpgQuality(lastResult.used.jpgQuality);
      setGrayscale(lastResult.used.grayscale);

      if (targetBytes && lastResult.bytes > targetBytes) {
        toast({
          title: "Compressed (best-effort)",
          description: `Couldn’t reach ${presetToLabel(sizePreset)} without going too extreme. Try lower DPI/quality.`,
        });
      } else if (targetBytes) {
        toast({
          title: "Compressed to target!",
          description: `Reached ${presetToLabel(sizePreset)} (best-effort).`,
        });
      } else {
        toast({
          title: "Compressed!",
          description: "Strong compression finished (pages flattened).",
        });
      }
    } catch (e: any) {
      toast({
        title: "Compression failed",
        description: e?.message ? String(e.message) : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
      setProgress(null);
    }
  };

  const download = () => {
    if (!outUrl || !outName) return;
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const savingsText = useMemo(() => {
    if (!outBytes || !origBytes) return null;
    const diff = outBytes - origBytes;
    const pct = Math.round((diff / origBytes) * 100);
    const sign = diff < 0 ? "−" : "+";
    return `${sign}${Math.abs(pct)}%`;
  }, [outBytes, origBytes]);

  const targetHint = useMemo(() => {
    if (!targetBytes) return null;
    return `Target: ${presetToLabel(sizePreset)}`;
  }, [targetBytes, sizePreset]);

  return (
    <ToolLayout
      title="Compress PDF"
      description="Compress PDFs in your browser — private, fast, no uploads. Choose Safe Optimize (keeps text) or Strong Compress (maximum size)."
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
              <p className="text-lg font-medium">Drop a PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">PDF processed locally in your browser</p>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Compression mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">Safe Optimize (keeps text selectable)</SelectItem>
                  <SelectItem value="strong">Strong Compress (maximum size reduction)</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                {mode === "safe"
                  ? "Best when you need selectable text and clean optimization."
                  : "Best when you need the smallest file — text becomes flattened (like a scan)."}
              </p>
            </div>

            {/* Size presets (best-effort) */}
            <div className="space-y-2">
              <Label>Size target (best-effort)</Label>
              <Select
                value={sizePreset}
                onValueChange={(v) => {
                  const preset = v as SizePreset;
                  setSizePreset(preset);
                  // If user chooses a target while in strong mode, auto-tune immediately
                  if (file && mode === "strong") {
                    const t = presetTargetBytes(preset);
                    if (t) {
                      const tuned = estimateStartFromTarget(t, origBytes || file.size);
                      setDpi(tuned.dpi);
                      setJpgQuality(tuned.jpgQuality);
                      setGrayscale(tuned.grayscale);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No target</SelectItem>
                  <SelectItem value="10mb">&lt; 10 MB (email-friendly)</SelectItem>
                  <SelectItem value="5mb">&lt; 5 MB (strict)</SelectItem>
                  <SelectItem value="2mb">&lt; 2 MB (small)</SelectItem>
                  <SelectItem value="1mb">&lt; 1 MB (tiny)</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                Works best in <span className="font-medium text-foreground">Strong Compress</span>. Safe Optimize can’t
                reliably hit exact sizes.
              </p>

              {mode === "strong" && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label>Auto-tune for target</Label>
                    <p className="text-xs text-muted-foreground">Adjust DPI/quality automatically</p>
                  </div>
                  <Switch checked={autoTune} onCheckedChange={setAutoTune} disabled={sizePreset === "none"} />
                </div>
              )}

              {mode === "strong" && sizePreset !== "none" && autoTune && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!file || working}
                  onClick={applyPresetTuningIfNeeded}
                  className="w-full"
                >
                  Apply auto-tune now
                </Button>
              )}
            </div>

            {mode === "safe" ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Remove metadata</Label>
                  <p className="text-xs text-muted-foreground">Title/author/producer fields</p>
                </div>
                <Switch checked={removeMetadata} onCheckedChange={setRemoveMetadata} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Resolution (DPI)</Label>
                    <span className="text-sm text-muted-foreground">{dpi}</span>
                  </div>
                  <Slider value={[dpi]} onValueChange={(v) => setDpi(v[0] ?? 144)} min={72} max={240} step={6} />
                  <p className="text-xs text-muted-foreground">Higher DPI = sharper but larger</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>JPEG quality</Label>
                    <span className="text-sm text-muted-foreground">{jpgQuality}%</span>
                  </div>
                  <Slider
                    value={[jpgQuality]}
                    onValueChange={(v) => setJpgQuality(v[0] ?? 75)}
                    min={40}
                    max={95}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Lower quality = smaller</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Grayscale</Label>
                    <p className="text-xs text-muted-foreground">Often reduces size for documents</p>
                  </div>
                  <Switch checked={grayscale} onCheckedChange={setGrayscale} />
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={compress} disabled={!file || working} className="w-full" size="lg">
              {working ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Compressing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Compress
                </>
              )}
            </Button>

            <Button onClick={download} disabled={!outUrl} variant="secondary" className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {file && (
            <Button variant="ghost" onClick={clear} className="w-full">
              Clear
            </Button>
          )}
        </div>

        {/* Right */}
        <div className="space-y-6">
          {file && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(origBytes)}
                    {pages ? ` • ${pages} page${pages === 1 ? "" : "s"}` : ""}
                    {targetHint ? ` • ${targetHint}` : ""}
                  </div>
                </div>

                <Button variant="ghost" size="icon" onClick={clear} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Processing page <span className="font-medium text-foreground">{progress.current}</span> /{" "}
                  <span className="font-medium text-foreground">{progress.total}</span>
                </div>
              )}

              {outBytes != null && (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Output size</span>
                    <span className="font-medium">{formatBytes(outBytes)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Change</span>
                    <span
                      className={`font-medium ${outBytes < origBytes ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                    >
                      {savingsText}
                    </span>
                  </div>

                  {targetBytes && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-muted-foreground">Target</span>
                      <span
                        className={`font-medium ${outBytes <= targetBytes ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                      >
                        {presetToLabel(sizePreset)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload a PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>
                  Pick a mode and (optional) a size target like{" "}
                  <span className="font-medium text-foreground">&lt;10MB</span>
                </span>
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
              <li>
                • Size targets are <span className="font-medium text-foreground">best-effort</span> (PDFs vary a lot).
              </li>
              <li>• Safe Optimize keeps text selectable but may not reach strict targets.</li>
              <li>• Strong Compress flattens pages (text won’t be selectable/searchable) but can shrink more.</li>
              <li>• If you need the smallest file, reduce DPI and JPEG quality and enable grayscale.</li>
              <li>• No files are uploaded anywhere.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
