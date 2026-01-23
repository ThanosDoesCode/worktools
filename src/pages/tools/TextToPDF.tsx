import { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileCode, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import jsPDF from "jspdf";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";
type FontFamily = "helvetica" | "times" | "courier";

function baseName(name: string) {
  return (name || "text").replace(/\.[a-z0-9]+$/i, "") || "text";
}

export default function TextToPDF() {
  const [title, setTitle] = useState("Document");
  const [content, setContent] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [font, setFont] = useState<FontFamily>("times");
  const [fontSize, setFontSize] = useState(12);
  const [lineHeight, setLineHeight] = useState(1.35);
  const [margin, setMargin] = useState(48);
  const [generating, setGenerating] = useState(false);

  const { toast } = useToast();

  const canGenerate = useMemo(() => content.trim().length > 0 && !generating, [content, generating]);

  const generatePDF = async () => {
    if (!content.trim()) return;

    setGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: orientation === "portrait" ? "p" : "l",
        unit: "pt",
        format: pageSize,
      });

      doc.setFont(font);
      doc.setFontSize(fontSize);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const maxWidth = pageWidth - margin * 2;
      const linePx = fontSize * lineHeight;

      // Optional title
      let y = margin;
      if (title.trim()) {
        doc.setFont(font, "bold");
        doc.setFontSize(Math.min(18, fontSize + 4));
        const titleLines = doc.splitTextToSize(title.trim(), maxWidth);
        titleLines.forEach((ln: string) => {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(ln, margin, y);
          y += linePx;
        });
        y += linePx * 0.5;
        doc.setFont(font, "normal");
        doc.setFontSize(fontSize);
      }

      // Body
      const paragraphs = content.replace(/\r\n/g, "\n").split("\n");
      for (let p = 0; p < paragraphs.length; p++) {
        const para = paragraphs[p];

        // Blank line
        if (para.trim() === "") {
          y += linePx;
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          continue;
        }

        const lines = doc.splitTextToSize(para, maxWidth);

        for (const ln of lines) {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(ln, margin, y);
          y += linePx;
        }

        // Paragraph spacing
        y += linePx * 0.4;
      }

      const filename = `${baseName(title)}.pdf`;
      doc.save(filename);

      toast({ title: "Generated!", description: "Your PDF has been downloaded." });
    } catch (e: any) {
      toast({
        title: "Failed to generate",
        description: e?.message ? String(e.message) : "Something went wrong creating the PDF.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ToolLayout title="Text to PDF" description="Convert plain text or Markdown-style text into a clean PDF — client-side.">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <input
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My document"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Text</label>
              <textarea
                className="w-full min-h-[260px] rounded-md border bg-background p-3 text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your text here..."
              />
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Tip: Headings/lists aren’t “true Markdown” rendering — this is a clean text PDF.
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Page size</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                  disabled={generating}
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
                  disabled={generating}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Font</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={font}
                  onChange={(e) => setFont(e.target.value as FontFamily)}
                  disabled={generating}
                >
                  <option value="times">Times</option>
                  <option value="helvetica">Helvetica</option>
                  <option value="courier">Courier</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Font size</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={fontSize}
                  min={8}
                  max={24}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  disabled={generating}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Line height</div>
                <input
                  type="number"
                  step="0.05"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={lineHeight}
                  min={1}
                  max={2}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Margin (pt)</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={margin}
                  min={24}
                  max={96}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  disabled={generating}
                />
              </div>
            </div>
          </Card>

          <Button onClick={generatePDF} disabled={!canGenerate} className="w-full" size="lg">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
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
                <span>Paste or type your text</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Choose page settings and font</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a clean PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Runs fully in your browser</li>
              <li>• Multi-page auto wrapping</li>
              <li>• Basic title + formatting controls</li>
              <li>• Great for notes, drafts, essays</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
