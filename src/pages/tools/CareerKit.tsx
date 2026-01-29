import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  PenTool,
  FileUser,
  Mail,
  Download,
  Copy,
  Trash2,
  Plus,
  X,
  Undo2,
  Briefcase,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

/* -----------------------------
   Premium Utility Components
   (Styled to match the rest of your tools)
------------------------------*/
const GradientText = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground bg-clip-text text-transparent">
    {children}
  </span>
);

const PremiumCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <Card className={`bg-background border-border shadow-sm ${className}`}>{children}</Card>
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
  toast.success("Copied to clipboard");
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
  const [penColor, setPenColor] = useState("#111111");
  const [bgColor, setBgColor] = useState("#FFFFFF");
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
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
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

  const exportSignature = async () => {
    try {
      if (mode === "type") {
        // Simple export of typed signature as text file (keeps this tool lightweight)
        const blob = new Blob([typedName], { type: "text/plain;charset=utf-8" });
        downloadBlob("signature.txt", blob);
        toast.success("Exported!");
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob("signature.png", blob);
        toast.success("Exported!");
      }, "image/png");
    } catch {
      toast.error("Could not export signature.");
    }
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
                  <Label className="text-muted-foreground uppercase tracking-widest text-[10px]">Brush Weight</Label>
                  <Slider value={[penWidth]} onValueChange={(v) => setPenWidth(v[0])} min={1} max={10} />
                </div>

                <div className="space-y-3">
                  <Label className="text-muted-foreground uppercase tracking-widest text-[10px]">Ink</Label>
                  <div className="flex gap-3">
                    {["#111111", "#2563EB", "#DC2626"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        className={`w-10 h-10 rounded-full border-2 ${
                          penColor === c ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ background: c }}
                        aria-label={`Ink ${c}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-muted-foreground uppercase tracking-widest text-[10px]">Background</Label>
                  <div className="flex gap-3">
                    {["#FFFFFF", "#F4F4F5", "#0A0A0A"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setBgColor(c)}
                        className={`w-10 h-10 rounded-full border-2 ${
                          bgColor === c ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ background: c }}
                        aria-label={`Background ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Full Name</Label>
                  <Input
                    className="h-14 text-xl"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Full Name"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Size</Label>
                  <Slider value={[typedSize]} onValueChange={(v) => setTypedSize(v[0])} min={28} max={90} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Style</Label>
                  <Select value={typedStyle} onValueChange={(v: any) => setTypedStyle(v)}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cursive">Cursive</SelectItem>
                      <SelectItem value="serif">Serif</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button className="w-full h-14 text-lg font-bold" onClick={exportSignature}>
              <Download className="mr-2 h-5 w-5" /> Export Signature
            </Button>
          </div>
        </PremiumCard>
      </div>

      <div className="lg:col-span-7 order-1 lg:order-2">
        <div
          ref={wrapRef}
          className="relative group overflow-hidden rounded-3xl border border-border bg-card aspect-[16/9] lg:h-full flex items-center justify-center"
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
              className={`text-center transition-all duration-500 hover:scale-105 ${
                typedStyle === "cursive" ? "font-serif italic" : typedStyle === "serif" ? "font-serif" : "font-sans"
              }`}
              style={{ fontSize: `${typedSize}px`, color: penColor }}
            >
              {typedName}
            </div>
          )}

          <div className="absolute top-4 right-4 flex gap-2">
            <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setStrokes([])}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Cover Letter Engine (ADDED)
------------------------------*/
function CoverLetterEngine() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [jobSource, setJobSource] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [topWins, setTopWins] = useState("");
  const [tone, setTone] = useState<"executive" | "direct" | "warm">("executive");
  const [generated, setGenerated] = useState("");

  const buildLetter = () => {
    const nameLine = fullName?.trim() ? fullName.trim() : "[Your Name]";
    const roleLine = role?.trim() ? role.trim() : "[Target Role]";
    const companyLine = company?.trim() ? company.trim() : "[Company]";
    const managerLine = hiringManager?.trim() ? `Dear ${hiringManager.trim()},` : "Dear Hiring Manager,";
    const sourceLine = jobSource?.trim()
      ? `I’m writing regarding the ${roleLine} role I saw via ${jobSource.trim()}.`
      : `I’m writing to apply for the ${roleLine} role at ${companyLine}.`;

    const wins = topWins
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 4);

    const winsBlock =
      wins.length > 0
        ? `\n\nHere are a few highlights that align with what ${companyLine} needs:\n${wins
            .map((w) => `• ${w}`)
            .join("\n")}\n`
        : "";

    const jdBlock = jobDescription?.trim()
      ? `\n\nBased on the role requirements you shared, I would focus immediately on:\n• Translating priorities into a clear execution plan\n• Improving speed-to-impact through tight operating rhythms and ownership\n• Building predictable results through pipeline, process, and coaching\n`
      : "";

    const closingByTone =
      tone === "executive"
        ? `\n\nIf it’s useful, I can walk you through how I would approach the first 30–60–90 days in the role and what I’d prioritize to deliver measurable outcomes.`
        : tone === "direct"
          ? `\n\nI’d welcome a quick call to discuss how I can help ${companyLine} hit the targets for this role.`
          : `\n\nI’d love the chance to speak and learn more about your priorities for this role and how I can contribute.`;

    const contactLine =
      email?.trim() || phone?.trim()
        ? `\n\nYou can reach me at${email?.trim() ? ` ${email.trim()}` : ""}${email?.trim() && phone?.trim() ? " or" : ""}${
            phone?.trim() ? ` ${phone.trim()}` : ""
          }.`
        : "";

    const letter = `${nameLine}
${email?.trim() ? email.trim() : "[Email]"}${phone?.trim() ? ` • ${phone.trim()}` : ""}

${managerLine}

${sourceLine}

I bring a strong track record of driving commercial performance, aligning teams to a clear strategy, and improving execution through simple systems that scale. I’m particularly interested in ${companyLine} because it’s a place where ownership, pace, and customer focus matter.

${winsBlock}${jdBlock}
In short: I help turn strategy into reliable growth—by clarifying the “what”, tightening the “how”, and ensuring the team has the tools, cadence, and accountability to perform.

${closingByTone}${contactLine}

Sincerely,
${nameLine}
`;

    setGenerated(letter);
    toast.success("Cover letter generated");
  };

  const downloadTxt = () => {
    const blob = new Blob([generated || ""], { type: "text/plain;charset=utf-8" });
    downloadBlob("cover-letter.txt", blob);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-10">
      <PremiumCard className="p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="text-primary" /> Cover Letter Inputs
        </h3>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Vance"
              className="rounded-xl h-12"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@email.com"
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +46 ..."
                className="rounded-xl h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Target Role</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Head of Leasing"
              className="rounded-xl h-12"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. SIXT"
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Hiring Manager</Label>
              <Input
                value={hiringManager}
                onChange={(e) => setHiringManager(e.target.value)}
                placeholder="Optional"
                className="rounded-xl h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Where you found it</Label>
            <Input
              value={jobSource}
              onChange={(e) => setJobSource(e.target.value)}
              placeholder="e.g. LinkedIn / Careers page"
              className="rounded-xl h-12"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Top wins (1 per line)</Label>
            <Textarea
              value={topWins}
              onChange={(e) => setTopWins(e.target.value)}
              placeholder={
                "e.g.\nGrew revenue +18% YoY\nBuilt a sales cadence that improved conversion by 22%\nLed a 15-person commercial team"
              }
              className="rounded-xl min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Job description (optional)</Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste key requirements here (optional)."
              className="rounded-xl min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Tone</Label>
            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-3 pt-2">
            <Button className="w-full h-12 rounded-xl font-bold" onClick={buildLetter}>
              <Sparkles className="mr-2 h-4 w-4" /> Generate
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 rounded-xl font-bold"
              onClick={() => {
                setGenerated("");
                toast.success("Cleared");
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
      </PremiumCard>

      <div className="relative">
        <div className="sticky top-10">
          <div className="rounded-3xl bg-card border border-border p-8 min-h-[600px] shadow-sm">
            <div className="border-b border-border pb-6 mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">Live Preview</h2>
                <p className="text-muted-foreground text-sm">Copy, download, or refine inputs.</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => {
                    if (!generated.trim()) return toast.error("Generate a cover letter first.");
                    copyToClipboard(generated);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => {
                    if (!generated.trim()) return toast.error("Generate a cover letter first.");
                    downloadTxt();
                    toast.success("Downloaded");
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {generated.trim() ? (
                generated
              ) : (
                <div className="text-muted-foreground">
                  [ Your cover letter will appear here after you generate it. ]
                </div>
              )}
            </div>
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
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-10 font-sans">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto mb-6">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/tools")}>
          <ArrowLeft className="h-4 w-4" /> Back to all tools
        </Button>
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted text-foreground text-xs font-bold tracking-tighter uppercase">
          <Sparkles className="h-3 w-3" /> Pro Edition
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] text-balance">
          CAREER <GradientText>SUITE</GradientText>
        </h1>

        <p className="text-muted-foreground max-w-xl text-base md:text-xl font-medium leading-tight">
          Practical career tools. Consistent styling with the rest of your tool suite.
        </p>
      </header>

      <main className="max-w-7xl mx-auto">
        <Tabs defaultValue="signature" className="space-y-6 md:space-y-10">
          {/* NOTE: responsiveness code preserved (same structure + responsive classes) */}
          <TabsList className="bg-muted p-1 rounded-2xl md:rounded-full border border-border h-auto md:h-16 w-full flex flex-wrap md:flex-nowrap gap-1 md:gap-0">
            <TabsTrigger
              value="signature"
              className="flex-1 min-w-[80px] rounded-xl md:rounded-full px-3 md:px-8 py-3 md:py-0 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"
            >
              Signature
            </TabsTrigger>
            <TabsTrigger
              value="resume"
              className="flex-1 min-w-[80px] rounded-xl md:rounded-full px-3 md:px-8 py-3 md:py-0 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"
            >
              Resume
            </TabsTrigger>
            <TabsTrigger
              value="coverletter"
              className="flex-1 min-w-[80px] rounded-xl md:rounded-full px-3 md:px-8 py-3 md:py-0 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all whitespace-nowrap"
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
                  <Briefcase className="text-primary" /> Intelligence Input
                </h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Full Identity</Label>
                    <Input placeholder="E.g. Alexander Vance" className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Target Position</Label>
                    <Input placeholder="Senior Account Executive" className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Narrative Summary</Label>
                    <Textarea placeholder="Define your edge..." className="rounded-xl min-h-[120px]" />
                  </div>
                  <Button className="w-full font-bold h-14 rounded-xl">
                    <Plus className="mr-2" /> Add Experience Node
                  </Button>
                </div>
              </PremiumCard>

              <div className="relative">
                <div className="sticky top-10">
                  <div className="rounded-3xl bg-card border border-border p-8 min-h-[600px] shadow-sm">
                    <div className="border-b border-border pb-6 mb-6">
                      <h2 className="text-3xl font-black uppercase tracking-tighter">Your Name</h2>
                      <p className="text-primary font-bold tracking-widest text-sm">SENIOR ROLE</p>
                    </div>
                    <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
                      [ Live Editorial Preview ]
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Cover Letter: implemented (was placeholder) */}
          <TabsContent value="coverletter">
            <CoverLetterEngine />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-7xl mx-auto mt-32 pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6 text-muted-foreground text-sm font-medium">
        <p>© 2026</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-foreground transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Contact Support
          </a>
        </div>
      </footer>
    </div>
  );
}
