import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, BookOpen, Loader2, BookmarkPlus, Trash2, Wand2, ListOrdered } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import jsPDF from "jspdf";
import ePub from "epubjs";
import type { Book } from "epubjs";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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

type PageSize = "a4" | "letter";
type ThemePreset = "clean" | "book" | "compact";

interface UploadFile {
  file: File;
  name: string;
  size: number;
}

type ExportPreset = {
  id: string;
  name: string;
  kind: "built-in" | "custom";
  data: {
    pageSize: PageSize;
    fontSize: number;
    lineSpacing: number; // multiplier, e.g. 1.2 - 1.6
    margins: number; // pt
    includeTitlePage: boolean;
    includeTOC: boolean;
    chapterRange: string; // "all" | "1-5" | "2,4,7-9"
    removeHyphenation: boolean;
    collapseWhitespace: boolean;
    theme: ThemePreset;
  };
};

const PRESETS_KEY = "tool.ebook_to_pdf.presets.v1";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function baseName(name: string) {
  return name.replace(/\.(epub|mobi|azw3)$/i, "") || "ebook";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// very simple HTML -> text
function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function normalizeText(raw: string, opts: { removeHyphenation: boolean; collapseWhitespace: boolean }) {
  let t = raw || "";
  // Common EPUB artifacts:
  // remove soft hyphen (U+00AD)
  t = t.replace(/\u00AD/g, "");
  if (opts.removeHyphenation) {
    // Join "hyphen linebreak" words: "exam-\nple" => "example"
    t = t.replace(/(\w)-\s*\n\s*(\w)/g, "$1$2");
  }
  if (opts.collapseWhitespace) {
    t = t.replace(/[ \t]+/g, " ");
    t = t.replace(/\n{3,}/g, "\n\n");
  }
  return t.trim();
}

function parseRange(range: string, max: number): number[] {
  const r = (range || "").trim().toLowerCase();
  if (!r || r === "all") return Array.from({ length: max }, (_, i) => i + 1);

  const out = new Set<number>();
  const parts = r
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= max) out.add(n);
      continue;
    }
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      if (a > b) [a, b] = [b, a];
      a = clamp(a, 1, max);
      b = clamp(b, 1, max);
      for (let i = a; i <= b; i++) out.add(i);
    }
  }

  const arr = [...out].sort((a, b) => a - b);
  return arr.length ? arr : Array.from({ length: max }, (_, i) => i + 1);
}

const BUILT_IN_PRESETS: ExportPreset[] = [
  {
    id: "p_clean_a4",
    name: "Clean A4 (default)",
    kind: "built-in",
    data: {
      pageSize: "a4",
      fontSize: 11,
      lineSpacing: 1.35,
      margins: 48,
      includeTitlePage: true,
      includeTOC: true,
      chapterRange: "all",
      removeHyphenation: true,
      collapseWhitespace: true,
      theme: "clean",
    },
  },
  {
    id: "p_book_like",
    name: "Book-like (bigger margins)",
    kind: "built-in",
    data: {
      pageSize: "a4",
      fontSize: 12,
      lineSpacing: 1.45,
      margins: 64,
      includeTitlePage: true,
      includeTOC: true,
      chapterRange: "all",
      removeHyphenation: true,
      collapseWhitespace: true,
      theme: "book",
    },
  },
  {
    id: "p_compact_print",
    name: "Compact (less pages)",
    kind: "built-in",
    data: {
      pageSize: "letter",
      fontSize: 10,
      lineSpacing: 1.2,
      margins: 40,
      includeTitlePage: false,
      includeTOC: true,
      chapterRange: "all",
      removeHyphenation: true,
      collapseWhitespace: true,
      theme: "compact",
    },
  },
  {
    id: "p_ch1_5_preview",
    name: "Preview (chapters 1–5)",
    kind: "built-in",
    data: {
      pageSize: "a4",
      fontSize: 11,
      lineSpacing: 1.35,
      margins: 48,
      includeTitlePage: true,
      includeTOC: true,
      chapterRange: "1-5",
      removeHyphenation: true,
      collapseWhitespace: true,
      theme: "clean",
    },
  },
];

