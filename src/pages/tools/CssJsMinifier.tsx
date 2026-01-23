import { useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Trash2, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Lang = "css" | "js";

function minifyCss(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove block comments
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/\s*([{}:;,>+~])\s*/g, "$1") // remove space around selectors/rules
    .replace(/;}/g, "}") // remove trailing semicolons
    .trim();
}

function minifyJs(code: string): string {
  return code
    .replace(/\/\/.*$/gm, "") // remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove block comments
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/\s*([{}();,=:+\-*/<>!&|?])\s*/g, "$1") // remove space around operators
    .trim();
}

export default function CssJsMinifier() {
  const [lang, setLang] = useState<Lang>("css");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleMinify = () => {
    if (!input.trim()) {
      toast({ title: "Empty input", description: "Paste some code first.", variant: "destructive" });
      return;
    }
    const result = lang === "css" ? minifyCss(input) : minifyJs(input);
    setOutput(result);

    const saved = input.length - result.length;
    const pct = input.length > 0 ? ((saved / input.length) * 100).toFixed(1) : "0";
    toast({ title: "Minified", description: `Reduced by ${saved} chars (${pct}%)` });
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    setInput("");
    setOutput("");
  };

  return (
    <ToolLayout title="CSS/JS Minifier" description="Minify CSS or JavaScript code — fast, private, client-side.">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant={lang === "css" ? "default" : "outline"}
                onClick={() => setLang("css")}
                className="flex-1"
              >
                CSS
              </Button>
              <Button
                variant={lang === "js" ? "default" : "outline"}
                onClick={() => setLang("js")}
                className="flex-1"
              >
                JavaScript
              </Button>
            </div>

            <Textarea
              placeholder={`Paste your ${lang.toUpperCase()} code here...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />

            <div className="flex gap-2">
              <Button onClick={handleMinify} className="flex-1">
                <FileCode className="h-4 w-4 mr-2" />
                Minify
              </Button>
              <Button variant="outline" onClick={reset}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          {output && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Minified Output</h3>
                <Button variant="ghost" size="sm" onClick={copyOutput}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Textarea
                readOnly
                value={output}
                className="min-h-[150px] font-mono text-sm bg-muted/50"
              />
              <div className="text-xs text-muted-foreground">
                Original: {input.length} chars • Minified: {output.length} chars • Saved:{" "}
                {input.length - output.length} chars
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                <span>Choose CSS or JavaScript</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                <span>Paste your code</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                <span>Copy minified output</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Privacy</h3>
            <p className="text-sm text-muted-foreground">
              All minification runs locally in your browser. Your code never leaves your device.
            </p>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
