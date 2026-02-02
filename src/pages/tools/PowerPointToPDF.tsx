import { useState, useCallback, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { jsPDF } from "jspdf";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Presentation, Trash2, Download, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

// MOAT
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

interface PowerpointFile {
  file: File;
  name: string;
  size: number;
}

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isPpt(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    file.type === "application/vnd.ms-powerpoint" ||
    name.endsWith(".pptx") ||
    name.endsWith(".ppt")
  );
}

type Settings = {
  pageFormat: "a4" | "letter";
  orientation: "portrait" | "landscape";
  includeFooter: boolean;
  includeTimestamp: boolean;
  marginPt: number; // points
  title: string; // header title
};

const DEFAULT_SETTINGS: Settings = {
  pageFormat: "a4",
  orientation: "portrait",
  includeFooter: true,
  includeTimestamp: true,
  marginPt: 40,
  title: "PowerPoint → PDF (Preview)",
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "A4 • Portrait • Default", settings: { ...DEFAULT_SETTINGS, pageFormat: "a4", orientation: "portrait" } },
  { name: "A4 • Landscape", settings: { ...DEFAULT_SETTINGS, pageFormat: "a4", orientation: "landscape" } },
  {
    name: "Letter • Portrait",
    settings: { ...DEFAULT_SETTINGS, pageFormat: "letter", orientation: "portrait" },
  },
  {
    name: "No footer",
    settings: { ...DEFAULT_SETTINGS, includeFooter: false },
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function PowerpointToPDF() {
  const [presentations, setPresentations] = useState<PowerpointFile[]>([]);
  const [converting, setConverting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  // MOAT settings (only settings get saved/shared; files never do)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "powerpoint-to-pdf";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  // cleanup pdfUrl on unmount / replace
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const pptFiles = acceptedFiles.filter(isPpt);

      if (pptFiles.length === 0) {
        toast.error("Please select valid PowerPoint files (.ppt, .pptx)");
        return;
      }

      setPresentations((prev) => [
        ...prev,
        ...pptFiles.map((file) => ({
          file,
          name: file.name,
          size: file.size,
        })),
      ]);

      // reset previous output
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      setProgress(null);

      toast.success(`Added ${pptFiles.length} file${pptFiles.length > 1 ? "s" : ""}`);
    },
    [pdfUrl],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.ms-powerpoint": [".ppt"],
    },
  });

  const removeFile = (index: number) => {
    setPresentations((prev) => prev.filter((_, i) => i !== index));
    toast.message("Removed file");
  };

  const clearAll = () => {
    setPresentations([]);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setProgress(null);
    toast.message("Cleared");
  };

  const totalSize = useMemo(() => presentations.reduce((acc, f) => acc + f.size, 0), [presentations]);

  const settingsSummary = useMemo(() => {
    const fmt = settings.pageFormat.toUpperCase();
    const o = settings.orientation === "portrait" ? "Portrait" : "Landscape";
    const footer = settings.includeFooter ? "Footer" : "No footer";
    return `${fmt} • ${o} • ${footer} • margin ${settings.marginPt}pt`;
  }, [settings]);

  const convertToPDF = async () => {
    if (presentations.length === 0) {
      toast.error("Please add at least one presentation");
      return;
    }

    setConverting(true);
    setProgress({ current: 0, total: presentations.length, label: "Creating preview PDF…" });

    try {
      const pdf = new jsPDF({
        unit: "pt",
        format: settings.pageFormat,
        orientation: settings.orientation,
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = clamp(settings.marginPt, 16, 120);

      for (let i = 0; i < presentations.length; i++) {
        const ppt = presentations[i];
        if (i > 0) pdf.addPage();

        setProgress({ current: i + 1, total: presentations.length, label: `Adding: ${ppt.name}` });

        // Header
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.text(settings.title || "PowerPoint → PDF (Preview)", margin, 70);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.text(`File: ${ppt.name}`, margin, 105);
        pdf.text(`Size: ${formatMB(ppt.size)}`, margin, 125);

        if (settings.includeTimestamp) {
          pdf.text(`Created: ${new Date().toLocaleString()}`, margin, 145);
        }

        // Divider
        pdf.setDrawColor(180);
        pdf.line(margin, 165, pageW - margin, 165);

        // Note
        pdf.setTextColor(90);
        pdf.setFontSize(11);
        const note =
          "This tool is currently a preview exporter. Browser-only conversion cannot reliably render real PPT/PPTX slides without a dedicated slide renderer or server-side conversion.";
        const wrapped = pdf.splitTextToSize(note, pageW - margin * 2);
        pdf.text(wrapped, margin, 200);
        pdf.setTextColor(0);

        // Footer
        if (settings.includeFooter) {
          pdf.setFontSize(10);
          pdf.setTextColor(120);
          pdf.text(`Preview page ${i + 1} of ${presentations.length}`, margin, pageH - 30);
          pdf.setTextColor(0);
        }
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      // replace old
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);

      setPdfUrl(url);
      toast.success("Preview PDF created!");
      moat.recordJob();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `presentations-preview-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Downloaded");
  };

  return (
    <ToolLayout title="PowerPoint to PDF" description="Convert PPT/PPTX presentations to PDF (preview exporter)">
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
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Presentation className="h-14 w-14 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">
                {isDragActive ? "Drop presentations here…" : "Drop PPT/PPTX here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Multiple files supported</p>
            </div>

            {presentations.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {presentations.length} file{presentations.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">Total: {formatMB(totalSize)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{settingsSummary}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearAll} disabled={converting}>
                    <Trash2 className="h-4 w-4 mr-2" /> Clear
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {presentations.map((ppt, idx) => (
                    <div key={`${ppt.name}-${idx}`} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Presentation className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{ppt.name}</div>
                        <div className="text-xs text-muted-foreground">{formatMB(ppt.size)}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(idx)} disabled={converting}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                {progress && (
                  <div className="text-xs text-muted-foreground">
                    {progress.label} ({progress.current}/{progress.total})
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Settings card (simple + MOAT friendly) */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Page size</p>
                <p className="text-xs text-muted-foreground">A4 for EU, Letter for US.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.pageFormat}
                onChange={(e) => setSettings((p) => ({ ...p, pageFormat: e.target.value as Settings["pageFormat"] }))}
                disabled={converting}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Orientation</p>
                <p className="text-xs text-muted-foreground">Preview pages layout.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.orientation}
                onChange={(e) => setSettings((p) => ({ ...p, orientation: e.target.value as Settings["orientation"] }))}
                disabled={converting}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Margin (pt)</p>
                <p className="text-xs text-muted-foreground">Space around text.</p>
              </div>
              <input
                type="number"
                min={16}
                max={120}
                step={4}
                className="h-10 w-24 rounded-md border bg-background px-3 text-sm text-right"
                value={settings.marginPt}
                onChange={(e) => setSettings((p) => ({ ...p, marginPt: clamp(Number(e.target.value || 0), 16, 120) }))}
                disabled={converting}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Footer</p>
                <p className="text-xs text-muted-foreground">Show page count at bottom.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settings.includeFooter}
                onChange={(e) => setSettings((p) => ({ ...p, includeFooter: e.target.checked }))}
                disabled={converting}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Timestamp</p>
                <p className="text-xs text-muted-foreground">Include creation time.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settings.includeTimestamp}
                onChange={(e) => setSettings((p) => ({ ...p, includeTimestamp: e.target.checked }))}
                disabled={converting}
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Header title</p>
              <input
                type="text"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={settings.title}
                onChange={(e) => setSettings((p) => ({ ...p, title: e.target.value }))}
                disabled={converting}
                placeholder="PowerPoint → PDF (Preview)"
              />
            </div>
          </Card>

          <div className="flex gap-3">
            {!pdfUrl ? (
              <Button
                onClick={convertToPDF}
                disabled={presentations.length === 0 || converting}
                className="flex-1"
                size="lg"
              >
                {converting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating PDF…
                  </>
                ) : (
                  <>Convert to PDF (Preview)</>
                )}
              </Button>
            ) : (
              <Button onClick={downloadPDF} className="flex-1" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="order-2 lg:order-3 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">About this tool</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Browser-only PPT/PPTX → PDF conversion needs a slide renderer. This current version generates a{" "}
              <b>preview PDF</b> (one page per uploaded file) so you can keep the UI/flow working.
            </p>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">To make it “real”</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Add a client-side PPTX renderer OR</li>
              <li>• Convert on a server (best quality)</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
