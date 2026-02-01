import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// PDF text extraction (PDF.js)
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// DOCX generation
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

export default function PDFToWord() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
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

      setPdfFile({ file, name: file.name });
      setProgress(null);
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

  const convertToWord = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const children: Paragraph[] = [];

      // Title + note (honest + free approach)
      children.push(
        new Paragraph({
          text: baseName(pdfFile.name),
          heading: HeadingLevel.TITLE,
        }),
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Text-first conversion (free, runs in your browser). Layout may differ from the original PDF.",
              italics: true,
            }),
          ],
        }),
      );

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const strings = (textContent.items as any[])
          .map((it) => (typeof it.str === "string" ? it.str : ""))
          .filter(Boolean);

        const pageText = strings.join(" ").replace(/\s+/g, " ").trim();

        children.push(
          new Paragraph({
            text: `Page ${pageNumber}`,
            heading: HeadingLevel.HEADING_2,
          }),
        );

        if (!pageText) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "(No selectable text found on this page. If this is a scan, use PDF OCR first.)",
                  italics: true,
                }),
              ],
            }),
          );
        } else {
          // Keep it readable: chunk into reasonable paragraph sizes
          const chunks: string[] = [];
          const maxLen = 1200;
          let buf = pageText;

          while (buf.length > maxLen) {
            const cut = buf.lastIndexOf(" ", maxLen);
            const idx = cut > 200 ? cut : maxLen;
            chunks.push(buf.slice(0, idx).trim());
            buf = buf.slice(idx).trim();
          }
          if (buf) chunks.push(buf);

          for (const chunk of chunks) {
            children.push(new Paragraph({ children: [new TextRun(chunk)] }));
          }
        }
      }

      const doc = new Document({
        sections: [{ properties: {}, children }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${baseName(pdfFile.name)}.docx`);

      toast({
        title: "Done!",
        description: "Your DOCX has been downloaded.",
      });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to Word (Text Extract)"
      description="Extract selectable text from a PDF and download an editable DOCX."
    >
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
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

          <Button onClick={convertToWord} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download DOCX
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload a PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract selectable text page by page</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download an editable DOCX</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Best for PDFs with real text (not scanned images)</li>
              <li>• Layout/tables may not match the original PDF</li>
              <li>• For scanned PDFs, run OCR first</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
