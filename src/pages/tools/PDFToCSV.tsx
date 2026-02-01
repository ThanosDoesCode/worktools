import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileSpreadsheet, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";
import JSZip from "jszip";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// MOAT
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

/** ---- Settings we store/share via Moat (NOT the file contents) ---- */
type OutputMode = "multi" | "single";

type Settings = {
  mode: OutputMode;

  // Table heuristics
  splitOnMultiSpace: boolean; // split rows into columns
  minCols: number; // how many cols to consider "tabular"
  maxCellLen: number; // discard "tabular" if cells are too long
  addPageSeparatorRow: boolean; // for single CSV, add "--- Page N ---"
};

const DEFAULT_SETTINGS: Settings = {
  mode: "multi",
  splitOnMultiSpace: true,
  minCols: 2,
  maxCellLen: 120,
  addPageSeparatorRow: true,
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "Safe default (ZIP per page)", settings: { ...DEFAULT_SETTINGS, mode: "multi" } },
  {
    name: "Single CSV (with separators)",
    settings: { ...DEFAULT_SETTINGS, mode: "single", addPageSeparatorRow: true },
  },
  { name: "Single CSV (no separators)", settings: { ...DEFAULT_SETTINGS, mode: "single", addPageSeparatorRow: false } },
  { name: "Aggressive columns (min 3 cols)", settings: { ...DEFAULT_SETTINGS, minCols: 3 } },
  { name: "No column splitting (text rows)", settings: { ...DEFAULT_SETTINGS, splitOnMultiSpace: false } },
];

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

function escapeCsvCell(value: string) {
  const v = value ?? "";
  const escaped = v.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

// Split by multiple spaces/tabs -> “columns”
function splitLineToCells(line: string): string[] {
  const normalized = line.replace(/\t/g, "  ").trim();
  if (!normalized) return [];
  return normalized.split(/\s{2,}/g).map((c) => c.trim());
}

function looksTabular(cells: string[], minCols: number, maxCellLen: number) {
  return cells.length >= minCols && cells.every((c) => c.length <= maxCellLen);
}

export default function PDFToCSV() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  // Moat settings
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-to-csv";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile({ file, name: file.name });
        setProgress(null);
        toast({ title: "Loaded", description: "PDF ready to convert." });
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

          if (settings.splitOnMultiSpace) {
            const cells = splitLineToCells(line);
            if (looksTabular(cells, settings.minCols, settings.maxCellLen)) pageRows.push(cells);
            else pageRows.push([line]);
          } else {
            pageRows.push([line]);
          }
        }

        const pageCsv = pageRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");

        if (settings.mode === "multi") {
          zip.file(`${base}-page-${String(pageNumber).padStart(3, "0")}.csv`, pageCsv);
        } else {
          if (pageNumber > 1 && settings.addPageSeparatorRow) combinedRows.push([`--- Page ${pageNumber} ---`]);
          combinedRows.push(...pageRows);
        }
      }

      if (settings.mode === "multi") {
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

      // Record “job” (settings only)
      moat.recordJob();
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

  const modeLabel = useMemo(() => {
    return settings.mode === "multi" ? "ZIP (one CSV per page)" : "Single CSV file";
  }, [settings.mode]);

  return (
    <ToolLayout title="PDF to CSV (Table Extract)" description="Extract text and simple tables from PDF into CSV.">
      <div className="grid gap-8 lg:grid-cols-3">
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
        </div>

        {/* LEFT */}
        <div className="order-1 lg:order-2 space-y-6 lg:col-span-1">
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

          {/* SETTINGS */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Output</p>
                <p className="text-xs text-muted-foreground">Per-page CSV is safer for messy PDFs.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.mode}
                onChange={(e) => setSettings((p) => ({ ...p, mode: e.target.value as OutputMode }))}
                disabled={converting}
              >
                <option value="multi">ZIP (one CSV per page)</option>
                <option value="single">Single CSV file</option>
              </select>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Split into columns</p>
                  <p className="text-xs text-muted-foreground">Uses multiple spaces/tabs as column separators.</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.splitOnMultiSpace}
                  onChange={(e) => setSettings((p) => ({ ...p, splitOnMultiSpace: e.target.checked }))}
                  disabled={converting}
                />
              </div>

              {settings.splitOnMultiSpace && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-muted-foreground">
                    Min columns
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={settings.minCols}
                      onChange={(e) =>
                        setSettings((p) => ({ ...p, minCols: clampInt(Number(e.target.value || 2), 1, 10) }))
                      }
                      disabled={converting}
                    />
                  </label>

                  <label className="text-xs text-muted-foreground">
                    Max cell length
                    <input
                      type="number"
                      min={20}
                      max={300}
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                      value={settings.maxCellLen}
                      onChange={(e) =>
                        setSettings((p) => ({ ...p, maxCellLen: clampInt(Number(e.target.value || 120), 20, 300) }))
                      }
                      disabled={converting}
                    />
                  </label>
                </div>
              )}

              {settings.mode === "single" && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Add page separator rows</p>
                    <p className="text-xs text-muted-foreground">Adds “--- Page N ---” between pages.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={settings.addPageSeparatorRow}
                    onChange={(e) => setSettings((p) => ({ ...p, addPageSeparatorRow: e.target.checked }))}
                    disabled={converting}
                  />
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Current: <span className="font-medium text-foreground">{modeLabel}</span>
              </div>
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

        {/* RIGHT */}
        <div className="order-2 lg:order-3 space-y-6 lg:col-span-1">
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
              <li>• Your file never leaves your device</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
