import { useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JsonMinifierPrettifier() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const { toast } = useToast();

  const minify = () => {
    try {
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj));
      toast({ title: "Minified", description: "JSON minified successfully." });
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e?.message ? String(e.message) : "Check your JSON.", variant: "destructive" });
    }
  };

  const prettify = () => {
    try {
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj, null, 2));
      toast({ title: "Prettified", description: "JSON formatted successfully." });
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e?.message ? String(e.message) : "Check your JSON.", variant: "destructive" });
    }
  };

  const copyOut = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Output copied to clipboard." });
  };

  const download = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "output.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const clear = () => {
    setInput("");
    setOutput("");
  };

  return (
    <ToolLayout title="JSON Minifier / Prettifier" description="Minify JSON for size or prettify it for readability.">
      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Input</h3>
          <textarea
            className="w-full min-h-[420px] rounded-md border bg-background p-3 text-sm font-mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"hello":"world"}'
          />
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={minify}>Minify</Button>
            <Button variant="secondary" onClick={prettify}>Prettify</Button>
            <Button variant="ghost" onClick={clear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
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
            placeholder="Result will appear here"
          />
        </Card>
      </div>
    </ToolLayout>
  );
}
