import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Loader2, FileText, X, FileArchive, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Mode = "extract" | "single" | "chunk";

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

function baseName(name: string) {
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function zeroPad(n: number, width: number) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

/**
 * Parses ranges like:
 *  - "1-3, 6, 9-12"
 * Returns a list of inclusive [start,end] pairs (1-based).
 * Invalid tokens are ignored.
 */
function parsePageRanges(input: string, maxPages: number): Array<[number, number]> {
  const text = (input || "").trim();
  if (!text) return [];

  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const ranges: Array<[number, number]> = [];

  for (const token of parts) {
    if (/^\d+$/.test(token)) {
      const n = clamp(parseInt(token, 10), 1, maxPages);
      ranges.push([n, n]);
      continue;
    }
    const m = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = clamp(parseInt(m[1], 10), 1, maxPages);
      let b = clamp(parseInt(m[2], 10), 1, maxPages);
      if (a > b) [a, b] = [b, a];
      ranges.push([a, b]);
    }
  }

  // Merge overlaps to keep output stable
  ranges.sort((r1, r2) => r1[0] - r2[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last) merged.push(r);
    else if (r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }

  return merged;
}

/** Convert inclusive 1-based range pairs to a flat 0-based unique index list */
function rangesToIndices(ranges: Array<[number, number]>): number[] {
  const set = new Set<number>();
  for (const [a, b] of ranges) {
    for (let p = a; p <= b; p++) set.add(p - 1);
  }
  return Array.from(set).sort((x, y) => x - y);
}

/** Intersect indices with a limit range (inclusive 1-based) */
function applyLimit(indices: number[], limit: [number, number] | null): number[] {
  if (!limit) return indices;
  const [a, b] = limit;
  const lo = a - 1;
  const hi = b - 1;
  return indices.filter((i) => i >= lo && i <= hi);
}

export default function SplitPDF() {
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState("");
  const [origBytes, setOrigBytes] = useState(0);
  const [pageCount, setPageCount] = useState<number>(0);

  const [mode, setMode] = useState<Mode>("extract");

  // Extract mode
  const [extractRanges, setExtractRanges] = useState<string>("1-1");
  const [extractEachRangeAsSeparate, setExtractEachRangeAsSeparate] = useState<boolean>(false);

  // Chunk mode
  const [chunkSize, setChunkSize] = useState<number>(5);

  // Optional limit to a sub-range of document
  const [limitEnabled, setLimitEnabled] = useState<boolean>(false);
  const [limitRangeText, setLimitRangeText] = useState<string>("");

  // Naming
  const [prefix, setPrefix] = useState<string>("");
  const [padWidth, setPadWidth] = useState<number>(3);

  const [working, setWorking] = useState(false);

  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState<string | null>(null);
  const [outBytes, setOutBytes] = useState<number | null>(null);

  const clear = () => {
    if (outUrl) URL.revokeObjectURL(outUrl);
    setOutUrl(null);
    setOutName(null);
    setOutBytes(null);

    setFile(null);
    setFileKey("");
    setOrigBytes(0);
    setPageCount(0);
  };

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const f = accepted?.[0];
      if (!f) return;

      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!isPdf) {
        toast({ title: "Only PDFs supported", description: "Upload a .pdf file.", variant: "destructive" });
        return;
      }

      clear();

      setFile(f);
      setFileKey(safeId());
      setOrigBytes(f.size);

      try {
        const buf = await f.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        const n = doc.getPageCount();
        setPageCount(n);

        setPrefix(baseName(f.name));
        setExtractRanges(`1-${Math.min(3, n)}`);
      } catch (e: any) {
        setFile(null);
        setPageCount(0);
        toast({
          title: "Failed to read PDF",
          description: e?.message ? String(e.message) : "Could not open this PDF.",
          variant: "destructive",
        });
      }
    },
    [toast] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const limitRange = useMemo<[number, number] | null>(() => {
    if (!limitEnabled || !limitRangeText.trim() || !pageCount) return null;
    const ranges = parsePageRanges(limitRangeText, pageCount);
    if (ranges.length === 0) return null;
    // If user enters multiple ranges, we take the merged total span (simple + not messy)
    const a = ranges[0][0];
    const b = ranges[ranges.length - 1][1];
    return [a, b];
  }, [limitEnabled, limitRangeText, pageCount]);

  const canRun = useMemo(() => !!file && pageCount > 0 && !working, [file, pageCount, working]);

  const downloadSingleBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const splitNow = async () => {
    if (!file || pageCount <= 0) return;

    setWorking(true);

    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const n = src.getPageCount();

      const namePrefix = (prefix || baseName(file.name) || "split").trim();
      const pad = clamp(padWidth, 1, 6);

      const zip = new JSZip();

      if (mode === "extract") {
        const ranges = parsePageRanges(extractRanges, n);
        if (ranges.length === 0) {
          toast({
            title: "Invalid range",
            description: "Use formats like: 1-3, 6, 9-12",
            variant: "destructive",
          });
          return;
        }

        if (!extractEachRangeAsSeparate) {
          // Single output PDF containing all selected pages
          let indices = rangesToIndices(ranges);
          indices = applyLimit(indices, limitRange);

          if (indices.length === 0) {
            toast({
              title: "No pages selected",
              description: "Your selection results in 0 pages. Adjust the range/limit.",
              variant: "destructive",
            });
            return;
          }

          const out = await PDFDocument.create();
          const copied = await out.copyPages(src, indices);
          copied.forEach((p) => out.addPage(p));

          const outBytesArr = await out.save({ useObjectStreams: true });
          const outBlob = new Blob([new Uint8Array(outBytesArr)], { type: "application/pdf" });

          const outFileName = `${namePrefix}-extract.pdf`;
          if (outUrl) URL.revokeObjectURL(outUrl);
          const url = URL.createObjectURL(outBlob);
          setOutUrl(url);
          setOutName(outFileName);
          setOutBytes(outBlob.size);

          toast({ title: "Done!", description: "Extracted PDF is ready to download." });
          return;
        }

        // Each range becomes its own PDF (ZIP)
        let madeAny = false;

        for (let r = 0; r < ranges.length; r++) {
          const [a, b] = ranges[r];

          let indices = rangesToIndices([[a, b]]);
          indices = applyLimit(indices, limitRange);
          if (indices.length === 0) continue;

          const out = await PDFDocument.create();
          const copied = await out.copyPages(src, indices);
          copied.forEach((p) => out.addPage(p));

          const outBytesArr = await out.save({ useObjectStreams: true });
          const outBlob = new Blob([new Uint8Array(outBytesArr)], { type: "application/pdf" });

          const partName = `${namePrefix}-range-${zeroPad(r + 1, pad)}-p${a}-p${b}.pdf`;
          zip.file(partName, outBlob);
          madeAny = true;
        }

        if (!madeAny) {
          toast({
            title: "No output created",
            description: "Your selection/limit produced 0 pages.",
            variant: "destructive",
          });
          return;
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadSingleBlob(zipBlob, `${namePrefix}-ranges.zip`);
        toast({ title: "Done!", description: "ZIP downloaded with the split PDFs." });
        return;
      }

      if (mode === "single") {
        // One PDF per page (ZIP)
        const start = limitRange ? limitRange[0] : 1;
        const end = limitRange ? limitRange[1] : n;

        for (let p = start; p <= end; p++) {
          const out = await PDFDocument.create();
          const copied = await out.copyPages(src, [p - 1]);
          out.addPage(copied[0]);

          const outBytesArr = await out.save({ useObjectStreams: true });
          const outBlob = new Blob([new Uint8Array(outBytesArr)], { type: "application/pdf" });

          const fname = `${namePrefix}-page-${zeroPad(p, pad)}.pdf`;
          zip.file(fname, outBlob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadSingleBlob(zipBlob, `${namePrefix}-pages.zip`);
        toast({ title: "Done!", description: "ZIP downloaded with one PDF per page." });
        return;
      }

      // mode === "chunk"
      const step = clamp(chunkSize, 1, 500);
      const start = limitRange ? limitRange[0] : 1;
      const end = limitRange ? limitRange[1] : n;

      let chunkIndex = 1;
      for (let p = start; p <= end; p += step) {
        const a = p;
        const b = Math.min(end, p + step - 1);

        const indices: number[] = [];
        for (let i = a; i <= b; i++) indices.push(i - 1);

        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, indices);
        copied.forEach((pg) => out.addPage(pg));

        const outBytesArr = await out.save({ useObjectStreams: true });
        const outBlob = new Blob([new Uint8Array(outBytesArr)], { type: "application/pdf" });

        const fname = `${namePrefix}-chunk-${zeroPad(chunkIndex, pad)}-p${a}-p${b}.pdf`;
        zip.file(fname, outBlob);

        chunkIndex++;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadSingleBlob(zipBlob, `${namePrefix}-chunks.zip`);
      toast({ title: "Done!", description: "ZIP downloaded with chunked PDFs." });
    } catch (e: any) {
      toast({
        title: "Split failed",
        description: e?.message ? String(e.message) : "Something went wrong splitting the PDF.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const downloadOutput = () => {
    if (!outUrl || !outName) return;
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <ToolLayout
      title="Split PDF"
      description="Split, extract, or chunk pages from a PDF — client-side, fast, private."
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
              <p className="text-xs text-muted-foreground mt-3">Split happens locally — no uploads</p>
            </div>
          </Card>

          {file && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-7 w-7 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(origBytes)} • {pageCount} pages
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clear} disabled={working} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extract">Extract pages</SelectItem>
                  <SelectItem value="single">Split into single pages</SelectItem>
                  <SelectItem value="chunk">Split every N pages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "extract" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Pages to extract</Label>
                  <Input
                    value={extractRanges}
                    onChange={(e) => setExtractRanges(e.target.value)}
                    placeholder="Example: 1-3, 6, 9-12"
                  />
                  <p className="text-xs text-muted-foreground">Use: 1-3, 6, 9-12</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Each range as separate PDF (ZIP)</Label>
                    <p className="text-xs text-muted-foreground">Otherwise you get one extracted PDF</p>
                  </div>
                  <Switch checked={extractEachRangeAsSeparate} onCheckedChange={setExtractEachRangeAsSeparate} />
                </div>
              </div>
            )}

            {mode === "chunk" && (
              <div className="space-y-2">
                <Label>Chunk size (pages)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value)))}
                />
                <p className="text-xs text-muted-foreground">Example: 5 = PDFs of 5 pages each</p>
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Limit to a page span (optional)</Label>
                  <p className="text-xs text-muted-foreground">Example: only operate within 10-50</p>
                </div>
                <Switch checked={limitEnabled} onCheckedChange={setLimitEnabled} />
              </div>
              <Input
                value={limitRangeText}
                onChange={(e) => setLimitRangeText(e.target.value)}
                placeholder="Example: 10-50"
                disabled={!limitEnabled}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Filename prefix</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="my-document" />
              </div>
              <div className="space-y-2">
                <Label>Zero padding</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  step={1}
                  value={padWidth}
                  onChange={(e) => setPadWidth(clamp(Number(e.target.value), 1, 6))}
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={splitNow} disabled={!canRun} className="w-full" size="lg">
              {working ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Working...
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4 mr-2" />
                  Split
                </>
              )}
            </Button>

            <Button onClick={downloadOutput} disabled={!outUrl} variant="secondary" className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {outBytes != null && outName && (
            <Card className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Output</span>
                <span className="font-medium">{formatBytes(outBytes)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{outName}</div>
            </Card>
          )}
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
                <span>Upload a PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Choose a split mode and (optionally) a page limit</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download the result — extracted PDF or a ZIP</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Use ranges like: <span className="font-medium text-foreground">1-3, 6, 9-12</span></li>
              <li>• “Each range as separate” creates a ZIP with one PDF per range.</li>
              <li>• For single pages and chunks, output is always a ZIP.</li>
              <li>• Everything runs locally in your browser. No uploads.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
