import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Shapes, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Browser-compatible SVG optimizer using regex transformations
function optimizeSvg(svg: string): string {
  return svg
    // Remove XML declaration
    .replace(/<\?xml[^?]*\?>/gi, "")
    // Remove DOCTYPE
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove editor metadata (Inkscape, Illustrator, etc.)
    .replace(/\s*(inkscape|sodipodi|xmlns:inkscape|xmlns:sodipodi)[^=]*="[^"]*"/gi, "")
    .replace(/\s*(sketch|xmlns:sketch)[^=]*="[^"]*"/gi, "")
    .replace(/\s*data-name="[^"]*"/gi, "")
    // Remove empty groups
    .replace(/<g[^>]*>\s*<\/g>/gi, "")
    // Remove empty defs
    .replace(/<defs[^>]*>\s*<\/defs>/gi, "")
    // Remove metadata element
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    // Remove title and desc if empty or whitespace only
    .replace(/<title>\s*<\/title>/gi, "")
    .replace(/<desc>\s*<\/desc>/gi, "")
    // Collapse whitespace
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    // Remove unnecessary spaces in tags
    .replace(/\s+>/g, ">")
    .replace(/<\s+/g, "<")
    // Clean up self-closing tags
    .replace(/\s+\/>/g, "/>")
    // Remove default values
    .replace(/\s+fill-opacity="1"/gi, "")
    .replace(/\s+stroke-opacity="1"/gi, "")
    .replace(/\s+opacity="1"/gi, "")
    // Simplify colors
    .replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/gi, "#$1$2$3")
    // Remove trailing/leading whitespace
    .trim();
}

export default function SvgOptimizer() {
  const [name, setName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [working, setWorking] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    if (!isSvg) {
      toast({ title: "Only SVG", description: "Upload an .svg file.", variant: "destructive" });
      return;
    }
    setName(file.name);
    const text = await file.text();
    setInput(text);
    setOutput("");
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "image/svg+xml": [".svg"] },
  });

  const clear = () => {
    setName(null);
    setInput("");
    setOutput("");
  };

  const run = async () => {
    if (!input.trim()) {
      toast({ title: "Add SVG", description: "Upload or paste SVG content.", variant: "destructive" });
      return;
    }

    setWorking(true);
    try {
      const result = optimizeSvg(input);
      setOutput(result);
      const saved = input.length - result.length;
      const pct = input.length > 0 ? ((saved / input.length) * 100).toFixed(1) : "0";
      toast({ title: "Optimized", description: `Reduced by ${saved} chars (${pct}%)` });
    } catch (e: any) {
      toast({ title: "Optimize failed", description: e?.message ? String(e.message) : "Error optimizing SVG.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const download = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (name ? name.replace(/\.svg$/i, "") : "optimized") + "-optimized.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const copyOut = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Optimized SVCV copied to clipboard." });
  };

  return (
    <ToolLayout title="SVG Optimizer" description="Optimize SVG files to reduce size — client-side.">
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
              <p className="text-lg font-medium">Drop SVG here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shapes className="h-5 w-5 text-primary" />
                <div className="font-medium">{name || "Paste SVG below"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={clear} disabled={working}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <textarea
              className="w-full min-h-[220px] rounded-md border bg-background p-3 text-sm font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="<svg>...</svg>"
              disabled={working}
            />

            <Button onClick={run} disabled={working} className="w-full">
              {working ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                "Optimize SVG"
              )}
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Output</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={copyOut} disabled={!output}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button size="sm" onClick={download} disabled={!output}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            <textarea
              className="w-full min-h-[380px] rounded-md border bg-background p-3 text-sm font-mono"
              value={output}
              readOnly
              placeholder="Optimized SVG will appear here"
            />

            {output && (
              <div className="text-xs text-muted-foreground">
                Original: {input.length} chars • Optimized: {output.length} chars • Saved: {input.length - output.length} chars
              </div>
            )}
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
