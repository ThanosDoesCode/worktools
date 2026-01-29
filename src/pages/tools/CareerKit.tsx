import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PenTool, FileUser, Mail, Download, Copy, Trash2, Plus, X, Undo2, Briefcase, Sparkles } from "lucide-react";
import { toast } from "sonner";

/* -----------------------------
   Premium Utility Components
------------------------------*/
const GradientText = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-gradient-to-r from-[#D1FF00] via-[#FFFFFF] to-[#D1FF00] bg-clip-text text-transparent animate-gradient-x">
    {children}
  </span>
);

const PremiumCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <Card className={`bg-[#111111]/50 border-[#222222] backdrop-blur-xl shadow-2xl ${className}`}>{children}</Card>
);

/* -----------------------------
   Helper Functions
------------------------------*/
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard", {
    style: { background: "#D1FF00", color: "#000", fontWeight: "bold" },
  });
}

/* -----------------------------
   Signature Generator (Mobile Optimized)
------------------------------*/
type Point = { x: number; y: number };
type Stroke = { points: Point[]; width: number; color: string };

function SignatureGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#D1FF00");
  const [bgColor, setBgColor] = useState("#000000");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState("John Doe");
  const [typedSize, setTypedSize] = useState(56);
  const [typedStyle, setTypedStyle] = useState<"cursive" | "serif" | "modern">("cursive");

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    if (mode === "draw") {
      ctx.strokeStyle = "rgba(209, 255, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, h * 0.7);
      ctx.lineTo(w - 20, h * 0.7);
      ctx.stroke();
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.forEach((s) => {
      if (s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `220px`;
    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
    drawAll();
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [mode, bgColor]);

  useEffect(() => {
    drawAll();
  }, [strokes, penWidth, penColor]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setStrokes((prev) => [...prev, { points: [pos], width: penWidth, color: penColor }]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || mode !== "draw") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setStrokes((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, points: [...last.points, pos] }];
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12">
      <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
        <PremiumCard className="p-6">
          <div className="flex gap-2 mb-6">
            <Button
              className="flex-1 rounded-full"
              variant={mode === "draw" ? "default" : "outline"}
              onClick={() => setMode("draw")}
            >
              Draw
            </Button>
            <Button
              className="flex-1 rounded-full"
              variant={mode === "type" ? "default" : "outline"}
              onClick={() => setMode("type")}
            >
              Type
            </Button>
          </div>

          <div className="space-y-6">
            {mode === "draw" ? (
              <>
                <div className="space-y-3">
                  <Label className="text-zinc-400 uppercase tracking-widest text-[10px]">Brush Weight</Label>
                  <Slider value={[penWidth]} onValueChange={(v) => setPenWidth(v[0])} min={1} max={10} />
                </div>
                <div className="flex gap-3">
                  {["#D1FF00", "#FFFFFF", "#FF3E82"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      className={`w-10 h-10 rounded-full border-2 ${penColor === c ? "border-white" : "border-transparent"}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Input
                className="bg-black/50 border-zinc-800 h-14 text-xl"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Full Name"
              />
            )}

            <Button
              className="w-full h-14 text-lg font-bold bg-[#D1FF00] text-black hover:bg-[#D1FF00]/90"
              onClick={() => toast.success("Exported!")}
            >
              <Download className="mr-2 h-5 w-5" /> Export Signature
            </Button>
          </div>
        </PremiumCard>
      </div>

      <div className="lg:col-span-7 order-1 lg:order-2">
        <div
          ref={wrapRef}
          className="relative group overflow-hidden rounded-3xl border border-[#222222] bg-black aspect-[16/9] lg:h-full flex items-center justify-center"
        >
          {mode === "draw" ? (
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => setIsDrawing(false)}
              className="touch-none cursor-crosshair w-full h-full"
            />
          ) : (
            <div
              className={`text-center transition-all duration-500 hover:scale-105 ${typedStyle === "cursive" ? "font-serif italic" : "font-sans"}`}
              style={{ fontSize: `${typedSize}px`, color: penColor }}
            >
              {typedName}
            </div>
          )}
          <div className="absolute top-4 right-4 flex gap-2">
            <Button size="icon" variant="secondary" className="rounded-full bg-black/50" onClick={() => setStrokes([])}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Career Suite Application
------------------------------*/
export default function CareerSuite() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans selection:bg-[#D1FF00] selection:text-black">
      {/* Editorial Header */}
      <header className="max-w-7xl mx-auto mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D1FF00]/30 bg-[#D1FF00]/5 text-[#D1FF00] text-xs font-bold tracking-tighter uppercase">
          <Sparkles className="h-3 w-3" /> 2026 Pro Edition
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] text-balance">
          CAREER <GradientText>SUITE</GradientText>
        </h1>
        <p className="text-zinc-500 max-w-xl text-base md:text-xl font-medium leading-tight">
          Bespoke tools for the modern executive. Mobile-first, high-fidelity, zero friction.
        </p>
      </header>

      <main className="max-w-7xl mx-auto">
        <Tabs defaultValue="signature" className="space-y-6 md:space-y-10">
          <TabsList className="bg-[#111111] p-1 rounded-2xl md:rounded-full border border-[#222222] h-auto md:h-16 w-full flex flex-wrap md:flex-nowrap gap-1 md:gap-0">
            <TabsTrigger
              value="signature"
              className="flex-1 min-w-[80px] rounded-xl md:rounded-full px-3 md:px-8 py-3 md:py-0 text-sm md:text-base data-[state=active]:bg-[#D1FF00] data-[state=active]:text-black font-bold transition-all"
            >
              Signature
            </TabsTrigger>
            <TabsTrigger
              value="resume"
              className="flex-1 min-w-[80px] rounded-xl md:rounded-full px-3 md:px-8 py-3 md:py-0 text-sm md:text-base data-[state=active]:bg-[#D1FF00] data-[state=active]:text-black font-bold transition-all"
            >
              Resume
            </TabsTrigger>
            <TabsTrigger
              value="coverletter"
              className="flex-1 min-w-[80px] rounded-xl md:rounded-full px-3 md:px-8 py-3 md:py-0 text-sm md:text-base data-[state=active]:bg-[#D1FF00] data-[state=active]:text-black font-bold transition-all whitespace-nowrap"
            >
              Cover Letter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signature" className="outline-none focus:ring-0">
            <SignatureGenerator />
          </TabsContent>

          <TabsContent value="resume">
            <div className="grid lg:grid-cols-2 gap-10">
              <PremiumCard className="p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Briefcase className="text-[#D1FF00]" /> Intelligence Input
                </h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-zinc-500 font-bold">Full Identity</Label>
                    <Input
                      placeholder="E.g. Alexander Vance"
                      className="bg-black/40 border-zinc-800 rounded-xl h-12 focus:border-[#D1FF00] transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-zinc-500 font-bold">Target Position</Label>
                    <Input
                      placeholder="Senior Account Executive"
                      className="bg-black/40 border-zinc-800 rounded-xl h-12 focus:border-[#D1FF00] transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-zinc-500 font-bold">Narrative Summary</Label>
                    <Textarea
                      placeholder="Define your edge..."
                      className="bg-black/40 border-zinc-800 rounded-xl min-h-[120px] focus:border-[#D1FF00] transition-colors"
                    />
                  </div>
                  <Button className="w-full bg-white text-black font-black h-14 rounded-xl hover:bg-zinc-200">
                    <Plus className="mr-2" /> Add Experience Node
                  </Button>
                </div>
              </PremiumCard>

              <div className="relative">
                <div className="sticky top-10">
                  <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 min-h-[600px] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div className="border-b border-zinc-800 pb-6 mb-6">
                      <h2 className="text-3xl font-black uppercase tracking-tighter">Your Name</h2>
                      <p className="text-[#D1FF00] font-bold tracking-widest text-sm">SENIOR ROLE</p>
                    </div>
                    <div className="space-y-4 text-zinc-400 text-sm leading-relaxed">[ Live Editorial Preview ]</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="coverletter">
            <PremiumCard className="p-6 md:p-20 text-center border-dashed">
              <p className="text-zinc-500 font-mono italic text-sm md:text-base">Premium Cover Letter Engine Initializing...</p>
            </PremiumCard>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-7xl mx-auto mt-32 pt-10 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-600 text-sm font-medium">
        <p>© 2026 Bespoke Design Collective</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-[#D1FF00] transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-[#D1FF00] transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-[#D1FF00] transition-colors">
            Contact Support
          </a>
        </div>
      </footer>
    </div>
  );
}
