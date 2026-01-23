import { useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { minify } from "html-minifier-terser";

export default function HtmlMinifier() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const { toast } = useToast();

  const run = async () => {
    if (!input.trim()) {
      toast({ title: "Add HTML", description: "Paste HTML to minify.", variant: "destructive" });
      return;
    }

    try {
      const out = await minify(input, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        minifyCSS: true,
        minifyJS: true,
        keepClosingSlash: true,
      });

      setOutput(out);
      toast({ title: "Minified", description: "HTML minified successfully." });
    } catch (e: any) {
      toast({ title: "Minify failed", description: e?.message ? String(e.message) : "Error minifying HTML.", variant: "destructive" });
    }
  };

  const copyOut = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Minified HTML copied." });
  };

  const download = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "minified.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <ToolLayout title="HTML Minifier" description="Minify HTML to reduce size — client-side.">
      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Input</h3>
          <textarea
            className="w-full min-h-[420px] rounded-md border bg-background p-3 text-sm font-mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="<!doctype html>..."
          />
          <Button onClick={run} className="w-full">Minify HTML</Button>
        </Card>

        <Card className="p-6 space-y-4">
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
            className="w-full min-h-[420px] rounded-md border bg-background p-3 text-sm font-mono"
            value={output}
            readOnly
            placeholder="Minified HTML appears here"
          />
        </Card>
      </div>
    </ToolLayout>
  );
}
