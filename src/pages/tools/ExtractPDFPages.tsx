import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, Download, FileText, Loader2, Scissors, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

/** Moat layer */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

interface PDFFile {
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
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

/**
 * Parse page ranges like:
 * "1-3,5,8-10" => [0,1,2,4,7,8,9]
 * Also supports spaces.
 */
function parsePageRange(input: string, pageCount: number): number[] {
  const cleaned = input.replace(/\s+/g, "");
  if (!cleaned) throw new Error("Enter page ranges (e.g. 1-3,5,8-10).");

  const parts = cleaned.split(",");
  const pages = new Set<number>();

  for (const part of parts) {
    if (!part) continue;
    if (part.includes("-")) {
      const [a, b] = part.split("-");
      const start = Number(a);
      const end = Number(b);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1)
        throw new Error(`Invalid range: "${part}"`);
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let p = lo; p <= hi; p++) {
        if (p > pageCount) throw new Error(`Page ${p} exceeds document length (${pageCount}).`);
        pages.add(p - 1);
      }
    } else {
      const p = Number(part);
      if (!Number.isFinite(p) || p < 1) throw new Error(`Invalid page: "${part}"`);
      if (p > pageCount) throw new Error(`Page ${p} exceeds document length (${pageCount}).`);
      pages.add(p - 1);
    }
  }

  const result = Array.from(pages).sort((x, y) => x - y);
  if (result.length === 0) throw new Error("No pages selected.");
  return result;
}

