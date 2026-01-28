import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PenTool, FileUser, Mail, Download, Copy, Trash2 } from "lucide-react";
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

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // white paper background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // subtle baseline
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === "draw") drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, penWidth, mode]);

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
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div className="bg-muted/50 rounded-xl p-5 border border-border">
          <Label className="mb-3 block">Mode</Label>
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
          <div className="bg-muted/50 rounded-xl p-5 border border-border space-y-4">
            <div className="space-y-2">
              <Label>Pen Width</Label>
              <Input type="number" value={penWidth} onChange={(e) => setPenWidth(Number(e.target.value))} />
            </div>
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
          <div className="bg-muted/50 rounded-xl p-5 border border-border space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Size</Label>
                <Input type="number" value={typedSize} onChange={(e) => setTypedSize(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
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

        <Button className="w-full h-11" onClick={downloadPNG}>
          <Download className="w-4 h-4 mr-2" /> Download PNG
        </Button>
      </div>

      <div className="bg-white text-slate-900 rounded-xl border border-border p-5 sm:p-8 flex flex-col items-center justify-center min-h-[260px]">
        {mode === "draw" ? (
          <div ref={wrapRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full border rounded-lg touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => setIsDrawing(false)}
              onPointerCancel={() => setIsDrawing(false)}
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
    const headerLine = [location, email, phone].filter(Boolean).join(" | ");
    const expBlock = experiences
      .map((e) => {
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        const top = [e.role, e.company].filter(Boolean).join(" @ ");
        return `${top}${dates ? ` (${dates})` : ""}\n${e.bullets || ""}`.trim();
      })
      .filter(Boolean)
      .join("\n\n");

    const eduBlock = education
      .map((ed) => {
        const dates = [ed.start, ed.end].filter(Boolean).join(" – ");
        const top = [ed.degree, ed.school].filter(Boolean).join(", ");
        return `${top}${dates ? ` (${dates})` : ""}${ed.details ? `\n${ed.details}` : ""}`.trim();
      })
      .filter(Boolean)
      .join("\n\n");

    return `${(fullName || "").toUpperCase()}
${title || ""}${headerLine ? `\n${headerLine}` : ""}

SUMMARY
${summary || ""}

EXPERIENCE
${expBlock || ""}

EDUCATION
${eduBlock || ""}`.trim();
  }, [fullName, title, location, email, phone, summary, experiences, education]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-0 lg:pr-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <Textarea
          placeholder="Professional Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
        />

        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">Experience</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setExperiences((prev) => [
                ...prev,
                { id: Date.now().toString(), role: "", company: "", start: "", end: "", bullets: "" },
              ])
            }
          >
            Add Experience
          </Button>
        </div>

        {experiences.map((exp, i) => (
          <div key={exp.id} className="p-4 border rounded-lg space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Role"
                value={exp.role}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i].role = e.target.value;
                  setExperiences(next);
                }}
              />
              <Input
                placeholder="Company"
                value={exp.company}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i].company = e.target.value;
                  setExperiences(next);
                }}
              />
              <Input
                placeholder="Start (e.g. 2022)"
                value={exp.start}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i].start = e.target.value;
                  setExperiences(next);
                }}
              />
              <Input
                placeholder="End (e.g. Present)"
                value={exp.end}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i].end = e.target.value;
                  setExperiences(next);
                }}
              />
            </div>

            <Textarea
              placeholder={"Bullet points (one per line)\n• Increased revenue...\n• Built pipeline..."}
              value={exp.bullets}
              onChange={(e) => {
                const next = [...experiences];
                next[i].bullets = e.target.value;
                setExperiences(next);
              }}
              rows={4}
            />
          </div>
        ))}

        <div className="flex items-center justify-between gap-3 mt-2">
          <Label className="text-sm">Education</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEducation((prev) => [
                ...prev,
                { id: Date.now().toString(), school: "", degree: "", start: "", end: "", details: "" },
              ])
            }
          >
            Add Education
          </Button>
        </div>

        {education.map((ed, i) => (
          <div key={ed.id} className="p-4 border rounded-lg space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="School"
                value={ed.school}
                onChange={(e) => {
                  const next = [...education];
                  next[i].school = e.target.value;
                  setEducation(next);
                }}
              />
              <Input
                placeholder="Degree"
                value={ed.degree}
                onChange={(e) => {
                  const next = [...education];
                  next[i].degree = e.target.value;
                  setEducation(next);
                }}
              />
              <Input
                placeholder="Start (e.g. 2016)"
                value={ed.start}
                onChange={(e) => {
                  const next = [...education];
                  next[i].start = e.target.value;
                  setEducation(next);
                }}
              />
              <Input
                placeholder="End (e.g. 2020)"
                value={ed.end}
                onChange={(e) => {
                  const next = [...education];
                  next[i].end = e.target.value;
                  setEducation(next);
                }}
              />
            </div>

            <Textarea
              placeholder="Details (optional)"
              value={ed.details}
              onChange={(e) => {
                const next = [...education];
                next[i].details = e.target.value;
                setEducation(next);
              }}
              rows={3}
            />
          </div>
        ))}
      </div>

      {/* FIX: force readable text on white canvas */}
      <div className="bg-white text-slate-900 border rounded-xl p-5 sm:p-8 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-900">{output}</pre>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => copyToClipboard(output)}>
            <Copy className="w-4 h-4 mr-2" /> Copy Text
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => downloadBlob("resume.txt", new Blob([output], { type: "text/plain;charset=utf-8" }))}
          >
            <Download className="w-4 h-4 mr-2" /> Download TXT
          </Button>
        </div>
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
    const greetings: Record<Tone, string> = {
      Professional: "Dear Hiring Manager,",
      Bold: `To the Team at ${company || "the company"},`,
      Friendly: "Hi there!",
      Concise: "To whom it may concern,",
    };

    return `${fullName}
${email}

${new Date().toLocaleDateString()}

${company}

${greetings[tone]}

I am writing to express my interest in the ${role || "open position"}. ${content}

Sincerely,
${fullName}`.trim();
  }, [fullName, email, company, role, tone, content]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Input placeholder="Your Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Target Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input placeholder="Target Role" value={role} onChange={(e) => setRole(e.target.value)} />

        <div className="space-y-2">
          <Label>Tone</Label>
          <Select value={tone} onValueChange={(v: Tone) => setTone(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Tone" />
            </SelectTrigger>
            <SelectContent>
              {(["Professional", "Bold", "Friendly", "Concise"] as Tone[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          placeholder="Key achievements, why you want this job, relevant experience..."
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {/* FIX: force readable text on white canvas */}
      <div className="bg-white text-slate-900 border rounded-xl p-5 sm:p-8">
        <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed text-slate-900">{letter}</pre>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => copyToClipboard(letter)}>
            <Copy className="w-4 h-4 mr-2" /> Copy Letter
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => downloadBlob("cover-letter.txt", new Blob([letter], { type: "text/plain;charset=utf-8" }))}
          >
            <Download className="w-4 h-4 mr-2" /> Download TXT
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Page
------------------------------*/
export default function CareerToolkit() {
  return (
    <div className="max-w-6xl mx-auto py-8 sm:py-10 px-4">
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Career Toolkit</h1>
        <p className="text-muted-foreground mt-2">Professional tools to help you land your next role.</p>
      </div>

      <Tabs defaultValue="signature" className="space-y-6">
        {/* Mobile friendly tablist */}
        <TabsList className="w-full h-auto flex gap-2 p-2 overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="signature" className="gap-2 min-w-max">
            <PenTool className="w-4 h-4" /> Signature
          </TabsTrigger>
          <TabsTrigger value="resume" className="gap-2 min-w-max">
            <FileUser className="w-4 h-4" /> Resume
          </TabsTrigger>
          <TabsTrigger value="cover-letter" className="gap-2 min-w-max">
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
