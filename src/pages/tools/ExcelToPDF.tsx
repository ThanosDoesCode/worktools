import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, Download, Table, Loader2, FileText, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Moat layer */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";
type HeaderMode = "auto" | "on" | "off";

interface UploadFile {
  file: File;
  name: string;
  size: number;
}

/**
 * Moat settings should represent ONLY export-style knobs.
 * File/sheet selection is NOT a “preset” concept (it would be weird to overwrite a user’s chosen sheet).
 */
type ExcelToPdfSettings = {
  pageSize: PageSize;
  orientation: Orientation;

  // “Moat” export quality knobs
  cleanEmpty: boolean; // trim trailing empty rows/cols
  autoFitCols: boolean; // estimate column widths based on content
  autoOrient: boolean; // if wide, export landscape even if user chose portrait
  repeatHeader: boolean; // repeat header on every page
  pageNumbers: boolean; // footer page count
  headerMode: HeaderMode; // auto / on / off

  // optional: “smart title” behavior could be added later
};

const DEFAULT_SETTINGS_EXCEL_PDF: ExcelToPdfSettings = {
  pageSize: "a4",
  orientation: "portrait",
  cleanEmpty: true,
  autoFitCols: true,
  autoOrient: true,
  repeatHeader: true,
  pageNumbers: true,
  headerMode: "auto",
};

