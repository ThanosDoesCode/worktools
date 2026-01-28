import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ArrowUp, ArrowDown, Layers, Loader2, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";

interface PDFItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount?: number;
  rangeText: string; // optional: "1-3, 6"
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function baseName(name: string) {
  return (name || "merged").replace(/\.pdf$/i, "") || "merged";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** parse "1-3, 6, 9-12" -> inclusive [start,end] (1-based) */
function parsePageRanges(input: string, maxPages: number): Array<[number, number]> {
  const text = (input || "").trim();
  if (!text) return [];

  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
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

function rangesToIndices(ranges: Array<[number, number]>): number[] {
  const set = new Set<number>();
  for (const [a, b] of ranges) {
    for (let p = a; p <= b; p++) set.add(p - 1);
  }
  return Array.from(set).sort((x, y) => x - y);
}

export default function MergePDFs() {
  const [items, setItems] = useState<PDFItem[]>([]);
  const [merging, setMerging] = useState(false);
  const [outName, setOutName] = useState<string>("merged");
  const { toast } = useToast();

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const pdfs = acceptedFiles.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));

      if (pdfs.length === 0) {
        toast({
          title: "Only PDFs supported",
          description: "Please upload one or more .pdf files.",
          variant: "destructive",
        });
        return;
      }

      const newItems: PDFItem[] = pdfs.map((file) => ({
        id: safeId(),
        file,
        name: file.name,
        size: file.size,
        rangeText: "", // empty = all pages
      }));

      setItems((prev) => [...prev, ...newItems]);

      // Load page counts in background (best effort)
      for (const it of newItems) {
        try {
          const bytes = await it.file.arrayBuffer();
          const doc = await PDFDocument.load(bytes);
          const count = doc.getPageCount();
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, pageCount: count } : p)));
        } catch {
          // ignore
        }
      }

      // Set default output name from first file if empty
      if (!outName.trim() && newItems[0]) setOutName(baseName(newItems[0].name));
    },
    [toast, outName],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 50,
  });

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const clearAll = () => setItems([]);

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const updateRange = (id: string, value: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, rangeText: value } : p)));
  };

  const mergeNow = async () => {
    if (items.length < 2) {
      toast({
        title: "Add at least 2 PDFs",
        description: "Upload two or more PDF files to merge them into one.",
        variant: "destructive",
      });
      return;
    }

    setMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of items) {
        const bytes = await item.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const pageCount = srcPdf.getPageCount();

        const ranges = parsePageRanges(item.rangeText, pageCount);
        const indices = ranges.length > 0 ? rangesToIndices(ranges) : srcPdf.getPageIndices();

        if (indices.length === 0) continue;

        const copiedPages = await mergedPdf.copyPages(srcPdf, indices);
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      }

      if (mergedPdf.getPageCount() === 0) {
        toast({
          title: "Nothing to merge",
          description: "Your page ranges resulted in 0 pages. Remove ranges or adjust them.",
          variant: "destructive",
        });
        return;
      }

      const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const cleanName = (outName || "merged").trim().replace(/\.pdf$/i, "") || "merged";
      const filename = `${cleanName}-${new Date().toISOString().slice(0, 10)}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({
        title: "Merged!",
        description: "Your merged PDF has been downloaded.",
      });
    } catch (e: any) {
      toast({
        title: "Merge failed",
        description: e?.message ? String(e.message) : "Something went wrong while merging your PDFs.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <ToolLayout title="Merge PDFs" description="Combine multiple PDF files into a single PDF — fast, private.">
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
              <p className="text-lg font-medium">Drop PDFs here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Reorder files + optionally merge only certain pages.</p>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="space-y-2">
              <Label>Output filename</Label>
              <Input value={outName} onChange={(e) => setOutName(e.target.value)} placeholder="merged" />
              <p className="text-xs text-muted-foreground">We’ll append today’s date automatically.</p>
            </div>
          </Card>

          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{items.length}</span> file
                  {items.length === 1 ? "" : "s"} •{" "}
                  <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
                </div>
                <Button variant="ghost" onClick={clearAll} className="h-8 px-2" disabled={merging}>
                  Clear
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={it.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(it.size)}
                            {typeof it.pageCount === "number" ? ` • ${it.pageCount} pages` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0 || merging}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(idx, 1)}
                          disabled={idx === items.length - 1 || merging}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(it.id)}
                          disabled={merging}
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Optional pages to include (leave blank for all)
                      </Label>
                      <Input
                        value={it.rangeText}
                        onChange={(e) => updateRange(it.id, e.target.value)}
                        placeholder="Example: 1-3, 6, 9-12"
                        disabled={merging}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={mergeNow} disabled={items.length < 2 || merging} className="w-full" size="lg">
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Merge PDFs
              </>
            )}
          </Button>
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
                <span>Upload 2+ PDF files</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Reorder files and optionally enter page ranges to include</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Merge and download the combined PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • Page ranges support: <span className="font-medium text-foreground">1-3, 6, 9-12</span>
              </li>
              <li>• Leave the range blank to include all pages from that file.</li>
              <li>• Everything runs in your browser — PDFs are not uploaded anywhere.</li>
              <li>• Very large merges depend on your device memory.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
