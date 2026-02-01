import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Crop, Loader2, FileText, BookmarkPlus, Trash2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PDFFile {
  file: File;
  name: string;
  size: number;
}

type Unit = "pt" | "mm" | "cm" | "in";
type CropPresetKind = "built-in" | "custom";

type CropPreset = {
  id: string;
  name: string;
  kind: CropPresetKind;
  data: {
    unit: Unit;
    top: number;
    right: number;
    bottom: number;
    left: number;
    pageRange: string; // "all" | "1-5" | "1,3,7-9"
  };
};

const PRESETS_KEY = "tool.crop_pdf.presets.v1";

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

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function unitToPt(value: number, unit: Unit): number {
  // 1in = 72pt
  // 1cm = 28.3464567pt
  // 1mm = 2.83464567pt
  if (!value) return 0;
  switch (unit) {
    case "in":
      return value * 72;
    case "cm":
      return value * 28.3464567;
    case "mm":
      return value * 2.83464567;
    default:
      return value; // pt
  }
}

function ptToUnit(pt: number, unit: Unit): number {
  if (!pt) return 0;
  switch (unit) {
    case "in":
      return pt / 72;
    case "cm":
      return pt / 28.3464567;
    case "mm":
      return pt / 2.83464567;
    default:
      return pt;
  }
}

function fmtUnit(value: number, unit: Unit) {
  // nicer display for non-pt
  const v = unit === "pt" ? Math.round(value) : Math.round(value * 100) / 100;
  return `${v}${unit}`;
}

function parsePageRange(range: string, totalPages: number): number[] {
  const r = (range || "").trim().toLowerCase();
  if (!r || r === "all") return Array.from({ length: totalPages }, (_, i) => i + 1);

  const out = new Set<number>();
  const parts = r
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= totalPages) out.add(n);
      continue;
    }
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      if (a > b) [a, b] = [b, a];
      a = clamp(a, 1, totalPages);
      b = clamp(b, 1, totalPages);
      for (let i = a; i <= b; i++) out.add(i);
    }
  }

  const arr = [...out].sort((a, b) => a - b);
  return arr.length ? arr : Array.from({ length: totalPages }, (_, i) => i + 1);
}

const BUILT_IN_PRESETS: CropPreset[] = [
  {
    id: "p_tight_5mm",
    name: "Tight margins (5mm)",
    kind: "built-in",
    data: { unit: "mm", top: 5, right: 5, bottom: 5, left: 5, pageRange: "all" },
  },
  {
    id: "p_standard_1cm",
    name: "Standard margins (1cm)",
    kind: "built-in",
    data: { unit: "cm", top: 1, right: 1, bottom: 1, left: 1, pageRange: "all" },
  },
  {
    id: "p_print_safe_15mm",
    name: "Print safe (15mm)",
    kind: "built-in",
    data: { unit: "mm", top: 15, right: 15, bottom: 15, left: 15, pageRange: "all" },
  },
  {
    id: "p_header_footer_trim",
    name: "Trim header/footer (top/bottom 12mm)",
    kind: "built-in",
    data: { unit: "mm", top: 12, right: 0, bottom: 12, left: 0, pageRange: "all" },
  },
  {
    id: "p_preview_1_3",
    name: "Quick preview (pages 1–3)",
    kind: "built-in",
    data: { unit: "mm", top: 8, right: 8, bottom: 8, left: 8, pageRange: "1-3" },
  },
];

