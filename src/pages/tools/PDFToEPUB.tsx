import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, BookOpen, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import JSZip from "jszip";
import { saveAs } from "file-saver";

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

type Settings = {
  // Output structure
  chapterMode: "page" | "chunk"; // page = one xhtml per page, chunk = fewer chapters by larger chunks
  maxCharsPerChunk: number; // used when chapterMode=chunk

  // Metadata
  language: string; // dc:language (BCP-47-ish)
  includePageHeadings: boolean; // include "Page N" headings
};

const DEFAULT_SETTINGS: Settings = {
  chapterMode: "page",
  maxCharsPerChunk: 12000,
  language: "en",
  includePageHeadings: true,
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "Reliable (1 chapter per page)", settings: { ...DEFAULT_SETTINGS, chapterMode: "page" } },
  {
    name: "Reader-friendly (chunked chapters)",
    settings: { ...DEFAULT_SETTINGS, chapterMode: "chunk", maxCharsPerChunk: 18000 },
  },
  { name: "Minimal headings", settings: { ...DEFAULT_SETTINGS, includePageHeadings: false } },
  { name: "Swedish metadata", settings: { ...DEFAULT_SETTINGS, language: "sv" } },
];

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "book";
}

function escapeXml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function uuidLike() {
  return `urn:uuid:${crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function chunkIntoParagraphs(text: string) {
  const t = normalizeText(text);
  if (!t) return [];
  const parts: string[] = [];
  const max = 900;

  let buf = t;
  while (buf.length > max) {
    const cut = buf.lastIndexOf(". ", max);
    const idx = cut > 200 ? cut + 1 : max;
    parts.push(buf.slice(0, idx).trim());
    buf = buf.slice(idx).trim();
  }
  if (buf) parts.push(buf);

  return parts;
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

export default function PDFToEPUB() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  // Moat settings (share/save)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-to-epub";

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

  const extractTextByPage = async (pdf: any, totalPages: number) => {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      setProgress({ current: pageNumber, total: totalPages });

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const strings = (textContent.items as any[])
        .map((it) => (typeof it.str === "string" ? it.str : ""))
        .filter(Boolean);

      pageTexts.push(normalizeText(strings.join(" ")));
    }
    return pageTexts;
  };

  const buildXhtml = (title: string, heading: string | null, bodyParas: string[]) => {
    const body =
      bodyParas.length > 0
        ? bodyParas.map((p) => `<p>${escapeXml(p)}</p>`).join("\n")
        : `<p><em>No selectable text found. If this PDF is scanned, run OCR first.</em></p>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(settings.language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  ${heading ? `<h2>${escapeXml(heading)}</h2>` : ""}
  ${body}
</body>
</html>`;
  };

  const convertToEPUB = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const titleBase = baseName(pdfFile.name);
      const bookId = uuidLike();

      const pageTexts = await extractTextByPage(pdf, totalPages);

      // Build EPUB (ZIP)
      const zip = new JSZip();

      // 1) mimetype MUST be first + uncompressed
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

      // 2) META-INF/container.xml
      zip.folder("META-INF")!.file(
        "container.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      );

      const oebps = zip.folder("OEBPS")!;

      // Basic CSS
      oebps.file(
        "styles.css",
        `body { font-family: serif; line-height: 1.6; }
h1,h2 { font-family: sans-serif; }
p { margin: 0 0 1em; }`,
      );

      // Manifest/spine/nav
      const manifestItems: string[] = [
        `<item id="css" href="styles.css" media-type="text/css"/>`,
        `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
      ];
      const spineItems: string[] = [];
      const navLinks: string[] = [];

      const addChapter = (chapterIndex: number, displayName: string, text: string, heading?: string | null) => {
        const fileName = `chapter-${String(chapterIndex).padStart(3, "0")}.xhtml`;
        const itemId = `c${chapterIndex}`;

        const paras = chunkIntoParagraphs(text);
        const xhtml = buildXhtml(`${titleBase} — ${displayName}`, heading ?? displayName, paras);

        oebps.file(fileName, xhtml);
        manifestItems.push(`<item id="${itemId}" href="${fileName}" media-type="application/xhtml+xml"/>`);
        spineItems.push(`<itemref idref="${itemId}"/>`);
        navLinks.push(`<li><a href="${fileName}">${escapeXml(displayName)}</a></li>`);
      };

      if (settings.chapterMode === "page") {
        for (let i = 0; i < pageTexts.length; i++) {
          const pageNum = i + 1;
          const display = `Page ${pageNum}`;
          const heading = settings.includePageHeadings ? `Page ${pageNum}` : null;
          addChapter(pageNum, display, pageTexts[i], heading);
        }
      } else {
        // Chunked chapters: merge pages into larger chapters for nicer reading
        let buf = "";
        let startPage = 1;
        let chapter = 1;

        const flush = () => {
          if (!buf.trim()) return;
          const endPage = startPage + (buf ? 0 : 0);
          const display = `Pages ${startPage}–${Math.max(startPage, currentPageForDisplay)}`;
          const heading = settings.includePageHeadings ? display : null;
          addChapter(chapter, display, buf, heading);
          chapter++;
          buf = "";
        };

        // keep a separate counter for display, because startPage changes after flush
        let currentPageForDisplay = 1;

        for (let i = 0; i < pageTexts.length; i++) {
          const pageNum = i + 1;
          currentPageForDisplay = pageNum;

          const t = pageTexts[i];
          const add = t ? `${t}\n` : "";
          if (!buf.trim()) startPage = pageNum;

          if ((buf + add).length > settings.maxCharsPerChunk && buf.trim()) {
            flush();
            startPage = pageNum;
          }

          buf += add || "";
        }
        if (buf.trim()) {
          const display = `Pages ${startPage}–${currentPageForDisplay}`;
          const heading = settings.includePageHeadings ? display : null;
          addChapter(chapter, display, buf, heading);
        }
      }

      // nav.xhtml (EPUB 3)
      oebps.file(
        "nav.xhtml",
        `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(settings.language)}">
<head>
  <meta charset="utf-8" />
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>Contents</h1>
    <ol>
      ${navLinks.join("\n")}
    </ol>
  </nav>
</body>
</html>`,
      );

      // content.opf
      oebps.file(
        "content.opf",
        `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(titleBase)}</dc:title>
    <dc:language>${escapeXml(settings.language)}</dc:language>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    ${spineItems.join("\n    ")}
  </spine>
</package>`,
      );

      setProgress({ current: totalPages, total: totalPages });

      const epubBlob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/epub+zip",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });

      saveAs(epubBlob, `${titleBase}.epub`);

      toast({ title: "Done!", description: "Downloaded EPUB file." });

      moat.recordJob();
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to EPUB.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  const chapterModeLabel =
    settings.chapterMode === "page" ? "Per-page chapters (reliable)" : "Chunked chapters (reader-friendly)";

  return (
    <ToolLayout
      title="PDF to EPUB (Text-based)"
      description="Convert selectable PDF text into a reflowable EPUB e-book."
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

          <Card className="p-4 bg-muted/30 border border-border">
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <b>Moat</b> saves/share EPUB settings (chapter mode, language, headings). It does <b>not</b> store your
                PDF.
              </div>
            </div>
          </Card>
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
                  <BookOpen className="h-8 w-8 text-primary shrink-0" />
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
                <p className="text-sm font-medium">Chapter mode</p>
                <p className="text-xs text-muted-foreground">{chapterModeLabel}</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.chapterMode}
                onChange={(e) => setSettings((p) => ({ ...p, chapterMode: e.target.value as Settings["chapterMode"] }))}
                disabled={converting}
              >
                <option value="page">Per page</option>
                <option value="chunk">Chunked</option>
              </select>
            </div>

            {settings.chapterMode === "chunk" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Max characters per chapter</label>
                <input
                  type="number"
                  min={3000}
                  max={60000}
                  step={1000}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={settings.maxCharsPerChunk}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      maxCharsPerChunk: clampInt(Number(e.target.value || 12000), 3000, 60000),
                    }))
                  }
                  disabled={converting}
                />
                <p className="text-xs text-muted-foreground">Bigger = fewer chapters (usually nicer in EPUB readers)</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Language (metadata)</label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.language}
                onChange={(e) => setSettings((p) => ({ ...p, language: e.target.value }))}
                disabled={converting}
              >
                <option value="en">English (en)</option>
                <option value="sv">Swedish (sv)</option>
                <option value="el">Greek (el)</option>
                <option value="de">German (de)</option>
                <option value="fr">French (fr)</option>
                <option value="es">Spanish (es)</option>
                <option value="it">Italian (it)</option>
                <option value="pt">Portuguese (pt)</option>
                <option value="nl">Dutch (nl)</option>
                <option value="pl">Polish (pl)</option>
                <option value="tr">Turkish (tr)</option>
                <option value="ru">Russian (ru)</option>
                <option value="uk">Ukrainian (uk)</option>
                <option value="ar">Arabic (ar)</option>
                <option value="he">Hebrew (he)</option>
                <option value="hi">Hindi (hi)</option>
                <option value="zh">Chinese (zh)</option>
                <option value="ja">Japanese (ja)</option>
                <option value="ko">Korean (ko)</option>
              </select>
              <p className="text-xs text-muted-foreground">This is EPUB metadata; it doesn’t translate the text.</p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Include headings</p>
                <p className="text-xs text-muted-foreground">Show “Page N” / “Pages A–B” at the top of each chapter.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settings.includePageHeadings}
                onChange={(e) => setSettings((p) => ({ ...p, includePageHeadings: e.target.checked }))}
                disabled={converting}
              />
            </div>
          </Card>

          <Button onClick={convertToEPUB} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download EPUB
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
                <span>Upload your PDF file</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract selectable text (best for non-scanned PDFs)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a valid EPUB 3 e-book</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Output is text-based and reflowable (great for reading)</li>
              <li>• If the PDF is scanned (images), you must run OCR first</li>
              <li>• “Language” is metadata only (no translation)</li>
              <li>• Everything runs locally in your browser</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
