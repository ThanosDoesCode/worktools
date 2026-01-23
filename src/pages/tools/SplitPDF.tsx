import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import {
  Upload,
  X,
  Scissors,
  Loader2,
  Download,
  FileText,
  Files,
} from "lucide-react";

type SplitMode = "ranges" | "everyN";

interface PDFFile {
  file: File;
  name: string;
}

function safeBaseName(name: string) {
  const base = name.replace(/\.pdf$/i, "");
  return base.length ? base : "document";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Parse ranges like:
 * 1-3, 5, 7-10
 * Returns array of [start,end] inclusive, 1-based.
 */
function parseRanges(input: string): Array<[number, number]> {
  const cleaned = input
    .replace(/\s+/g, "")
    .replace(/;+$/g, "")
    .trim();

  if (!cleaned) return [];

  const parts = cleaned.split(",").filter(Boolean);
  const ranges: Array<[number, number]> = [];

  for (const p of parts) {
    if (p.includes("-")) {
      const [a, b] = p.split("-");
      const start = Number(a);
      const end = Number(b);
      if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error(`Invalid range: "${p}"`);
      if (start < 1 || end < 1) throw new Error(`Pages must be >= 1: "${p}"`);
      ranges.push([Math.min(start, end), Math.max(start, end)]);
    } else {
      const page = Number(p);
      if (!Number.isFinite(page)) throw new Error(`Invalid page: "${p}"`);
      if (page < 1) throw new Error(`Pages must be >= 1: "${p}"`);
      ranges.push([page, page]);
    }
  }

  // Merge overlaps to avoid duplicates
  ranges.sort((r1, r2) => r1[0] - r2[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r[0] > last[1] + 1) merged.push([...r]);
    else last[1] = Math.max(last[1], r[1]);
  }
  return merged;
}

export default function SplitPDF() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangesInput, setRangesInput] = useState("1-3,5,7-10");
  const [everyN, setEveryN] = useState("2");
  const [splitting, setSplitting] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({
        title: "Only PDFs supported",
        description: "Please upload a .pdf file.",
        variant: "destructive",
      });
      return;
    }

    setPdfFile({ file, name: file.name });
    setPageCount(null);

    // Try to read page count (client-side)
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      setPageCount(doc.getPageCount());
    } catch {
      // If a PDF is malformed, keep UX simple
      setPageCount(null);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => {
    setPdfFile(null);
    setPageCount(null);
  };

  const planSummary = useMemo(() => {
    if (!pdfFile) return null;
    if (!pageCount) return null;

    try {
      if (mode === "ranges") {
        const ranges = parseRanges(rangesInput);
        if (ranges.length === 0) return "No ranges yet.";
        const clipped = ranges.map(([a, b]) => [clamp(a, 1, pageCount), clamp(b, 1, pageCount)] as [number, number]);
        const parts = clipped.filter(([a, b]) => a <= b);
        return `${parts.length} output PDF(s) from ranges within 1–${pageCount}.`;
      } else {
        const n = Number(everyN);
        if (!Number.isFinite(n) || n < 1) return "Enter N (>= 1).";
        const outputs = Math.ceil(pageCount / n);
        return `${outputs} output PDF(s) (${n} page(s) each, last may be smaller).`;
      }
    } catch (e: any) {
      return e?.message ? String(e.message) : "Invalid input.";
    }
  }, [pdfFile, pageCount, mode, rangesInput, everyN]);

  const splitNow = async () => {
    if (!pdfFile) return;

    setSplitting(true);

    try {
      const bytes = await pdfFile.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const total = srcDoc.getPageCount();

      const zip = new JSZip();
      const base = safeBaseName(pdfFile.name);

      if (mode === "ranges") {
        const ranges = parseRanges(rangesInput);
        if (ranges.length === 0) {
          toast({
            title: "Add page ranges",
            description: 'Example: "1-3,5,7-10"',
            variant: "destructive",
          });
          setSplitting(false);
          return;
        }

        let partIndex = 1;
        for (const [rawStart, rawEnd] of ranges) {
          const start = clamp(rawStart, 1, total);
          const end = clamp(rawEnd, 1, total);
          if (start > end) continue;

          const out = await PDFDocument.create();
          const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
          const pages = await out.copyPages(srcDoc, indices);
          pages.forEach((p) => out.addPage(p));

          const outBytes = await out.save();
          const filename = `${base}-part-${String(partIndex).padStart(2, "0")}-pages-${start}-${end}.pdf`;
          zip.file(filename, outBytes);
          partIndex += 1;
        }

        if (partIndex === 1) {
          toast({
            title: "No valid pages",
            description: `Your ranges didn't match pages 1–${total}.`,
            variant: "destructive",
          });
          setSplitting(false);
          return;
        }
      } else {
        const nRaw = Number(everyN);
        if (!Number.isFinite(nRaw) || nRaw < 1) {
          toast({
            title: "Invalid N",
            description: "N must be a number >= 1.",
            variant: "destructive",
          });
          setSplitting(false);
          return;
        }

        const n = Math.floor(nRaw);
        let partIndex = 1;

        for (let start = 1; start <= total; start += n) {
          const end = Math.min(start + n - 1, total);

          const out = await PDFDocument.create();
          const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
          const pages = await out.copyPages(srcDoc, indices);
          pages.forEach((p) => out.addPage(p));

          const outBytes = await out.save();
          const filename = `${base}-part-${String(partIndex).padStart(2, "0")}-pages-${start}-${end}.pdf`;
          zip.file(filename, outBytes);
          partIndex += 1;
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeBaseName(pdfFile.name)}-split.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({
        title: "Split complete!",
        description: "Your ZIP file has been downloaded.",
      });
    } catch (e: any) {
      toast({
        title: "Split failed",
        description: e?.message ? String(e.message) : "Something went wrong while splitting your PDF.",
        variant: "destructive",
      });
    } finally {
      setSplitting(false);
    }
  };

  return (
    <ToolLayout
      title="Split PDF"
      description="Split a PDF into multiple files by page ranges or every N pages — fast, private, and client-side."
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
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {pageCount ? `${pageCount} pages` : "PDF loaded"} • Outputs download as ZIP
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={splitting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Mode */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "ranges" ? "default" : "outline"}
                onClick={() => setMode("ranges")}
                disabled={splitting}
              >
                <Scissors className="h-4 w-4 mr-2" />
                By ranges
              </Button>
              <Button
                type="button"
                variant={mode === "everyN" ? "default" : "outline"}
                onClick={() => setMode("everyN")}
                disabled={splitting}
              >
                <Files className="h-4 w-4 mr-2" />
                Every N pages
              </Button>
            </div>

            {mode === "ranges" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Page ranges</label>
                <Input
                  value={rangesInput}
                  onChange={(e) => setRangesInput(e.target.value)}
                  placeholder='Example: "1-3,5,7-10"'
                  disabled={splitting}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. Use <span className="font-medium">1-3</span> for a range or <span className="font-medium">5</span> for a single page.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Pages per file (N)</label>
                <Input
                  value={everyN}
                  onChange={(e) => setEveryN(e.target.value)}
                  placeholder="2"
                  inputMode="numeric"
                  disabled={splitting}
                />
                <p className="text-xs text-muted-foreground">
                  Splits the PDF into chunks of N pages (last file may be smaller).
                </p>
              </div>
            )}

            {planSummary && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {planSummary}
              </div>
            )}
          </Card>

          <Button onClick={splitNow} disabled={!pdfFile || splitting} className="w-full" size="lg">
            {splitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Split & Download ZIP
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
                <span>Upload your PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Choose ranges or “every N pages”</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a ZIP with all split PDFs</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Split by custom page ranges</li>
              <li>• Split into chunks of N pages</li>
              <li>• Output as ZIP download</li>
              <li>• Private: client-side processing</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
