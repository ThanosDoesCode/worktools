import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Table, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

// Simple heuristic: convert a line into columns based on multiple spaces/tabs
function splitLineToCells(line: string): string[] {
  const normalized = line.replace(/\t/g, "  ").trim();
  if (!normalized) return [];
  return normalized.split(/\s{2,}/g).map((c) => c.trim());
}

// Decide if line looks like a “table row”
function looksTabular(cells: string[]) {
  return cells.length >= 2 && cells.every((c) => c.length <= 120);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Settings = {
  // Output structure
  sheetMode: "per-page" | "single-sheet";
  includePageSeparatorRow: boolean; // when single-sheet, add "--- Page N ---" row
  skipNonTabularLines: boolean; // if true, ignore lines that don't look like tables
  maxCellLength: number; // clamp cell strings for xlsx safety/readability
};

const DEFAULT_SETTINGS: Settings = {
  sheetMode: "per-page",
  includePageSeparatorRow: true,
  skipNonTabularLines: false,
  maxCellLength: 200,
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "Reliable: sheet per page", settings: { ...DEFAULT_SETTINGS, sheetMode: "per-page" } },
  { name: "Single sheet (combine pages)", settings: { ...DEFAULT_SETTINGS, sheetMode: "single-sheet" } },
  { name: "Tables only (skip text)", settings: { ...DEFAULT_SETTINGS, skipNonTabularLines: true } },
  { name: "Compact cells", settings: { ...DEFAULT_SETTINGS, maxCellLength: 120 } },
];

function clampCell(s: string, maxLen: number) {
  const t = String(s ?? "");
  if (t.length <= maxLen) return t;
  return t.slice(0, Math.max(0, maxLen - 1)) + "…";
}

export default function PDFToExcel() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const { toast } = useToast();

  // MOAT settings (share/save)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-to-excel";

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

  const settingsSummary = useMemo(() => {
    const parts = [
      settings.sheetMode === "per-page" ? "Sheets: per page" : "Sheets: single",
      settings.skipNonTabularLines ? "Tables only" : "Include text lines",
      `Max cell: ${settings.maxCellLength}`,
    ];
    if (settings.sheetMode === "single-sheet") {
      parts.push(settings.includePageSeparatorRow ? "With page separators" : "No separators");
    }
    return parts.join(" • ");
  }, [settings]);

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

      // For single-sheet mode:
      const combinedRows: string[][] = [];

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        // Group items into lines by y-bucketing
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

        // Sort top->bottom
        const yKeys = Array.from(lineMap.keys()).sort((a, b) => b - a);

        const lines: string[] = yKeys.map((y) => {
          const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x);
          return parts
            .map((p) => p.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        });

        const rows: string[][] = [];

        for (const line of lines) {
          if (!line) continue;

          const cells = splitLineToCells(line);

          if (looksTabular(cells)) {
            rows.push(cells.map((c) => clampCell(c, settings.maxCellLength)));
          } else if (!settings.skipNonTabularLines) {
            rows.push([clampCell(line, settings.maxCellLength)]);
          }
        }

        if (settings.sheetMode === "per-page") {
          const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [["(No extractable text on this page)"]]);
          XLSX.utils.book_append_sheet(wb, ws, `Page ${pageNumber}`);
        } else {
          if (pageNumber > 1 && settings.includePageSeparatorRow) combinedRows.push([`--- Page ${pageNumber} ---`]);
          combinedRows.push(...(rows.length ? rows : [["(No extractable text on this page)"]]));
        }
      }

      if (settings.sheetMode === "single-sheet") {
        const ws = XLSX.utils.aoa_to_sheet(combinedRows.length ? combinedRows : [["(No extractable text)"]]);
        XLSX.utils.book_append_sheet(wb, ws, "Extract");
      }

      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, `${baseName(pdfFile.name)}.xlsx`);

      toast({
        title: "Done!",
        description:
          settings.sheetMode === "per-page"
            ? `Exported ${totalPages} sheet(s) to XLSX.`
            : `Exported 1 sheet combining ${totalPages} page(s).`,
      });

      moat.recordJob();
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
      description="Extract text and simple tables from PDF into an XLSX spreadsheet."
    >
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
        <div className="order-1 lg:order-2 space-y-6">
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

          {/* SETTINGS */}
          <Card className="p-6 space-y-4">
            <div className="text-xs text-muted-foreground">{settingsSummary}</div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Sheet mode</p>
                <p className="text-xs text-muted-foreground">Per-page is safer for messy PDFs.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.sheetMode}
                onChange={(e) => setSettings((p) => ({ ...p, sheetMode: e.target.value as Settings["sheetMode"] }))}
                disabled={converting}
              >
                <option value="per-page">One sheet per page</option>
                <option value="single-sheet">Single combined sheet</option>
              </select>
            </div>

            {settings.sheetMode === "single-sheet" && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Page separator rows</Label>
                  <p className="text-xs text-muted-foreground">Adds “--- Page N ---” between pages.</p>
                </div>
                <Switch
                  checked={settings.includePageSeparatorRow}
                  onCheckedChange={(v) => setSettings((p) => ({ ...p, includePageSeparatorRow: v }))}
                  disabled={converting}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Tables only</Label>
                <p className="text-xs text-muted-foreground">Skip plain text lines that don’t look tabular.</p>
              </div>
              <Switch
                checked={settings.skipNonTabularLines}
                onCheckedChange={(v) => setSettings((p) => ({ ...p, skipNonTabularLines: v }))}
                disabled={converting}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Max cell length</Label>
              <input
                type="number"
                min={40}
                max={1000}
                step={10}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={settings.maxCellLength}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, maxCellLength: clamp(Number(e.target.value || 200), 40, 1000) }))
                }
                disabled={converting}
              />
              <p className="text-xs text-muted-foreground">Trims huge cells to keep XLSX readable.</p>
            </div>
          </Card>

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

        {/* RIGHT */}
        <div className="order-2 lg:order-3 space-y-6">
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
                <span>Download an XLSX spreadsheet</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Works best on “simple tables” with consistent spacing</li>
              <li>• Complex layouts (merged cells, multi-columns) may not convert cleanly</li>
              <li>• For raw data workflows, PDF → CSV is often cleaner</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