export default function EbookToPDF() {
  const [uploaded, setUploaded] = useState<UploadFile | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Settings (moat)
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [fontSize, setFontSize] = useState(11);
  const [lineSpacing, setLineSpacing] = useState(1.35);
  const [margins, setMargins] = useState(48);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeTOC, setIncludeTOC] = useState(true);
  const [chapterRange, setChapterRange] = useState<string>("all");
  const [removeHyphenation, setRemoveHyphenation] = useState(true);
  const [collapseWhitespace, setCollapseWhitespace] = useState(true);
  const [theme, setTheme] = useState<ThemePreset>("clean");

  // Moat: chapter info
  const [chapterCount, setChapterCount] = useState<number>(0);

  // Presets (moat)
  const [customPresets, setCustomPresets] = useState<ExportPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Premium dialogs
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [deletePresetDialogOpen, setDeletePresetDialogOpen] = useState(false);
  const [draftPresetName, setDraftPresetName] = useState("");
  const [presetToDeleteId, setPresetToDeleteId] = useState<string>("");

  const { toast } = useToast();

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  useEffect(() => {
    const stored = safeParse<ExportPreset[]>(localStorage.getItem(PRESETS_KEY), []);
    setCustomPresets(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isEpub = file.name.toLowerCase().endsWith(".epub");
      if (!isEpub) {
        toast({
          title: "EPUB only (client-side)",
          description: "Upload an .epub file. MOBI/AZW3 needs a backend.",
          variant: "destructive",
        });
        return;
      }

      setUploaded({ file, name: file.name, size: file.size });
      setBook(null);
      setChapterCount(0);

      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const b = ePub(arrayBuffer);
        await b.ready;
        setBook(b);

        // estimate chapter count from spine
        const spine = b.spine as any;
        const spineItems = spine?.items || spine?.spineItems || [];
        setChapterCount(spineItems.length || 0);

        toast({
          title: "Loaded",
          description: "EPUB loaded. You can apply presets or export.",
        });
      } catch (e: any) {
        toast({
          title: "Failed to load EPUB",
          description: e?.message ? String(e.message) : "Could not open this EPUB file.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "application/epub+zip": [".epub"] },
  });

  const clearFile = () => {
    setUploaded(null);
    setBook(null);
    setChapterCount(0);
  };

  const canExport = useMemo(
    () => !!book && !!uploaded && !loading && !generating,
    [book, uploaded, loading, generating],
  );

  const isCustomPresetSelected = useMemo(() => {
    if (!selectedPresetId) return false;
    return customPresets.some((p) => p.id === selectedPresetId);
  }, [selectedPresetId, customPresets]);

  const applyPreset = (presetId: string) => {
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return;

    const d = preset.data;
    setPageSize(d.pageSize);
    setFontSize(d.fontSize);
    setLineSpacing(d.lineSpacing);
    setMargins(d.margins);
    setIncludeTitlePage(d.includeTitlePage);
    setIncludeTOC(d.includeTOC);
    setChapterRange(d.chapterRange);
    setRemoveHyphenation(d.removeHyphenation);
    setCollapseWhitespace(d.collapseWhitespace);
    setTheme(d.theme);

    toast({ title: "Preset applied", description: preset.name });
  };

  const openSavePreset = () => {
    setDraftPresetName("My export preset");
    setSavePresetDialogOpen(true);
  };

  const confirmSavePreset = () => {
    const name = draftPresetName.trim();
    if (!name) {
      toast({ title: "Missing name", description: "Please enter a preset name." });
      return;
    }

    const next: ExportPreset = {
      id: uid(),
      name,
      kind: "custom",
      data: {
        pageSize,
        fontSize,
        lineSpacing,
        margins,
        includeTitlePage,
        includeTOC,
        chapterRange,
        removeHyphenation,
        collapseWhitespace,
        theme,
      },
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
    // Simple heuristic: larger books => smaller font + compact spacing
    if (uploaded && uploaded.size > 8 * 1024 * 1024) {
      setTheme("compact");
      setFontSize(10);
      setLineSpacing(1.2);
      setMargins(40);
      setIncludeTitlePage(false);
      setIncludeTOC(true);
      toast({ title: "Recommended", description: "Compact settings for smaller output." });
      return;
    }
    setTheme("clean");
    setFontSize(11);
    setLineSpacing(1.35);
    setMargins(48);
    setIncludeTitlePage(true);
    setIncludeTOC(true);
    toast({ title: "Recommended", description: "Clean settings for best readability." });
  };

  const exportToPDF = async () => {
    if (!book || !uploaded) return;

    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: pageSize });
      const margin = clamp(margins, 28, 96);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;

      const lh = clamp(lineSpacing, 1.1, 1.8);
      const lineHeight = fontSize * lh;

      // Theme (lightweight: font choice + title style)
      const fontFamily = theme === "book" ? "times" : "times";
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(fontSize);

      // Metadata title
      const metaTitle = (book.packaging?.metadata as any)?.title || baseName(uploaded.name);

      let y = margin;

      // Optional title page
      if (includeTitlePage) {
        doc.setFont(fontFamily, "bold");
        doc.setFontSize(Math.min(22, fontSize + 10));
        const titleLines = doc.splitTextToSize(String(metaTitle), maxWidth);
        // center-ish vertically for title page
        y = Math.max(margin, pageHeight * 0.3);
        titleLines.forEach((ln: string) => {
          doc.text(ln, margin, y);
          y += (fontSize + 10) * 1.2;
        });

        // new page after title
        doc.addPage();
        y = margin;
        doc.setFont(fontFamily, "normal");
        doc.setFontSize(fontSize);
      } else {
        // small title header at top
        doc.setFont(fontFamily, "bold");
        doc.setFontSize(Math.min(16, fontSize + 6));
        const titleLines = doc.splitTextToSize(String(metaTitle), maxWidth);
        titleLines.forEach((ln: string) => {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(ln, margin, y);
          y += lineHeight;
        });
        y += lineHeight * 0.25;
        doc.setFont(fontFamily, "normal");
        doc.setFontSize(fontSize);
      }

      // Spine chapters
      const spine = book.spine as any;
      const spineItems = spine?.items || spine?.spineItems || [];
      if (spineItems.length === 0) throw new Error("No readable chapters found in this EPUB.");

      const chapterIdxs = parseRange(chapterRange, spineItems.length);

      // Optional TOC page (simple: chapter numbers only)
      if (includeTOC) {
        doc.setFont(fontFamily, "bold");
        doc.setFontSize(Math.min(16, fontSize + 4));
        doc.text("Table of contents", margin, y);
        y += lineHeight * 1.2;

        doc.setFont(fontFamily, "normal");
        doc.setFontSize(fontSize);

        const tocLines: string[] = chapterIdxs.map((n) => `Chapter ${n}`);
        for (const ln of tocLines) {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(ln, margin, y);
          y += lineHeight;
        }

        doc.addPage();
        y = margin;
      }

      // Export chapters
      for (let ix = 0; ix < chapterIdxs.length; ix++) {
        const chapterNumber = chapterIdxs[ix];
        const item = spineItems[chapterNumber - 1];
        if (!item) continue;

        const chapter = await book.load(item.href);
        const rawText = stripHtml(String(chapter));
        const text = normalizeText(rawText, { removeHyphenation, collapseWhitespace });

        if (!text) continue;

        // Chapter heading
        doc.setFont(fontFamily, "bold");
        doc.setFontSize(Math.min(14, fontSize + 3));
        const heading = `Chapter ${chapterNumber}`;
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(heading, margin, y);
        y += lineHeight * 1.1;

        doc.setFont(fontFamily, "normal");
        doc.setFontSize(fontSize);

        const paragraphs = text.split(/\n{2,}/g);
        for (const p of paragraphs) {
          const para = p.replace(/\s+/g, " ").trim();
          if (!para) {
            y += lineHeight;
            continue;
          }

          const lines = doc.splitTextToSize(para, maxWidth);
          for (const ln of lines) {
            if (y > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(ln, margin, y);
            y += lineHeight;
          }
          y += lineHeight * 0.35;
        }

        // spacing between chapters
        y += lineHeight * 0.8;
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      }

      doc.save(`${baseName(uploaded.name)}.pdf`);
      toast({ title: "Exported!", description: "Your PDF has been downloaded." });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ? String(e.message) : "Something went wrong exporting this EPUB to PDF.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const summary = useMemo(() => {
    if (!uploaded) return null;
    return {
      file: uploaded.name,
      size: formatBytes(uploaded.size),
      chapters: chapterCount ? `${chapterCount} chapters` : "Chapters unknown",
      range: chapterRange.trim().toLowerCase() === "all" ? "All chapters" : `Chapters: ${chapterRange}`,
    };
  }, [uploaded, chapterCount, chapterRange]);

  return (
    <ToolLayout title="E-book to PDF" description="Convert EPUB e-books to a clean PDF — best-effort.">
      {/* Moat bar */}
      <div className="mb-6 bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_280px] items-stretch">
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
            <p className="text-xs text-muted-foreground mt-2">Presets save export settings for 1-click reuse.</p>
          </div>

          <div className="min-w-0">
            <Label>Chapter range</Label>
            <Input
              value={chapterRange}
              onChange={(e) => setChapterRange(e.target.value)}
              placeholder="all, 1-5, 2,4,7-9"
              disabled={loading || generating}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Export a subset for previews. Example: <span className="font-medium text-foreground">1-5</span>.
            </p>
          </div>

          <div className="min-w-0">
            <Label>Smart actions</Label>
            <div className="mt-2 grid gap-2">
              <Button
                variant="secondary"
                onClick={recommendSettings}
                disabled={!uploaded || loading || generating}
                className="w-full"
              >
                <Wand2 className="h-4 w-4 mr-2" /> Recommend settings
              </Button>
              <div className="text-xs text-muted-foreground">Chooses compact vs clean settings based on book size.</div>
            </div>
          </div>
        </div>
      </div>

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
              <p className="text-lg font-medium">Drop your EPUB here</p>
              <p className="text-sm text-muted-foreground mt-1">EPUB supported (MOBI needs backend)</p>
            </div>
          </Card>

          {uploaded && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{uploaded.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(uploaded.size)}
                      {chapterCount ? ` • ${chapterCount} chapters` : ""}
                      {chapterRange.trim().toLowerCase() !== "all" ? ` • ${chapterRange}` : ""}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={loading || generating}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Settings */}
          <Card className="p-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Page size</Label>
                <Select
                  value={pageSize}
                  onValueChange={(v) => setPageSize(v as PageSize)}
                  disabled={loading || generating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(v) => setTheme(v as ThemePreset)}
                  disabled={loading || generating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="book">Book-like</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Font size</Label>
                <span className="text-sm text-muted-foreground">{fontSize}</span>
              </div>
              <Slider
                value={[fontSize]}
                onValueChange={(v) => setFontSize(v[0] ?? 11)}
                min={9}
                max={18}
                step={1}
                disabled={loading || generating}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line spacing</Label>
                <span className="text-sm text-muted-foreground">{lineSpacing.toFixed(2)}×</span>
              </div>
              <Slider
                value={[Math.round(lineSpacing * 100)]}
                onValueChange={(v) => setLineSpacing(clamp((v[0] ?? 135) / 100, 1.1, 1.8))}
                min={110}
                max={180}
                step={5}
                disabled={loading || generating}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Margins</Label>
                <span className="text-sm text-muted-foreground">{margins}pt</span>
              </div>
              <Slider
                value={[margins]}
                onValueChange={(v) => setMargins(clamp(v[0] ?? 48, 28, 96))}
                min={28}
                max={96}
                step={4}
                disabled={loading || generating}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Title page</Label>
                  <p className="text-xs text-muted-foreground">Adds a clean cover/title page</p>
                </div>
                <Switch
                  checked={includeTitlePage}
                  onCheckedChange={setIncludeTitlePage}
                  disabled={loading || generating}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Table of contents</Label>
                  <p className="text-xs text-muted-foreground">Simple TOC page</p>
                </div>
                <Switch checked={includeTOC} onCheckedChange={setIncludeTOC} disabled={loading || generating} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Fix hyphenation</Label>
                  <p className="text-xs text-muted-foreground">Joins words split by line breaks</p>
                </div>
                <Switch
                  checked={removeHyphenation}
                  onCheckedChange={setRemoveHyphenation}
                  disabled={loading || generating}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Normalize spacing</Label>
                  <p className="text-xs text-muted-foreground">Cleans excessive whitespace</p>
                </div>
                <Switch
                  checked={collapseWhitespace}
                  onCheckedChange={setCollapseWhitespace}
                  disabled={loading || generating}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Note: This exports text as a readable PDF. Complex layouts, images, and special typography may not be
              preserved.
            </div>
          </Card>

          <Button onClick={exportToPDF} disabled={!canExport} className="w-full" size="lg">
            {loading || generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {loading ? "Loading..." : "Exporting..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to PDF
              </>
            )}
          </Button>

          {summary && (
            <Card className="p-4 bg-muted/50">
              <div className="flex items-start gap-3">
                <ListOrdered className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">Current export</div>
                  <div>{summary.file}</div>
                  <div>
                    {summary.size} • {summary.chapters}
                  </div>
                  <div>{summary.range}</div>
                </div>
              </div>
            </Card>
          )}
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
                <span>Upload an EPUB file</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract chapters and convert text</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a clean multi-page PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Moat features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Presets (built-in + saved)</li>
              <li>• Chapter range export (preview mode)</li>
              <li>• Smart “recommend settings”</li>
              <li>• Title page + simple TOC</li>
              <li>• Hyphenation + spacing cleanup</li>
              <li>• All local, no uploads</li>
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
              Save this export setup for one-click reuse (stored locally in your browser).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="presetName">Preset name</Label>
            <Input
              id="presetName"
              value={draftPresetName}
              onChange={(e) => setDraftPresetName(e.target.value)}
              placeholder="e.g. Compact print"
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
