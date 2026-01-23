import { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Sparkles, Trash2 } from "lucide-react";

type Mode = "json" | "html" | "cssjs";

export default function CodeMinifyTools() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("json");
  const [input, setInput] = useState("");

  const output = useMemo(() => {
    if (!input.trim()) return "";
    try {
      if (mode === "json") {
        const obj = JSON.parse(input);
        // default to prettify (you can toggle later if you want)
        return JSON.stringify(obj, null, 2);
      }
      if (mode === "html") {
        // lightweight minifier: removes extra whitespace between tags and collapses runs
        return input
          .replace(/>\s+</g, "><")
          .replace(/\s{2,}/g, " ")
          .trim();
      }
      // css/js: lightweight minifier (safe-ish): remove comments + collapse whitespace
      return input
        .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
        .replace(/\/\/.*$/gm, "") // line comments
        .replace(/\s{2,}/g, " ")
        .replace(/\s*([{};,:()=+\-*/<>])\s*/g, "$1")
        .trim();
    } catch (e: any) {
      return `⚠️ Error: ${e?.message ? String(e.message) : "Invalid input"}`;
    }
  }, [input, mode]);

  const copyOut = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Output copied to clipboard." });
  };

  const clearAll = () => setInput("");

  const isError = output.startsWith("⚠️ Error:");

  return (
    <ToolLayout title="Minify & Prettify" description="JSON prettifier + lightweight HTML/CSS/JS minifiers — client-side.">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="json">JSON</TabsTrigger>
                <TabsTrigger className="flex-1" value="html">HTML</TabsTrigger>
                <TabsTrigger className="flex-1" value="cssjs">CSS/JS</TabsTrigger>
              </TabsList>

              <TabsContent value={mode} className="mt-6 space-y-4">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === "json"
                      ? `Paste JSON here...`
                      : mode === "html"
                      ? `Paste HTML here...`
                      : `Paste CSS or JS here...`
                  }
                  className="min-h-[260px]"
                />

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={copyOut} disabled={!output || isError}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Output
                  </Button>
                  <Button variant="ghost" onClick={clearAll} disabled={!input}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {mode === "json" ? "Prettify" : "Minify"}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Output</h3>
            <pre className={`rounded-md border p-4 text-sm overflow-auto min-h-[260px] ${isError ? "text-destructive" : ""}`}>
              {output || "Paste input to see output..."}
            </pre>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• JSON uses real parsing (safe and accurate).</li>
              <li>• HTML/CSS/JS are lightweight minifiers (not full production bundler-level).</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
