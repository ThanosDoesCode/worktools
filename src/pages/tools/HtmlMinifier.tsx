import { useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Browser-compatible HTML minifier using regex
function minifyHtml(html: string): string {
  return html
    // Remove HTML comments (but keep conditional comments)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    // Collapse whitespace between tags
    .replace(/>\s+</g, "><")
    // Collapse multiple spaces/newlines to single space
    .replace(/\s+/g, " ")
    // Remove spaces around = in attributes
    .replace(/\s*=\s*/g, "=")
    // Remove unnecessary quotes around simple attribute values
    .replace(/="([^"'\s>]+)"/g, (_, val) => {
      // Only remove quotes if value doesn't need them
      if (/^[a-zA-Z0-9_-]+$/.test(val)) return `=${val}`;
      return `="${val}"`;
    })
    // Remove trailing spaces before >
    .replace(/\s+>/g, ">")
    // Remove leading spaces after <
    .replace(/<\s+/g, "<")
    .trim();
}

export default function HtmlMinifier() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const { toast } = useToast();

  const run = () => {
    if (!input.trim()) {
      toast({ title: "Add HTML", description: "Paste HTML to minify.", variant: "destructive" });
      return;
    }

    try {
      const out = minifyHtml(input);
      setOutput(out);

      const saved = input.length - out.length;
      const pct = input.length > 0 ? ((saved / input.length) * 100).toFixed(1) : "0";
      toast({ title: "Minified", description: `Reduced by ${saved} chars (${pct}%)` });
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
          {output && (
            <div className="text-xs text-muted-foreground">
              Original: {input.length} chars • Minified: {output.length} chars • Saved: {input.length - output.length} chars
            </div>
          )}
        </Card>
      </div>
    </ToolLayout>
  );
}
