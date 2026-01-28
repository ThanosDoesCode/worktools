import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PenTool, FileUser, Mail, RotateCcw, Download, Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

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

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------------
   Signature Generator
------------------------------*/
type Point = { x: number; y: number };
type Stroke = { points: Point[]; width: number };

function SignatureGeneratorEmbedded() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [typedName, setTypedName] = useState("Your Name");
  const [typedSize, setTypedSize] = useState(64);
  const [typedStyle, setTypedStyle] = useState<"cursive" | "serif" | "sans">("cursive");

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width));
    const height = 180;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAll();
  };

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode === "draw") drawAll();
  }, [strokes, penWidth, mode]);

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, h * 0.65);
    ctx.lineTo(w - 12, h * 0.65);
    ctx.stroke();

    ctx.strokeStyle = "#111827";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  };

  const getPos = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const pos = getPos(e.nativeEvent);
    setStrokes((prev) => [...prev, { points: [pos], width: penWidth }]);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "draw" || !isDrawing) return;
    const pos = getPos(e.nativeEvent);
    setStrokes((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const updated: Stroke = { ...last, points: [...last.points, pos] };
      return [...prev.slice(0, -1), updated];
    });
  };

  const downloadPNG = () => {
    if (mode === "type") {
      const canvas = document.createElement("canvas");
      const w = 1200;
      const h = 400;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#111827";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const fontFamily = typedStyle === "cursive" ? "cursive" : typedStyle === "serif" ? "serif" : "sans-serif";
      ctx.font = `${typedSize * 4}px ${fontFamily}`;
      ctx.fillText(typedName || "Your Name", w / 2, h / 2);
      canvas.toBlob((b) => b && downloadBlob("signature.png", b));
      return;
    }
    canvasRef.current?.toBlob((b) => b && downloadBlob("signature.png", b));
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-muted/50 rounded-xl p-6 border border-border">
          <Label className="mb-4 block">Mode</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant={mode === "draw" ? "default" : "outline"} onClick={() => setMode("draw")}>
              Draw
            </Button>
            <Button variant={mode === "type" ? "default" : "outline"} onClick={() => setMode("type")}>
              Type
            </Button>
          </div>
        </div>

        {mode === "draw" ? (
          <div className="bg-muted/50 rounded-xl p-6 border border-border space-y-4">
            <Label>Pen Width</Label>
            <Input type="number" value={penWidth} onChange={(e) => setPenWidth(Number(e.target.value))} />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setStrokes((prev) => prev.slice(0, -1))}>
                Undo
              </Button>
              <Button variant="outline" onClick={() => setStrokes([])}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-xl p-6 border border-border space-y-4">
            <Label>Name</Label>
            <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Size</Label>
                <Input type="number" value={typedSize} onChange={(e) => setTypedSize(Number(e.target.value))} />
              </div>
              <div>
                <Label>Style</Label>
                <Select value={typedStyle} onValueChange={(v: any) => setTypedStyle(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cursive">Cursive</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="sans">Sans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <Button className="w-full" onClick={downloadPNG}>
          <Download className="w-4 h-4 mr-2" /> Download PNG
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border p-8 flex flex-col items-center justify-center min-h-[300px]">
        {mode === "draw" ? (
          <div ref={wrapRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full border rounded-lg touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => setIsDrawing(false)}
            />
          </div>
        ) : (
          <span style={{ fontFamily: typedStyle, fontSize: typedSize }} className="text-slate-900">
            {typedName}
          </span>
        )}
      </div>
    </div>
  );
}

/* -----------------------------
   Resume Generator
------------------------------*/
type Experience = { id: string; role: string; company: string; start: string; end: string; bullets: string };
type Education = { id: string; school: string; degree: string; start: string; end: string; details: string };

function ResumeGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([
    { id: "1", role: "", company: "", start: "", end: "", bullets: "" },
  ]);
  const [education, setEducation] = useState<Education[]>([
    { id: "1", school: "", degree: "", start: "", end: "", details: "" },
  ]);

  const output = useMemo(() => {
    return `${fullName.toUpperCase()}\n${title}\n${location} | ${email} | ${phone}\n\nSUMMARY\n${summary}\n\nEXPERIENCE\n${experiences.map((e) => `${e.role} @ ${e.company} (${e.start}-${e.end})\n${e.bullets}`).join("\n\n")}\n\nEDUCATION\n${education.map((ed) => `${ed.degree}, ${ed.school}`).join("\n")}`;
  }, [fullName, title, location, email, phone, summary, experiences, education]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Textarea placeholder="Professional Summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <Button
          onClick={() =>
            setExperiences([
              ...experiences,
              { id: Date.now().toString(), role: "", company: "", start: "", end: "", bullets: "" },
            ])
          }
        >
          Add Experience
        </Button>
        {experiences.map((exp, i) => (
          <div key={exp.id} className="p-4 border rounded-lg space-y-2">
            <Input
              placeholder="Role"
              value={exp.role}
              onChange={(e) => {
                const newExp = [...experiences];
                newExp[i].role = e.target.value;
                setExperiences(newExp);
              }}
            />
            <Textarea
              placeholder="Bullet points"
              value={exp.bullets}
              onChange={(e) => {
                const newExp = [...experiences];
                newExp[i].bullets = e.target.value;
                setExperiences(newExp);
              }}
            />
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-xl p-8 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm">{output}</pre>
        <Button variant="outline" className="mt-4" onClick={() => copyToClipboard(output)}>
          <Copy className="w-4 h-4 mr-2" /> Copy Text
        </Button>
      </div>
    </div>
  );
}

/* -----------------------------
   Cover Letter Generator
------------------------------*/
type Tone = "Professional" | "Bold" | "Friendly" | "Concise";

function CoverLetterGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [content, setContent] = useState("");

  const letter = useMemo(() => {
    const greetings = {
      Professional: "Dear Hiring Manager,",
      Bold: "To the Team at " + (company || "the company") + ",",
      Friendly: "Hi there!",
      Concise: "To whom it may concern,",
    };

    return `${fullName}\n${email}\n\n${new Date().toLocaleDateString()}\n\n${company}\n\n${greetings[tone]}\n\nI am writing to express my interest in the ${role || "open position"}. ${content}\n\nSincerely,\n${fullName}`;
  }, [fullName, email, company, role, tone, content]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <Input placeholder="Your Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="Target Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Select value={tone} onValueChange={(v: Tone) => setTone(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Tone" />
          </SelectTrigger>
          <SelectContent>
            {["Professional", "Bold", "Friendly", "Concise"].map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Key achievements or why you want this job..."
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="bg-white border rounded-xl p-8">
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-serif text-base">{letter}</pre>
        </div>
        <Button className="mt-4" onClick={() => copyToClipboard(letter)}>
          <Copy className="w-4 h-4 mr-2" /> Copy Letter
        </Button>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Tool Page
------------------------------*/
export default function CareerToolkit() {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Career Toolkit</h1>
        <p className="text-muted-foreground mt-2">Professional tools to help you land your next role.</p>
      </div>

      <Tabs defaultValue="signature" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="signature" className="gap-2">
            <PenTool className="w-4 h-4" /> Signature
          </TabsTrigger>
          <TabsTrigger value="resume" className="gap-2">
            <FileUser className="w-4 h-4" /> Resume
          </TabsTrigger>
          <TabsTrigger value="cover-letter" className="gap-2">
            <Mail className="w-4 h-4" /> Cover Letter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signature">
          <Card>
            <CardContent className="pt-6">
              <SignatureGeneratorEmbedded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume">
          <Card>
            <CardContent className="pt-6">
              <ResumeGeneratorEmbedded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover-letter">
          <Card>
            <CardContent className="pt-6">
              <CoverLetterGeneratorEmbedded />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
