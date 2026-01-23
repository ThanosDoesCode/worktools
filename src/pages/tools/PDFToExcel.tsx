import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Table, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

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

// Simple heuristic: convert a line into columns based on multiple spaces/tabs
function splitLineToCells(line: string): string[] {
  // Normalize tabs to spaces then split on 2+ spaces
  const normalized = line.replace(/\t/g, "  ").trim();
  if (!normalized) return [];
  return normalized.split(/\s{2,}/g).map((c) => c.trim());
}

// Decide if line looks like a “table row”
function looksTabular(cells: string[]) {
  // At least 2 columns and not too long single text
  return cells.length >= 2 && cells.every((c) => c.length <= 120);
}

export default function PDFToExcel() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

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

  const convertToExcel = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const wb = XLSX.utils.book_new();

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        // Build “lines” by grouping items with similar Y positions.
        // This gives better table-ish results than simple join.
        const items = (textContent.items as any[]).map((it) => ({
          str: String(it.str || ""),
          x: it.transform?.[4] ?? 0,
          y: it.transform?.[5] ?? 0,
        }));

        // Group by y (rounded)
        const lineMap = new Map<number, { x: number; str: string }[]>();
        for (const it of items) {
          const yKey = Math.round(it.y); // simple bucketing
          if (!lineMap.has(yKey)) lineMap.set(yKey, []);
          lineMap.get(yKey)!.push({ x: it.x, str: it.str });
        }

        // Sort lines top->bottom (higher y first in PDF.js coords)
        const yKeys = Array.from(lineMap.keys()).sort((a, b) => b - a);

        const lines: string[] = yKeys.map((y) => {
          const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x);
          // Insert a space between fragments
          return parts
            .map((p) => p.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        });

        // Convert lines into rows
        const rows: string[][] = [];
        for (const line of lines) {
          if (!line) continue;
          const cells = splitLineToCells(line);

          // If it looks tabular, keep as row. Otherwise push as single-cell row.
          if (looksTabular(cells)) rows.push(cells);
          else rows.push([line]);
        }

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, `Page ${pageNumber}`);
      }

      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, `${baseName(pdfFile.name)}.xlsx`);

      toast({
        title: "Done!",
        description: `Exported ${totalPages} sheet(s) to XLSX.`,
      });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to XLSX.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to Excel (Table Extract)"
      description="Extract text and simple tables from PDF into an XLSX spreadsheet — free and client-side."
    >
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
                  <Table className="h-8 w-8 text-primary shrink-0" />
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

          <Button onClick={convertToExcel} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download XLSX
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
                <span>We extract text and try to split table-like rows into columns</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download an XLSX with one sheet per page</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Works best on “simple tables” with consistent spacing</li>
              <li>• Complex tables (merged cells, multi-columns) may need backend tools</li>
              <li>• If you only need data, PDF → CSV is often cleaner</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