const RECOMMENDED_PRESETS_EXCEL_PDF: { name: string; settings: ExcelToPdfSettings }[] = [
  {
    name: "Print-ready (A4)",
    settings: {
      ...DEFAULT_SETTINGS_EXCEL_PDF,
      pageSize: "a4",
      orientation: "portrait",
      autoOrient: true,
      autoFitCols: true,
      repeatHeader: true,
      pageNumbers: true,
      headerMode: "auto",
    },
  },
  {
    name: "Wide sheet (Landscape)",
    settings: {
      ...DEFAULT_SETTINGS_EXCEL_PDF,
      orientation: "landscape",
      autoOrient: false, // force landscape
      autoFitCols: true,
      repeatHeader: true,
      pageNumbers: true,
      headerMode: "auto",
    },
  },
  {
    name: "Compact export",
    settings: {
      ...DEFAULT_SETTINGS_EXCEL_PDF,
      autoFitCols: true,
      repeatHeader: false, // compact is often more about squeezing than readability
      pageNumbers: true,
      headerMode: "auto",
    },
  },
  {
    name: "Readable export",
    settings: {
      ...DEFAULT_SETTINGS_EXCEL_PDF,
      autoFitCols: true,
      repeatHeader: true,
      pageNumbers: true,
      headerMode: "on", // force header (readability)
    },
  },
  {
    name: "No header row",
    settings: {
      ...DEFAULT_SETTINGS_EXCEL_PDF,
      headerMode: "off",
      repeatHeader: false,
    },
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function baseName(name: string) {
  return name.replace(/\.(xlsx|xls|csv)$/i, "") || "spreadsheet";
}

function safeCell(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function isRowEmpty(row: string[]) {
  return !row?.some((c) => (c ?? "").toString().trim() !== "");
}

function trimEmptyTrailingRows(rows: string[][]) {
  let end = rows.length;
  while (end > 0 && isRowEmpty(rows[end - 1])) end--;
  return rows.slice(0, end);
}

function trimEmptyTrailingCols(rows: string[][]) {
  if (!rows.length) return rows;
  const maxCols = Math.max(...rows.map((r) => r.length), 0);
  if (maxCols === 0) return rows;

  let lastNonEmptyCol = -1;
  for (let c = 0; c < maxCols; c++) {
    const any = rows.some((r) => (r[c] ?? "").toString().trim() !== "");
    if (any) lastNonEmptyCol = c;
  }
  const keepCols = Math.max(1, lastNonEmptyCol + 1);
  return rows.map((r) => r.slice(0, keepCols));
}

function padRect(rows: string[][]) {
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  return rows.map((r) => {
    const rr = [...r];
    while (rr.length < colCount) rr.push("");
    return rr;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function looksLikeHeaderAuto(bodyRect: string[][]) {
  const first = bodyRect[0] || [];
  const second = bodyRect[1] || [];
  const hasSecond = second.some((c) => c !== "");
  const firstHasText = first.some((c) => c !== "");
  if (!firstHasText || !hasSecond) return false;

  const firstTexty = first.filter((c) => isNaN(Number(c)) && String(c).trim() !== "").length;
  const secondTexty = second.filter((c) => isNaN(Number(c)) && String(c).trim() !== "").length;

  return firstTexty >= Math.max(1, secondTexty - 1);
}

/**
 * Basic (but effective) column auto-width: derive proportional widths by max content length.
 * This is a moat feature because most “free converters” produce ugly tables.
 */
function buildColumnStyles(doc: jsPDF, rowsRect: string[][], marginX: number) {
  const colCount = Math.max(...rowsRect.map((r) => r.length), 1);
  const maxLens = new Array(colCount).fill(1);

  for (const r of rowsRect) {
    for (let c = 0; c < colCount; c++) {
      const v = (r[c] ?? "").toString();
      maxLens[c] = Math.max(maxLens[c], v.length);
    }
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - marginX * 2;

  const weights = maxLens.map((len) => clamp(len, 3, 40));
  const total = weights.reduce((a, b) => a + b, 0) || 1;

  const minW = 55;
  const maxW = 260;

  const raw = weights.map((w) => (usable * w) / total);
  const widths = raw.map((w) => clamp(w, minW, maxW));

  const sum = widths.reduce((a, b) => a + b, 0) || 1;
  const scale = usable / sum;

  const columnStyles: Record<number, any> = {};
  for (let i = 0; i < colCount; i++) columnStyles[i] = { cellWidth: widths[i] * scale };

  return columnStyles;
}

export default function ExcelToPDF() {
  const toolSlug = "excel-to-pdf";

  const [uploaded, setUploaded] = useState<UploadFile | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [table, setTable] = useState<string[][]>([]);
  const [converting, setConverting] = useState(false);

  const [settings, setSettings] = useState<ExcelToPdfSettings>(DEFAULT_SETTINGS_EXCEL_PDF);

  const { toast } = useToast();

  // Moat hook
  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as ExcelToPdfSettings);
  const moat = useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS_EXCEL_PDF as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS_EXCEL_PDF.map((p) => ({
      id: p.name,
      name: p.name,
      settings: p.settings as Record<string, unknown>,
    })),
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const lower = file.name.toLowerCase();
      const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
      const isCsv = lower.endsWith(".csv");

      if (!isExcel && !isCsv) {
        toast({
          title: "Unsupported file",
          description: "Upload an .xlsx, .xls, or .csv file.",
          variant: "destructive",
        });
        return;
      }

      setUploaded({ file, name: file.name, size: file.size });
      setWorkbook(null);
      setSheetName("");
      setTable([]);

      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });

        setWorkbook(wb);

        const firstSheet = wb.SheetNames[0] || "";
        setSheetName(firstSheet);

        if (!firstSheet) {
          toast({
            title: "No sheets found",
            description: "This file doesn't contain any readable sheets.",
            variant: "destructive",
          });
          return;
        }

        const ws = wb.Sheets[firstSheet];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        const normalized: string[][] = (rows || []).map((r) => (r || []).map(safeCell));

        setTable(normalized);

        toast({
          title: "Loaded",
          description: `Found ${wb.SheetNames.length} sheet(s).`,
        });
      } catch (e: any) {
        toast({
          title: "Failed to read file",
          description: e?.message ? String(e.message) : "Could not parse the spreadsheet.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 1 });

  const clearFile = () => {
    setUploaded(null);
    setWorkbook(null);
    setSheetName("");
    setTable([]);
  };

  const sheetNames = workbook?.SheetNames ?? [];

  const selectSheet = (name: string) => {
    if (!workbook) return;
    const ws = workbook.Sheets[name];
    if (!ws) return;

    setSheetName(name);
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    const normalized: string[][] = (rows || []).map((r) => (r || []).map(safeCell));
    setTable(normalized);
  };

  const hasData = useMemo(() => table.length > 0 && table.some((r) => r.some((c) => c !== "")), [table]);

  // “Moat” cleanup + rectangular
  const exportTable = useMemo(() => {
    let rows = table;

    if (settings.cleanEmpty) {
      rows = trimEmptyTrailingRows(rows);
      rows = trimEmptyTrailingCols(rows);
    }

    return padRect(rows);
  }, [table, settings.cleanEmpty]);

  const preview = useMemo(() => {
    const maxRows = 15;
    const maxCols = 8;

    const rows = exportTable.slice(0, maxRows).map((r) => r.slice(0, maxCols));
    const colsCount = Math.max(1, ...rows.map((r) => r.length));
    const padded = rows.map((r) => {
      const rr = [...r];
      while (rr.length < colsCount) rr.push("");
      return rr;
    });

    return {
      rows: padded,
      colsCount,
      truncatedRows: exportTable.length > maxRows,
      truncatedCols: (exportTable[0]?.length || 0) > maxCols,
    };
  }, [exportTable]);

  const convertToPDF = async () => {
    if (!uploaded || !workbook || !sheetName) return;

    if (!hasData) {
      toast({
        title: "No data to export",
        description: "This sheet looks empty.",
        variant: "destructive",
      });
      return;
    }

    setConverting(true);

    try {
      const colCount = Math.max(...exportTable.map((r) => r.length), 1);

      // Smart orientation: only if enabled
      const orientationToUse: Orientation = settings.autoOrient && colCount >= 9 ? "landscape" : settings.orientation;

      const doc = new jsPDF({
        orientation: orientationToUse === "portrait" ? "p" : "l",
        unit: "pt",
        format: settings.pageSize,
      });

      // Header decision
      const autoHeader = looksLikeHeaderAuto(exportTable);
      const useHeader = settings.headerMode === "on" ? true : settings.headerMode === "off" ? false : autoHeader;

      const head = useHeader ? [exportTable[0] || []] : undefined;
      const bodyRows = useHeader ? exportTable.slice(1) : exportTable;

      const title = `${baseName(uploaded.name)} — ${sheetName}`;
      doc.setFontSize(12);
      doc.text(title, 40, 40);

      const marginX = 40;

      const columnStyles = settings.autoFitCols ? buildColumnStyles(doc, exportTable, marginX) : undefined;

      autoTable(doc, {
        startY: 60,
        head,
        body: bodyRows,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 4,
          overflow: "linebreak",
        },
        headStyles: { fontStyle: "bold" },
        margin: { left: marginX, right: marginX },
        tableWidth: "auto",
        horizontalPageBreak: true,
        columnStyles,

        // Repeat header only if header exists
        showHead: useHeader && settings.repeatHeader ? "everyPage" : "firstPage",

        // Page numbers
        didDrawPage: () => {
          if (!settings.pageNumbers) return;
          const pageCount = doc.getNumberOfPages();
          const page = doc.getCurrentPageInfo().pageNumber;

          doc.setFontSize(9);
          const footer = `Page ${page} / ${pageCount}`;
          const w = doc.internal.pageSize.getWidth();
          const h = doc.internal.pageSize.getHeight();
          doc.text(footer, w - marginX, h - 20, { align: "right" });
        },
      });

      const outName = `${baseName(uploaded.name)}-${sheetName}.pdf`;
      doc.save(outName);

      toast({ title: "Exported!", description: "Your PDF has been downloaded." });

      // Moat job tracking
      moat.recordJob();
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ? String(e.message) : "Something went wrong creating the PDF.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <ToolLayout title="Excel to PDF" description="Convert XLSX/XLS/CSV spreadsheets to a clean PDF — private.">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Moat column */}
        <div className="order-3 lg:order-1">
          <LocalStatusIndicator />
          <div className="mt-3">
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
          </div>
          <div className="mt-3">
            <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
          </div>

        {/* Left */}
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
              <p className="text-lg font-medium">Drop your spreadsheet here</p>
              <p className="text-sm text-muted-foreground mt-1">XLSX, XLS, or CSV</p>
            </div>
          </Card>

          {uploaded && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Table className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{uploaded.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(uploaded.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Options */}
          {workbook && (
            <Card className="p-4 space-y-4">
              {/* Sheet selector */}
              {sheetNames.length > 1 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Sheet</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={sheetName}
                    onChange={(e) => selectSheet(e.target.value)}
                    disabled={converting}
                  >
                    {sheetNames.map((sn) => (
                      <option key={sn} value={sn}>
                        {sn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Page size</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.pageSize}
                    onChange={(e) => setSettings((p) => ({ ...p, pageSize: e.target.value as PageSize }))}
                    disabled={converting}
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Orientation</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.orientation}
                    onChange={(e) => setSettings((p) => ({ ...p, orientation: e.target.value as Orientation }))}
                    disabled={converting}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>

              {/* Moat export quality toggles (these make sense for this tool) */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="text-sm font-semibold">Export quality</div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settings.cleanEmpty}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, cleanEmpty: Boolean(v) }))}
                      disabled={converting}
                    />
                    Clean empty rows/cols
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settings.autoFitCols}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, autoFitCols: Boolean(v) }))}
                      disabled={converting}
                    />
                    Auto-fit columns
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settings.autoOrient}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, autoOrient: Boolean(v) }))}
                      disabled={converting}
                    />
                    Auto orientation (wide → landscape)
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settings.repeatHeader}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, repeatHeader: Boolean(v) }))}
                      disabled={converting}
                    />
                    Repeat header on pages
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settings.pageNumbers}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, pageNumbers: Boolean(v) }))}
                      disabled={converting}
                    />
                    Page numbers
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Header row</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.headerMode}
                    onChange={(e) => setSettings((p) => ({ ...p, headerMode: e.target.value as HeaderMode }))}
                    disabled={converting}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="on">Always use first row</option>
                    <option value="off">No header row</option>
                  </select>

                  <div className="text-xs text-muted-foreground">
                    Tip: If your sheet starts with a title row above headers, choose <b>No header row</b>.
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Button
            onClick={convertToPDF}
            disabled={!workbook || !sheetName || converting || !hasData}
            className="w-full"
            size="lg"
          >
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to PDF
              </>
            )}
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="order-2 lg:order-3 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Preview</h3>

            {!workbook ? (
              <p className="text-sm text-muted-foreground">Upload a spreadsheet to preview and export it.</p>
            ) : !hasData ? (
              <p className="text-sm text-muted-foreground">This sheet appears empty.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Showing up to 15 rows × 8 columns for preview.
                  {preview.truncatedRows ? " (More rows in file)" : ""}
                  {preview.truncatedCols ? " (More columns in file)" : ""}
                </div>

                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.rows.map((row, idx) => (
                        <tr key={idx} className="border-b last:border-b-0">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 border-r last:border-r-0 align-top whitespace-pre-wrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Tip: If your sheet is wide, enable <b>Auto orientation</b> or choose <b>Landscape</b>. Auto-fit
                    columns improves readability.
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• XLSX, XLS, and CSV support</li>
              <li>• Sheet selection for Excel files</li>
              <li>• Multi-page tables (including wide tables)</li>
              <li>• Private: runs in your browser</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