export default function CropPDF() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [working, setWorking] = useState(false);

  // Units + crop values (stored in UI unit)
  const [unit, setUnit] = useState<Unit>("pt");
  const [top, setTop] = useState(18);
  const [right, setRight] = useState(18);
  const [bottom, setBottom] = useState(18);
  const [left, setLeft] = useState(18);

  // Moat: page range
  const [pageRange, setPageRange] = useState<string>("all");

  // Moat: presets
  const [customPresets, setCustomPresets] = useState<CropPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Premium dialogs
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [deletePresetDialogOpen, setDeletePresetDialogOpen] = useState(false);
  const [draftPresetName, setDraftPresetName] = useState("");
  const [presetToDeleteId, setPresetToDeleteId] = useState<string>("");

  const { toast } = useToast();

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  useEffect(() => {
    const stored = safeParse<CropPreset[]>(localStorage.getItem(PRESETS_KEY), []);
    setCustomPresets(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast({ title: "Only PDFs supported", description: "Upload a .pdf file.", variant: "destructive" });
        return;
      }

      setPdfFile({ file, name: file.name, size: file.size });
      toast({ title: "PDF loaded", description: "Choose a preset or enter margins, then crop." });
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => setPdfFile(null);

  const canCrop = useMemo(() => !!pdfFile && !working, [pdfFile, working]);

  const isCustomPresetSelected = useMemo(() => {
    if (!selectedPresetId) return false;
    return customPresets.some((p) => p.id === selectedPresetId);
  }, [selectedPresetId, customPresets]);

  const applyPreset = (presetId: string) => {
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return;

    setUnit(preset.data.unit);
    setTop(preset.data.top);
    setRight(preset.data.right);
    setBottom(preset.data.bottom);
    setLeft(preset.data.left);
    setPageRange(preset.data.pageRange);

    toast({ title: "Preset applied", description: preset.name });
  };

  const openSavePreset = () => {
    setDraftPresetName("My crop preset");
    setSavePresetDialogOpen(true);
  };

  const confirmSavePreset = () => {
    const name = draftPresetName.trim();
    if (!name) {
      toast({ title: "Missing name", description: "Please enter a preset name." });
      return;
    }

    const next: CropPreset = {
      id: uid(),
      name,
      kind: "custom",
      data: { unit, top, right, bottom, left, pageRange },
    };

    setCustomPresets((prev) => [next, ...prev]);
    setSavePresetDialogOpen(false);
    setSelectedPresetId(next.id);
    toast({ title: "Preset saved", description: "Stored locally in this browser." });
  };

  const requestDeletePreset = (presetId: string) => {
    const p = allPresets.find((x) => x.id === presetId);
    if (!p || p.kind !== "custom") return;
    setPresetToDeleteId(presetId);
    setDeletePresetDialogOpen(true);
  };

  const confirmDeletePreset = () => {
    const id = presetToDeleteId;
    if (!id) return;
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    if (selectedPresetId === id) setSelectedPresetId("");
    setPresetToDeleteId("");
    setDeletePresetDialogOpen(false);
    toast({ title: "Preset deleted" });
  };

  const recommendSettings = () => {
    // Lightweight: set common “tight” margin for scanned docs
    setUnit("mm");
    setTop(8);
    setRight(8);
    setBottom(8);
    setLeft(8);
    setPageRange("all");
    toast({ title: "Recommended", description: "Applied a tight 8mm margin preset." });
  };

  const cropNow = async () => {
    if (!pdfFile) return;
    setWorking(true);

    try {
      const bytes = await pdfFile.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);

      const pages = doc.getPages();
      const totalPages = pages.length;
      const list = parsePageRange(pageRange, totalPages);

      // Convert UI values to points for PDF
      const topPt = unitToPt(Math.max(0, top), unit);
      const rightPt = unitToPt(Math.max(0, right), unit);
      const bottomPt = unitToPt(Math.max(0, bottom), unit);
      const leftPt = unitToPt(Math.max(0, left), unit);

      // Crop only selected pages; others remain unchanged
      for (const idx of list) {
        const page = pages[idx - 1];
        if (!page) continue;

        const w = page.getWidth();
        const h = page.getHeight();

        const newX = clamp(leftPt, 0, w - 1);
        const newY = clamp(bottomPt, 0, h - 1);
        const newW = Math.max(1, w - leftPt - rightPt);
        const newH = Math.max(1, h - topPt - bottomPt);

        page.setCropBox(newX, newY, newW, newH);
      }

      const outBytes = await doc.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const suffix = pageRange.trim().toLowerCase() !== "all" ? `-pages-${pageRange.replace(/\s+/g, "")}` : "";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(pdfFile.name)}${suffix}-cropped.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "Done!", description: "Cropped PDF downloaded." });
    } catch (e: any) {
      toast({
        title: "Crop failed",
        description: e?.message ? String(e.message) : "Something went wrong cropping the PDF.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const convertedPreview = useMemo(() => {
    // Display a small hint: what the current values mean in points
    const t = unitToPt(Math.max(0, top), unit);
    const r = unitToPt(Math.max(0, right), unit);
    const b = unitToPt(Math.max(0, bottom), unit);
    const l = unitToPt(Math.max(0, left), unit);
    return { t, r, b, l };
  }, [top, right, bottom, left, unit]);

  return (
    <ToolLayout title="Crop PDF" description="Crop margins on selected pages and download a new PDF.">
      {/* Moat bar */}
      <div className="mb-6 bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="grid gap-3 lg:grid-cols-3 items-start">
          <div className="min-w-0">
            <Label>Presets</Label>
            <Select
              value={selectedPresetId}
              onValueChange={(val) => {
                setSelectedPresetId(val);
                if (val) applyPreset(val);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Apply a preset" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Built-in</div>
                {BUILT_IN_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs text-muted-foreground mt-1">Your presets</div>
                {customPresets.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No saved presets yet</div>
                ) : (
                  customPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <Button variant="outline" onClick={openSavePreset} className="w-full">
                <BookmarkPlus className="h-4 w-4 mr-2" /> Save preset
              </Button>
              <Button
                variant="outline"
                onClick={() => requestDeletePreset(selectedPresetId)}
                disabled={!selectedPresetId || !isCustomPresetSelected}
                title="Delete selected custom preset"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2">Presets save your margins + unit + page range.</p>
          </div>

          <div className="min-w-0">
            <Label>Page range</Label>
            <Input value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="all, 1-5, 1,3,7-9" />
            <p className="text-xs text-muted-foreground mt-2">
              Example: <span className="font-medium text-foreground">1-3</span> to crop only the first pages.
            </p>
          </div>

          <div className="min-w-0">
            <Label>Smart actions</Label>
            <div className="mt-2 grid gap-2">
              <Button variant="secondary" onClick={recommendSettings} disabled={working} className="w-full">
                <Wand2 className="h-4 w-4 mr-2" /> Recommend margins
              </Button>
              <div className="text-xs text-muted-foreground">
                Applies a tight default that works well for scanned documents.
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-7 w-7 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(pdfFile.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={working} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="text-sm text-muted-foreground">
                Units: <span className="font-medium text-foreground">{unit.toUpperCase()}</span>.{" "}
                <span className="hidden sm:inline">72pt = 1 inch • 28.35pt ≈ 1cm</span>
              </div>

              <div className="w-full sm:w-[180px]">
                <Label className="sr-only">Unit</Label>
                <Select
                  value={unit}
                  onValueChange={(v) => {
                    const next = v as Unit;
                    // keep the same real-world crop by converting values through points
                    const tPt = unitToPt(top, unit);
                    const rPt = unitToPt(right, unit);
                    const bPt = unitToPt(bottom, unit);
                    const lPt = unitToPt(left, unit);

                    setUnit(next);
                    setTop(ptToUnit(tPt, next));
                    setRight(ptToUnit(rPt, next));
                    setBottom(ptToUnit(bPt, next));
                    setLeft(ptToUnit(lPt, next));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">pt</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Top ({unit})</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={top}
                  min={0}
                  max={unit === "pt" ? 500 : 50}
                  step={unit === "pt" ? 1 : 0.5}
                  onChange={(e) => setTop(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Right ({unit})</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={right}
                  min={0}
                  max={unit === "pt" ? 500 : 50}
                  step={unit === "pt" ? 1 : 0.5}
                  onChange={(e) => setRight(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Bottom ({unit})</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={bottom}
                  min={0}
                  max={unit === "pt" ? 500 : 50}
                  step={unit === "pt" ? 1 : 0.5}
                  onChange={(e) => setBottom(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Left ({unit})</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={left}
                  min={0}
                  max={unit === "pt" ? 500 : 50}
                  step={unit === "pt" ? 1 : 0.5}
                  onChange={(e) => setLeft(Number(e.target.value))}
                  disabled={working}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Current crop (converted)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Top: {fmtUnit(top, unit)} ≈ {Math.round(convertedPreview.t)}pt
                </div>
                <div>
                  Right: {fmtUnit(right, unit)} ≈ {Math.round(convertedPreview.r)}pt
                </div>
                <div>
                  Bottom: {fmtUnit(bottom, unit)} ≈ {Math.round(convertedPreview.b)}pt
                </div>
                <div>
                  Left: {fmtUnit(left, unit)} ≈ {Math.round(convertedPreview.l)}pt
                </div>
              </div>
            </div>
          </Card>

          <Button onClick={cropNow} disabled={!canCrop} className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cropping...
              </>
            ) : (
              <>
                <Crop className="h-4 w-4 mr-2" />
                Crop PDF
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Crops by margins (same crop applied to selected pages).</li>
              <li>• Page range lets you crop only part of the PDF (e.g., 1-3).</li>
              <li>• Presets let you save margin setups for repeated use.</li>
              <li>• “Auto-trim to content” requires preview + heavier logic.</li>
              <li>• Runs fully in-browser (private).</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>
              Save this crop setup for one-click reuse (stored locally in your browser).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="presetName">Preset name</Label>
            <Input
              id="presetName"
              value={draftPresetName}
              onChange={(e) => setDraftPresetName(e.target.value)}
              placeholder="e.g. Tight scan crop"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSavePreset}>
              <BookmarkPlus className="h-4 w-4 mr-2" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Preset Dialog */}
      <AlertDialog open={deletePresetDialogOpen} onOpenChange={setDeletePresetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
            <AlertDialogDescription>This removes the selected custom preset from this browser.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePreset}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolLayout>
  );
}
