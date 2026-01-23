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
    // luminance
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
    d[i] = y;
    d[i + 1] = y;
    d[i + 2] = y;
  }
  ctx.putImageData(imgData, 0, 0);
}

export default function CompressPDF() {
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string>("");
  const [pages, setPages] = useState<number>(0);
  const [origBytes, setOrigBytes] = useState<number>(0);

  const [mode, setMode] = useState<Mode>("safe");

  // Strong mode controls
  const [dpi, setDpi] = useState<number>(144); // good default
  const [jpgQuality, setJpgQuality] = useState<number>(75);
  const [grayscale, setGrayscale] = useState<boolean>(false);

  // Safe mode controls
  const [removeMetadata, setRemoveMetadata] = useState<boolean>(true);

  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState<string | null>(null);
  const [outBytes, setOutBytes] = useState<number | null>(null);

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

      // Read page count via pdfjs
      try {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        setPages(pdf.numPages);
      } catch {
        setPages(0);
      }
    },
    [toast, outUrl],
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

  const compress = async () => {
    if (!file) return;

    setWorking(true);
    setProgress(null);

    try {
      const base = file.name.replace(/\.pdf$/i, "");
      const buf = await file.arrayBuffer();

      if (mode === "safe") {
        // SAFE: keep text selectable — best-effort save optimization
        const pdfDoc = await PDFDocument.load(buf, { updateMetadata: true });

        if (removeMetadata) {
          // wipe common metadata fields
          pdfDoc.setTitle("");
          pdfDoc.setAuthor("");
          pdfDoc.setSubject("");
          pdfDoc.setKeywords([]);
          pdfDoc.setProducer("");
          pdfDoc.setCreator("");
        }

        const bytes = await pdfDoc.save({
          useObjectStreams: true,
          // pdf-lib compresses streams by default
        });

        const outBlob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(outBlob);

        if (outUrl) URL.revokeObjectURL(outUrl);
        setOutUrl(url);
        setOutName(`${base}-optimized.pdf`);
        setOutBytes(outBlob.size);

        toast({
          title: "Optimized!",
          description: "Saved a clean, optimized PDF (text remains selectable).",
        });

        return;
      }

      // STRONG: flatten pages to images (max compression)
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const numPages = pdf.numPages;

      setProgress({ current: 0, total: numPages });

      const outPdf = await PDFDocument.create();

      // pdf points are 72 DPI
      const scale = Math.max(0.5, Math.min(4, dpi / 72));
      const q01 = Math.max(0.4, Math.min(0.95, jpgQuality / 100));

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

        // Render PDF page into canvas
        await page.render({
          canvasContext: ctx as any,
          viewport,
        }).promise;

        if (grayscale) {
          toGrayscaleInPlace(ctx, canvas.width, canvas.height);
        }

        // Encode to JPEG
        const jpgBlob = await blobFromCanvasJpg(canvas, q01);
        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());

        // Create page in new PDF with original size (in points)
        const newPage = outPdf.addPage([viewport1.width, viewport1.height]);
        const jpg = await outPdf.embedJpg(jpgBytes);

        // Draw image to fit page exactly
        newPage.drawImage(jpg, {
          x: 0,
          y: 0,
          width: viewport1.width,
          height: viewport1.height,
        });
      }

      const outBytesArr = await outPdf.save({ useObjectStreams: true });
      const outBlob = new Blob([outBytesArr], { type: "application/pdf" });

      const url = URL.createObjectURL(outBlob);
      if (outUrl) URL.revokeObjectURL(outUrl);

      setOutUrl(url);
      setOutName(`${base}-compressed.pdf`);
      setOutBytes(outBlob.size);

      toast({
        title: "Compressed!",
        description: "Strong compression finished (pages flattened).",
      });
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
                  Choose <span className="font-medium text-foreground">Safe Optimize</span> (keeps text) or{" "}
                  <span className="font-medium text-foreground">Strong Compress</span> (smallest file)
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
              <li>• Safe Optimize keeps text selectable and is best-effort size reduction.</li>
              <li>• Strong Compress flattens pages (text won’t be selectable/searchable) but can shrink more.</li>
              <li>• Higher DPI and higher quality produce larger files.</li>
              <li>• Grayscale often reduces size for document-style PDFs.</li>
              <li>• No files are uploaded anywhere.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
