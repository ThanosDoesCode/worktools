import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";
import JSZip from "jszip";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function escapeCsvCell(value: string) {
  const v = value ?? "";
  // Escape quotes by doubling them
  const escaped = v.replace(/"/g, '""');
  // Wrap in quotes if it contains comma, quote, or newline
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

// Split by multiple spaces/tabs -> “columns”
function splitLineToCells(line: string): string[] {
  const normalized = line.replace(/\t/g, "  ").trim();
  if (!normalized) return [];
  return normalized.split(/\s{2,}/g).map((c) => c.trim());
}

function looksTabular(cells: string[]) {
  return cells.length >= 2 && cells.every((c) => c.length <= 120);
}

export default function PDFToCSV() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [mode, setMode] = useState<"multi" | "single">("multi"); // multi = ZIP per page, single = one CSV
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile({ file, name: file.name });
        setProgress(null);
      } else {
        toast({
          title: "Only PDFs supported",
          description: "Please upload a .pdf file.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => {
    setPdfFile(null);
    setProgress(null);
  };

  const convertToCSV = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const base = baseName(pdfFile.name);
      const zip = new JSZip();

      const combinedRows: string[][] = [];

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        // Build lines by y-bucketing (better than plain join)
        const items = (textContent.items as any[]).map((it) => ({
          str: String(it.str || ""),
          x: it.transform?.[4] ?? 0,
          y: it.transform?.[5] ?? 0,
        }));

        const lineMap = new Map<number, { x: number; str: string }[]>();
        for (const it of items) {
          const yKey = Math.round(it.y);
          if (!lineMap.has(yKey)) lineMap.set(yKey, []);
          lineMap.get(yKey)!.push({ x: it.x, str: it.str });
        }

        const yKeys = Array.from(lineMap.keys()).sort((a, b) => b - a);

        const lines: string[] = yKeys.map((y) => {
          const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x);
          return parts
            .map((p) => p.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        });

        const pageRows: string[][] = [];

        for (const line of lines) {
          if (!line) continue;
          const cells = splitLineToCells(line);
          if (looksTabular(cells)) pageRows.push(cells);
          else pageRows.push([line]);
        }

        // Export page CSV
        const pageCsv = pageRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");

        if (mode === "multi") {
          zip.file(`${base}-page-${String(pageNumber).padStart(3, "0")}.csv`, pageCsv);
        } else {
          // Add a simple separator row between pages for combined file
          if (pageNumber > 1) combinedRows.push([`--- Page ${pageNumber} ---`]);
          combinedRows.push(...pageRows);
        }
      }

      if (mode === "multi") {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${base}-csv.zip`);
        toast({
          title: "Done!",
          description: `Exported ${totalPages} CSV file(s) in a ZIP.`,
        });
      } else {
        const combinedCsv = combinedRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");

        const blob = new Blob([combinedCsv], { type: "text/csv;charset=utf-8" });
        saveAs(blob, `${base}.csv`);
        toast({
          title: "Done!",
          description: `Exported a single CSV from ${totalPages} page(s).`,
        });
      }
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to CSV.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout title="PDF to CSV (Table Extract)" description="Extract text and simple tables from PDF into CSV.">
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
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Processing page {progress.current} / {progress.total}…
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Output</p>
                <p className="text-xs text-muted-foreground">Per-page CSV is safer for messy PDFs.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as "multi" | "single")}
                disabled={converting}
              >
                <option value="multi">ZIP (one CSV per page)</option>
                <option value="single">Single CSV file</option>
              </select>
            </div>
          </Card>

          <Button onClick={convertToCSV} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload your PDF with tables</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract lines and split table-like rows into columns</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download CSV (single file or ZIP)</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Works best on simple tables with consistent spacing</li>
              <li>• Complex PDFs may produce imperfect columns</li>
              <li>• For perfect table extraction you usually need backend engines</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
