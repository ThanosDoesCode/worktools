import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import mammoth from "mammoth";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface DocxFile {
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
  return name.replace(/\.(docx|doc)$/i, "") || "document";
}

export default function WordToPDF() {
  const [docx, setDocx] = useState<DocxFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isDocx =
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx");

      if (!isDocx) {
        toast({
          title: "DOCX only (for now)",
          description: "Upload a .docx file. Old .doc is not supported client-side.",
          variant: "destructive",
        });
        return;
      }

      setDocx({ file, name: file.name, size: file.size });
      setPreviewHtml("");

      try {
        const arrayBuffer = await file.arrayBuffer();

        // DOCX -> HTML (preserves basic styling)
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Title'] => h1:fresh",
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Heading 4'] => h4:fresh",
            ],
          },
        );

        setPreviewHtml(result.value || "");

        if (!result.value) {
          toast({
            title: "No content extracted",
            description: "Could not extract visible content from this DOCX.",
            variant: "destructive",
          });
        }
      } catch (e: any) {
        toast({
          title: "Failed to read DOCX",
          description: e?.message ? String(e.message) : "Could not process the DOCX file.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
  });

  const clearFile = () => {
    setDocx(null);
    setPreviewHtml("");
  };

  const canConvert = useMemo(() => !!docx && !!previewHtml && !converting, [docx, previewHtml, converting]);

  const convertNow = async () => {
    if (!docx || !previewHtml) return;
    setConverting(true);

    // Offscreen container for consistent rendering
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px"; // ~A4 at 96dpi
    container.style.background = "white";
    container.style.color = "black";
    container.style.padding = "48px";
    container.style.boxSizing = "border-box";
    container.style.overflow = "visible";
    container.style.height = "auto";

    // Better print-like styling + page-break hints
    container.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        body { margin:0; }
        .doc {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", sans-serif;
          font-size: 14px;
          line-height: 1.6;
        }
        h1 { font-size: 26px; margin: 18px 0 10px; line-height: 1.2; }
        h2 { font-size: 20px; margin: 16px 0 8px; line-height: 1.25; }
        h3 { font-size: 16px; margin: 14px 0 6px; line-height: 1.3; }
        p { margin: 0 0 10px; }
        ul, ol { margin: 0 0 10px 18px; padding: 0; }
        li { margin: 0 0 6px; break-inside: avoid; page-break-inside: avoid; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; break-inside: avoid; page-break-inside: avoid; }
        td, th { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
        a { color: #0b57d0; text-decoration: underline; }
        img { max-width: 100%; height: auto; display:block; margin: 10px 0; break-inside: avoid; page-break-inside: avoid; }
        figure, pre, blockquote { break-inside: avoid; page-break-inside: avoid; }
        blockquote { border-left: 3px solid #ddd; margin: 10px 0; padding-left: 10px; color: #444; }
        /* Keep headings with what follows */
        h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
      </style>
      <div class="doc">${previewHtml}</div>
    `;

    document.body.appendChild(container);

    try {
      async function capturePagesToPdf(root: HTMLDivElement, filename: string) {
        const pdf = new jsPDF("p", "pt", "a4");
        const pageWidthPt = pdf.internal.pageSize.getWidth();
        const pageHeightPt = pdf.internal.pageSize.getHeight();

        const pageWidthPx = root.clientWidth; // 794px
        const pageHeightPx = Math.floor((pageWidthPx * pageHeightPt) / pageWidthPt);

        const docEl = root.querySelector(".doc") as HTMLDivElement | null;
        if (!docEl) throw new Error("Missing .doc container");

        const blocks = Array.from(docEl.children) as HTMLElement[];
        if (blocks.length === 0) throw new Error("No content to convert");

        const pageWrap = document.createElement("div");
        pageWrap.className = "pagewrap";
        pageWrap.style.width = "100%";

        docEl.innerHTML = "";
        docEl.appendChild(pageWrap);

        let pageIndex = 0;
        const fits = () => pageWrap.scrollHeight <= pageHeightPx;

        const flushPage = async () => {
          const canvas = await html2canvas(root, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            windowWidth: pageWidthPx,
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.92);

          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, 0, pageWidthPt, pageHeightPt);

          pageIndex++;
        };

        let currentBlocks: HTMLElement[] = [];

        for (const block of blocks) {
          pageWrap.appendChild(block);
          currentBlocks.push(block);

          if (!fits()) {
            // Remove overflow block and render current page
            pageWrap.removeChild(block);
            currentBlocks.pop();

            // If page is empty (single huge element), render it anyway
            await flushPage();

            // Start new page with overflow block
            pageWrap.innerHTML = "";
            pageWrap.appendChild(block);
            currentBlocks = [block];
          }
        }

        if (currentBlocks.length > 0) {
          await flushPage();
        }

        pdf.save(filename);
      }

      await capturePagesToPdf(container, `${baseName(docx.name)}.pdf`);

      toast({ title: "Converted!", description: "Your PDF has been downloaded." });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting DOCX to PDF.",
        variant: "destructive",
      });
    } finally {
      container.remove();
      setConverting(false);
    }
  };

  return (
    <ToolLayout title="Word to PDF" description="Convert DOCX to a good-looking PDF (client-side, best-effort).">
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
              <p className="text-lg font-medium">Drop your DOCX here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Supports .docx (not .doc)</p>
            </div>
          </Card>

          {docx && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{docx.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(docx.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <Button onClick={convertNow} disabled={!canConvert} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Convert to PDF
              </>
            )}
          </Button>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Preview (best-effort)</h3>
            {previewHtml ? (
              <div className="prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a DOCX to see a preview here.</p>
            )}
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Pagination avoids splitting images and large blocks where possible</li>
              <li>• Complex Word layouts can still differ (columns, floating shapes, etc.)</li>
              <li>• Best for resumes, letters, essays, reports</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
