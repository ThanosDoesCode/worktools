import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Table, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";

interface UploadFile {
  file: File;
  name: string;
  size: number;
}

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

export default function ExcelToPDF() {
  const [uploaded, setUploaded] = useState<UploadFile | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [table, setTable] = useState<string[][]>([]);
  const [converting, setConverting] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const { toast } = useToast();

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

        // XLSX can read CSV too, but we handle both in the same path.
        const wb = XLSX.read(buf, {
          type: "array",
          cellDates: true,
          raw: false,
        });

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
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
  });

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

  const preview = useMemo(() => {
    const maxRows = 15;
    const maxCols = 8;

    const rows = table.slice(0, maxRows).map((r) => r.slice(0, maxCols));
    const colsCount = Math.max(1, ...rows.map((r) => r.length));
    const padded = rows.map((r) => {
      const rr = [...r];
      while (rr.length < colsCount) rr.push("");
      return rr;
    });

    return { rows: padded, colsCount, truncatedRows: table.length > maxRows, truncatedCols: (table[0]?.length || 0) > maxCols };
  }, [table]);

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
      const doc = new jsPDF({
        orientation: orientation === "portrait" ? "p" : "l",
        unit: "pt",
        format: pageSize,
      });

      // Build a rectangular table (pad rows to same column length)
      const colCount = Math.max(...table.map((r) => r.length), 1);
      const body = table.map((r) => {
        const rr = [...r];
        while (rr.length < colCount) rr.push("");
        return rr;
      });

      // If the first row looks like headers, we can treat it as head.
      // Simple heuristic: if first row has any non-empty and second row exists.
      const first = body[0] || [];
      const second = body[1] || [];
      const hasSecond = second.some((c) => c !== "");
      const looksLikeHeader = first.some((c) => c !== "") && hasSecond;

      const head = looksLikeHeader ? [first] : undefined;
      const startIndex = looksLikeHeader ? 1 : 0;
      const bodyRows = body.slice(startIndex);

      const title = `${baseName(uploaded.name)} — ${sheetName}`;

      doc.setFontSize(12);
      doc.text(title, 40, 40);

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
        headStyles: {
          fontStyle: "bold",
        },
        margin: { left: 40, right: 40 },
        tableWidth: "auto",
        horizontalPageBreak: true, // if table too wide, it breaks into multiple “column pages”
      });

      const outName = `${baseName(uploaded.name)}-${sheetName}.pdf`;
      doc.save(outName);

      toast({
        title: "Exported!",
        description: "Your PDF has been downloaded.",
      });
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
    <ToolLayout title="Excel to PDF" description="Convert XLSX/XLS/CSV spreadsheets to a clean PDF — client-side, private.">
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
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as PageSize)}
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
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                    disabled={converting}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
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
        <div className="space-y-6">
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
                    Tip: If your sheet is wide, choose <b>Landscape</b>. The export supports wide tables via horizontal page breaks.
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
              <li>• Multi-page tables</li>
              <li>• Private: runs in your browser</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