/** Convert indices to a nice range string like "1-3,5,8-10" */
function indicesToRange(indices: number[]): string {
  if (!indices.length) return "";
  const nums = Array.from(new Set(indices))
    .sort((a, b) => a - b)
    .map((i) => i + 1);

  const parts: string[] = [];
  let start = nums[0];
  let prev = nums[0];

  for (let i = 1; i < nums.length; i++) {
    const cur = nums[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(",");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* -----------------------------
   Moat Settings
------------------------------*/
type ExtractSettings = {
  range: string;
  outputMode: "single" | "split-zip";
  orderMode: "keep" | "reverse";
  // Light “pro” options that actually matter here:
  keepDuplicates: boolean; // if user types duplicates, keep them (default false)
};

const DEFAULT_SETTINGS_EXTRACT: ExtractSettings = {
  range: "1",
  outputMode: "single",
  orderMode: "keep",
  keepDuplicates: false,
};

function buildRecommendedPresets(pageCount: number) {
  // These are meaningful presets for extraction, not generic “themes”
  const last = pageCount;
  const firstTwo = pageCount >= 2 ? "1-2" : "1";
  const lastTwo = pageCount >= 2 ? `${last - 1}-${last}` : `${last}`;

  return [
    {
      name: "First page",
      settings: { ...DEFAULT_SETTINGS_EXTRACT, range: "1" } satisfies ExtractSettings,
    },
    {
      name: "Last page",
      settings: { ...DEFAULT_SETTINGS_EXTRACT, range: `${last}` } satisfies ExtractSettings,
    },
    {
      name: "First 2 pages",
      settings: { ...DEFAULT_SETTINGS_EXTRACT, range: firstTwo } satisfies ExtractSettings,
    },
    {
      name: "Last 2 pages",
      settings: { ...DEFAULT_SETTINGS_EXTRACT, range: lastTwo } satisfies ExtractSettings,
    },
    {
      name: "Odd pages",
      settings: { ...DEFAULT_SETTINGS_EXTRACT, range: "odd" as any } satisfies ExtractSettings, // handled by quick action
    },
    {
      name: "Even pages",
      settings: { ...DEFAULT_SETTINGS_EXTRACT, range: "even" as any } satisfies ExtractSettings, // handled by quick action
    },
  ];
}

export default function ExtractPDFPages() {
  const toolSlug = "extract-pdf-pages";

  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  const [settings, setSettings] = useState<ExtractSettings>(DEFAULT_SETTINGS_EXTRACT);

  const { toast } = useToast();

  // Moat: presets, last-settings, share link
  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as ExtractSettings);

  const moat = useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS_EXTRACT as Record<string, unknown>,
    recommendedPresets:
      pageCount && pageCount > 0
        ? buildRecommendedPresets(pageCount).map((p) => ({
            id: p.name,
            name: p.name,
            settings: p.settings as Record<string, unknown>,
          }))
        : [],
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
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

      setPdfFile({ file, name: file.name, size: file.size });
      setWorking(true);

      try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const count = doc.getPageCount();
        setPageCount(count);

        // Reasonable default: all pages
        setSettings((p) => ({ ...p, range: `1-${count}` }));

        toast({ title: "Loaded", description: `${count} pages detected.` });
      } catch (e: any) {
        setPdfFile(null);
        setPageCount(null);
        toast({
          title: "Failed to read PDF",
          description: e?.message ? String(e.message) : "Could not load this PDF.",
          variant: "destructive",
        });
      } finally {
        setWorking(false);
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
    setPageCount(null);
    setSettings(DEFAULT_SETTINGS_EXTRACT);
  };

  const canExtract = useMemo(() => !!pdfFile && !!pageCount && !working, [pdfFile, pageCount, working]);

  // Helpers that are “moat UX” (fast / no typing)
  const applyIndices = (indices: number[]) => {
    if (!pageCount) return;
    const filtered = indices.filter((i) => i >= 0 && i < pageCount);
    setSettings((p) => ({ ...p, range: indicesToRange(filtered) }));
  };

  const quickSelectAll = () => {
    if (!pageCount) return;
    setSettings((p) => ({ ...p, range: `1-${pageCount}` }));
  };

  const quickClear = () => setSettings((p) => ({ ...p, range: "" }));

  const quickFirst = () => applyIndices([0]);

  const quickLast = () => {
    if (!pageCount) return;
    applyIndices([pageCount - 1]);
  };

  const quickOdd = () => {
    if (!pageCount) return;
    const idx = Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 1);
    applyIndices(idx);
  };

  const quickEven = () => {
    if (!pageCount) return;
    const idx = Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 0);
    applyIndices(idx);
  };

  const quickInvert = () => {
    if (!pageCount) return;
    try {
      const selected = parsePageRange(settings.range, pageCount);
      const setSel = new Set(selected);
      const inv = Array.from({ length: pageCount }, (_, i) => i).filter((i) => !setSel.has(i));
      applyIndices(inv);
    } catch {
      // if current range invalid, invert means select all
      quickSelectAll();
    }
  };

  const normalizeRangeToIndices = (rawRange: string): number[] => {
    if (!pageCount) return [];
    const cleaned = rawRange.trim().toLowerCase();

    // Small moat: allow "odd"/"even" shortcuts
    if (cleaned === "odd") return Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 1);
    if (cleaned === "even") return Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 0);

    const parsed = parsePageRange(rawRange, pageCount);

    if (settings.keepDuplicates) {
      // keepDuplicates is tricky because parsePageRange de-dupes.
      // If user wants duplicates, we need to parse without set.
      // We’ll implement a simple “duplicate-aware” mode only for comma singles/ranges.
      // If malformed, fall back to parsed.
      try {
        const noSpaces = rawRange.replace(/\s+/g, "");
        const parts = noSpaces.split(",").filter(Boolean);
        const out: number[] = [];
        for (const part of parts) {
          if (part.includes("-")) {
            const [a, b] = part.split("-");
            const start = Number(a);
            const end = Number(b);
            if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) continue;
            const lo = Math.min(start, end);
            const hi = Math.max(start, end);
            for (let p = lo; p <= hi; p++) {
              if (p >= 1 && p <= pageCount) out.push(p - 1);
            }
          } else {
            const p = Number(part);
            if (Number.isFinite(p) && p >= 1 && p <= pageCount) out.push(p - 1);
          }
        }
        return out.length ? out : parsed;
      } catch {
        return parsed;
      }
    }

    return parsed;
  };

  const extractNow = async () => {
    if (!pdfFile || !pageCount) return;

    setWorking(true);

    try {
      const indices = normalizeRangeToIndices(settings.range);

      if (!indices.length) throw new Error("No pages selected.");

      const ordered = settings.orderMode === "reverse" ? [...indices].reverse() : indices;

      const srcBytes = await pdfFile.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes);

      // Output: single PDF
      if (settings.outputMode === "single") {
        const outDoc = await PDFDocument.create();
        const copied = await outDoc.copyPages(srcDoc, ordered);
        copied.forEach((p) => outDoc.addPage(p));

        const outBytes = await outDoc.save();
        downloadBlob(
          `${baseName(pdfFile.name)}-extracted.pdf`,
          new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
        );

        toast({ title: "Done!", description: "Extracted PDF downloaded." });
        moat.recordJob();
        return;
      }

      // Output: split into PDFs + zip
      const zip = new JSZip();

      for (let i = 0; i < ordered.length; i++) {
        const pageIndex = ordered[i];
        const singleDoc = await PDFDocument.create();
        const [page] = await singleDoc.copyPages(srcDoc, [pageIndex]);
        singleDoc.addPage(page);

        const bytes = await singleDoc.save();
        const filename = `page-${String(pageIndex + 1).padStart(3, "0")}.pdf`;
        zip.file(filename, bytes);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(`${baseName(pdfFile.name)}-pages.zip`, zipBlob);

      toast({ title: "Done!", description: "ZIP with extracted pages downloaded." });
      moat.recordJob();
    } catch (e: any) {
      toast({
        title: "Extraction failed",
        description: e?.message ? String(e.message) : "Something went wrong extracting pages.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ToolLayout title="Extract PDF Pages" description="Pick only the pages you need and download a new PDF — private.">
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

          <Card className="p-4 mt-3 bg-muted/30">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <b>Moat tips</b>: Use presets + quick-select buttons to avoid typing ranges. Split to ZIP is perfect for
                sending single pages.
              </div>
            </div>
          </Card>
        </div>

        {/* Left: upload + controls */}
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
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-7 w-7 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(pdfFile.size)} {pageCount ? `• ${pageCount} pages` : ""}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={working} aria-label="Remove file">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick actions (moat UX) */}
              {pageCount ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={quickSelectAll} disabled={working}>
                    Select all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={quickClear} disabled={working}>
                    Clear
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={quickFirst} disabled={working}>
                    First
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={quickLast} disabled={working}>
                    Last
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={quickOdd} disabled={working}>
                    Odd
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={quickEven} disabled={working}>
                    Even
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={quickInvert} disabled={working}>
                    Invert
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Pages to extract</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={settings.range}
                  onChange={(e) => setSettings((p) => ({ ...p, range: e.target.value }))}
                  disabled={!pageCount || working}
                  placeholder="e.g. 1-3,5,8-10"
                />
                <div className="text-xs text-muted-foreground">
                  Example: <b>1-3,5,8-10</b> • Shortcuts: <b>odd</b>, <b>even</b>
                </div>
              </div>

              {/* Output options (tool-native moat) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Output</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.outputMode}
                    onChange={(e) => setSettings((p) => ({ ...p, outputMode: e.target.value as any }))}
                    disabled={working}
                  >
                    <option value="single">Single PDF</option>
                    <option value="split-zip">Split into PDFs (ZIP)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Order</div>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={settings.orderMode}
                    onChange={(e) => setSettings((p) => ({ ...p, orderMode: e.target.value as any }))}
                    disabled={working}
                  >
                    <option value="keep">Keep selection order</option>
                    <option value="reverse">Reverse order</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={settings.keepDuplicates}
                  onCheckedChange={(v) => setSettings((p) => ({ ...p, keepDuplicates: Boolean(v) }))}
                  disabled={working}
                />
                Keep duplicates (advanced)
              </label>
            </Card>
          )}

          <Button onClick={extractNow} disabled={!canExtract} className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Working...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4 mr-2" />
                Extract Pages
              </>
            )}
          </Button>
        </div>

        {/* Right: info */}
        <div className="order-2 lg:order-3 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload your PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>
                  Type page ranges like <b>1-3,5</b> or use quick buttons
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a new PDF (or ZIP with single pages)</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Runs fully in your browser (private)</li>
              <li>• Ranges, single pages, odd/even shortcuts</li>
              <li>• Quick-select buttons (select all, invert, etc.)</li>
              <li>• Output as single PDF or split pages as ZIP</li>
              <li>• Moat: presets + last settings + shareable link</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
