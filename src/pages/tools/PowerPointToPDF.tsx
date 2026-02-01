import { useState, useCallback, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { jsPDF } from "jspdf";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Trash2, Presentation, Download, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

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

export default function PowerpointToPDF() {
  const [presentations, setPresentations] = useState<PowerpointFile[]>([]);
  const [converting, setConverting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);

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

  const convertToPDF = async () => {
    if (presentations.length === 0) {
      toast.error("Please add at least one presentation");
      return;
    }

    setConverting(true);
    setProgress({ current: 0, total: presentations.length, label: "Creating preview PDF…" });

    try {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 40;

      for (let i = 0; i < presentations.length; i++) {
        const ppt = presentations[i];

        if (i > 0) pdf.addPage();

        setProgress({ current: i + 1, total: presentations.length, label: `Adding: ${ppt.name}` });

        // Header
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.text("PowerPoint → PDF (Preview)", margin, 70);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.text(`File: ${ppt.name}`, margin, 105);
        pdf.text(`Size: ${formatMB(ppt.size)}`, margin, 125);
        pdf.text(`Created: ${new Date().toLocaleString()}`, margin, 145);

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
        pdf.setFontSize(10);
        pdf.setTextColor(120);
        pdf.text(`Preview page ${i + 1} of ${presentations.length}`, margin, pageH - 30);
        pdf.setTextColor(0);
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      // replace old
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);

      setPdfUrl(url);
      toast.success("Preview PDF created!");
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
      <div className="grid lg:grid-cols-2 gap-8">
        {/* LEFT */}
        <div className="space-y-6">
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
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">About this tool</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Browser-only PPT/PPTX → PDF conversion needs a slide renderer. This current version generates a **preview
              PDF** (one page per uploaded file) so you can keep the UI/flow working.
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
