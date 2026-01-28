import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PenTool, FileUser, Mail, Download, Copy, Trash2, Plus, X, Undo2, Palette } from "lucide-react";
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
type Stroke = { points: Point[]; width: number; color: string };

function SignatureGeneratorEmbedded() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#1e40af");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [typedName, setTypedName] = useState("Your Name");
  const [typedSize, setTypedSize] = useState(64);
  const [typedStyle, setTypedStyle] = useState<"cursive" | "serif" | "sans" | "elegant" | "modern">("cursive");
  const [typedColor, setTypedColor] = useState("#1e40af");

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Subtle baseline
    if (mode === "draw") {
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, h * 0.65);
      ctx.lineTo(w - 24, h * 0.65);
      ctx.stroke();
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
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
    const height = 200;

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
  }, [strokes, penWidth, mode, bgColor]);

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
    setStrokes((prev) => [...prev, { points: [pos], width: penWidth, color: penColor }]);
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

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = typedColor;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      const fontMap = {
        cursive: "cursive",
        serif: "Georgia, serif",
        sans: "Arial, sans-serif",
        elegant: "'Times New Roman', serif",
        modern: "'Helvetica Neue', sans-serif",
      };
      ctx.font = `${typedSize * 4}px ${fontMap[typedStyle]}`;
      ctx.fillText(typedName || "Your Name", w / 2, h / 2);

      canvas.toBlob((b) => b && downloadBlob("signature.png", b));
      return;
    }

    canvasRef.current?.toBlob((b) => b && downloadBlob("signature.png", b));
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
          <Label className="mb-3 block font-semibold text-slate-700 dark:text-slate-300">Mode</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={mode === "draw" ? "default" : "outline"}
              onClick={() => setMode("draw")}
              className="transition-all hover:scale-105"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Draw
            </Button>
            <Button
              variant={mode === "type" ? "default" : "outline"}
              onClick={() => setMode("type")}
              className="transition-all hover:scale-105"
            >
              Type
            </Button>
          </div>
        </div>

        {mode === "draw" ? (
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="space-y-3">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Pen Width: {penWidth}px</Label>
              <Slider
                value={[penWidth]}
                onValueChange={(v) => setPenWidth(v[0])}
                min={1}
                max={12}
                step={1}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Pen Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <div className="flex-1 flex gap-2">
                  {["#1e40af", "#059669", "#dc2626", "#7c3aed", "#000000"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      className="w-10 h-10 rounded-lg border-2 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c, borderColor: penColor === c ? "#f59e0b" : "#e5e7eb" }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Background</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <div className="flex-1 flex gap-2">
                  {["#ffffff", "#fef3c7", "#dbeafe", "#f3e8ff"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className="w-10 h-10 rounded-lg border-2 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c, borderColor: bgColor === c ? "#f59e0b" : "#e5e7eb" }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                disabled={strokes.length === 0}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Undo2 className="w-4 h-4 mr-2" /> Undo
              </Button>
              <Button
                variant="outline"
                onClick={() => setStrokes([])}
                disabled={strokes.length === 0}
                className="hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Name</Label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="transition-all focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-3">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Font Size: {typedSize}px</Label>
              <Slider value={[typedSize]} onValueChange={(v) => setTypedSize(v[0])} min={24} max={120} step={4} />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Font Style</Label>
              <Select value={typedStyle} onValueChange={(v: any) => setTypedStyle(v)}>
                <SelectTrigger className="transition-all hover:border-blue-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cursive">Cursive</SelectItem>
                  <SelectItem value="elegant">Elegant Serif</SelectItem>
                  <SelectItem value="serif">Classic Serif</SelectItem>
                  <SelectItem value="modern">Modern Sans</SelectItem>
                  <SelectItem value="sans">Simple Sans</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Text Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={typedColor}
                  onChange={(e) => setTypedColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <div className="flex-1 flex gap-2">
                  {["#1e40af", "#059669", "#dc2626", "#7c3aed", "#000000"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setTypedColor(c)}
                      className="w-10 h-10 rounded-lg border-2 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c, borderColor: typedColor === c ? "#f59e0b" : "#e5e7eb" }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Background</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <div className="flex-1 flex gap-2">
                  {["#ffffff", "#fef3c7", "#dbeafe", "#f3e8ff"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className="w-10 h-10 rounded-lg border-2 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c, borderColor: bgColor === c ? "#f59e0b" : "#e5e7eb" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Button
          className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105"
          onClick={downloadPNG}
        >
          <Download className="w-4 h-4 mr-2" /> Download Signature
        </Button>
      </div>

      <div
        className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-5 sm:p-8 flex flex-col items-center justify-center min-h-[280px] transition-all hover:border-blue-400"
        style={{ backgroundColor: bgColor }}
      >
        {mode === "draw" ? (
          <div ref={wrapRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-lg touch-none cursor-crosshair shadow-sm"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => setIsDrawing(false)}
              onPointerCancel={() => setIsDrawing(false)}
            />
          </div>
        ) : (
          <div className="text-center">
            <span
              style={{
                fontFamily:
                  typedStyle === "cursive"
                    ? "cursive"
                    : typedStyle === "elegant"
                      ? "'Times New Roman', serif"
                      : typedStyle === "modern"
                        ? "'Helvetica Neue', sans-serif"
                        : typedStyle === "serif"
                          ? "Georgia, serif"
                          : "Arial, sans-serif",
                fontSize: typedSize,
                color: typedColor,
              }}
            >
              {typedName}
            </span>
          </div>
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
type Skill = { id: string; name: string };

function ResumeGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [summary, setSummary] = useState("");

  const [experiences, setExperiences] = useState<Experience[]>([
    { id: "1", role: "", company: "", start: "", end: "", bullets: "" },
  ]);

  const [education, setEducation] = useState<Education[]>([
    { id: "1", school: "", degree: "", start: "", end: "", details: "" },
  ]);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const output = useMemo(() => {
    const contacts = [location, email, phone, website, linkedin].filter(Boolean);
    const headerLine = contacts.length > 0 ? contacts.join(" • ") : "";

    const expBlock = experiences
      .filter((e) => e.role || e.company)
      .map((e) => {
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        const top = [e.role, e.company].filter(Boolean).join(" @ ");
        return `${top}${dates ? ` (${dates})` : ""}\n${e.bullets || ""}`.trim();
      })
      .join("\n\n");

    const eduBlock = education
      .filter((ed) => ed.school || ed.degree)
      .map((ed) => {
        const dates = [ed.start, ed.end].filter(Boolean).join(" – ");
        const top = [ed.degree, ed.school].filter(Boolean).join(", ");
        return `${top}${dates ? ` (${dates})` : ""}${ed.details ? `\n${ed.details}` : ""}`.trim();
      })
      .join("\n\n");

    const skillsBlock = skills.length > 0 ? skills.map((s) => s.name).join(" • ") : "";

    let result = `${(fullName || "YOUR NAME").toUpperCase()}\n${title || ""}`;
    if (headerLine) result += `\n${headerLine}`;
    if (summary) result += `\n\nPROFESSIONAL SUMMARY\n${summary}`;
    if (skillsBlock) result += `\n\nSKILLS\n${skillsBlock}`;
    if (expBlock) result += `\n\nEXPERIENCE\n${expBlock}`;
    if (eduBlock) result += `\n\nEDUCATION\n${eduBlock}`;

    return result.trim();
  }, [fullName, title, location, email, phone, website, linkedin, summary, experiences, education, skills]);

  const addSkill = () => {
    if (!newSkill.trim()) return;
    setSkills((prev) => [...prev, { id: Date.now().toString(), name: newSkill.trim() }]);
    setNewSkill("");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-0 lg:pr-2">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
          <Label className="mb-3 block font-semibold text-slate-700 dark:text-slate-300">Personal Information</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input placeholder="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Website/Portfolio" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <Input
              placeholder="LinkedIn"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="sm:col-span-2"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <Label className="mb-2 block font-semibold text-slate-700 dark:text-slate-300">Professional Summary</Label>
          <Textarea
            placeholder="A brief overview of your professional background, key achievements, and career objectives..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
          <Label className="mb-2 block font-semibold text-slate-700 dark:text-slate-300">Skills</Label>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Add a skill (e.g., Python, Project Management)"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
            />
            <Button onClick={addSkill} size="icon" className="shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 flex items-center gap-2 group hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <span className="text-sm font-medium">{skill.name}</span>
                <button
                  onClick={() => setSkills((prev) => prev.filter((s) => s.id !== skill.id))}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="font-semibold text-slate-700 dark:text-slate-300">Experience</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setExperiences((prev) => [
                  ...prev,
                  { id: Date.now().toString(), role: "", company: "", start: "", end: "", bullets: "" },
                ])
              }
              className="hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Experience
            </Button>
          </div>

          {experiences.map((exp, i) => (
            <div
              key={exp.id}
              className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl space-y-3 bg-white dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-slate-500">Experience {i + 1}</span>
                {experiences.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExperiences((prev) => prev.filter((_, idx) => idx !== i))}
                    className="h-6 px-2 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Role/Position"
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
                  placeholder="Start Date (e.g., Jan 2022)"
                  value={exp.start}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[i].start = e.target.value;
                    setExperiences(next);
                  }}
                />
                <Input
                  placeholder="End Date (e.g., Present)"
                  value={exp.end}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[i].end = e.target.value;
                    setExperiences(next);
                  }}
                />
              </div>

              <Textarea
                placeholder="Key responsibilities and achievements (one per line):\n• Led a team of 5 engineers...\n• Increased revenue by 25%...\n• Implemented new CI/CD pipeline..."
                value={exp.bullets}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i].bullets = e.target.value;
                  setExperiences(next);
                }}
                rows={4}
                className="resize-none"
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="font-semibold text-slate-700 dark:text-slate-300">Education</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEducation((prev) => [
                  ...prev,
                  { id: Date.now().toString(), school: "", degree: "", start: "", end: "", details: "" },
                ])
              }
              className="hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Education
            </Button>
          </div>

          {education.map((ed, i) => (
            <div
              key={ed.id}
              className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl space-y-3 bg-white dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-semibold text-slate-500">Education {i + 1}</span>
                {education.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                    className="h-6 px-2 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="School/University"
                  value={ed.school}
                  onChange={(e) => {
                    const next = [...education];
                    next[i].school = e.target.value;
                    setEducation(next);
                  }}
                />
                <Input
                  placeholder="Degree/Certification"
                  value={ed.degree}
                  onChange={(e) => {
                    const next = [...education];
                    next[i].degree = e.target.value;
                    setEducation(next);
                  }}
                />
                <Input
                  placeholder="Start Year (e.g., 2016)"
                  value={ed.start}
                  onChange={(e) => {
                    const next = [...education];
                    next[i].start = e.target.value;
                    setEducation(next);
                  }}
                />
                <Input
                  placeholder="End Year (e.g., 2020)"
                  value={ed.end}
                  onChange={(e) => {
                    const next = [...education];
                    next[i].end = e.target.value;
                    setEducation(next);
                  }}
                />
              </div>

              <Textarea
                placeholder="Additional details (GPA, honors, relevant coursework, etc.)"
                value={ed.details}
                onChange={(e) => {
                  const next = [...education];
                  next[i].details = e.target.value;
                  setEducation(next);
                }}
                rows={2}
                className="resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 sm:p-8 shadow-lg">
        <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Preview</h3>
        </div>

        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-900 dark:text-slate-100 mb-6 max-h-[60vh] overflow-y-auto">
          {output}
        </pre>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            className="w-full sm:w-auto hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            onClick={() => copyToClipboard(output)}
          >
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            onClick={() => downloadBlob("resume.txt", new Blob([output], { type: "text/plain;charset=utf-8" }))}
          >
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Cover Letter Generator
------------------------------*/
type Tone = "Professional" | "Bold" | "Friendly" | "Concise" | "Enthusiastic";

function CoverLetterGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [content, setContent] = useState("");

  const letter = useMemo(() => {
    const greetings: Record<Tone, string> = {
      Professional: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Manager,",
      Bold: `To the Team at ${company || "the Company"},`,
      Friendly: hiringManager ? `Hi ${hiringManager.split(" ")[0]},` : "Hi there!",
      Concise: "To whom it may concern,",
      Enthusiastic: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Team!",
    };

    const closings: Record<Tone, string> = {
      Professional: "Sincerely,",
      Bold: "Looking forward to hearing from you,",
      Friendly: "Best regards,",
      Concise: "Regards,",
      Enthusiastic: "Excited to connect,",
    };

    const contactInfo = [address, phone, email].filter(Boolean).join("\n");

    return `${fullName}${contactInfo ? `\n${contactInfo}` : ""}

${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

${company}

${greetings[tone]}

I am writing to express my ${tone === "Enthusiastic" ? "strong" : ""} interest in the ${role || "open position"}${company ? ` at ${company}` : ""}. ${content}

${closings[tone]}
${fullName}`.trim();
  }, [fullName, email, phone, address, company, role, hiringManager, tone, content]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
          <Label className="mb-3 block font-semibold text-slate-700 dark:text-slate-300">Your Information</Label>
          <div className="space-y-3">
            <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800">
          <Label className="mb-3 block font-semibold text-slate-700 dark:text-slate-300">Job Details</Label>
          <div className="space-y-3">
            <Input placeholder="Target Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input placeholder="Position/Role" value={role} onChange={(e) => setRole(e.target.value)} />
            <Input
              placeholder="Hiring Manager Name (optional)"
              value={hiringManager}
              onChange={(e) => setHiringManager(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-3">
          <Label className="font-semibold text-slate-700 dark:text-slate-300">Letter Tone</Label>
          <Select value={tone} onValueChange={(v: Tone) => setTone(v)}>
            <SelectTrigger className="transition-all hover:border-purple-400">
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              {(["Professional", "Bold", "Friendly", "Concise", "Enthusiastic"] as Tone[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
          <Label className="mb-2 block font-semibold text-slate-700 dark:text-slate-300">Letter Body</Label>
          <Textarea
            placeholder="Explain why you're a great fit for this role. Include:\n• Your relevant experience and achievements\n• Why you're interested in this company\n• What you can contribute\n• Your unique value proposition"
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 sm:p-8 shadow-lg">
        <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Preview</h3>
        </div>

        <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed text-slate-900 dark:text-slate-100 mb-6 max-h-[60vh] overflow-y-auto">
          {letter}
        </pre>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            className="w-full sm:w-auto hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
            onClick={() => copyToClipboard(letter)}
          >
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
            onClick={() => downloadBlob("cover-letter.txt", new Blob([letter], { type: "text/plain;charset=utf-8" }))}
          >
            <Download className="w-4 h-4 mr-2" /> Download
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="max-w-7xl mx-auto py-8 sm:py-12 px-4">
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
            Career Toolkit
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Professional tools to help you land your dream role
          </p>
        </div>

        <Tabs defaultValue="signature" className="space-y-6">
          <TabsList className="w-full h-auto flex gap-2 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg">
            <TabsTrigger
              value="signature"
              className="gap-2 min-w-max data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all hover:scale-105"
            >
              <PenTool className="w-4 h-4" /> Signature
            </TabsTrigger>
            <TabsTrigger
              value="resume"
              className="gap-2 min-w-max data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all hover:scale-105"
            >
              <FileUser className="w-4 h-4" /> Resume
            </TabsTrigger>
            <TabsTrigger
              value="cover-letter"
              className="gap-2 min-w-max data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all hover:scale-105"
            >
              <Mail className="w-4 h-4" /> Cover Letter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signature">
            <Card className="border-2 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <SignatureGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume">
            <Card className="border-2 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <ResumeGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cover-letter">
            <Card className="border-2 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <CoverLetterGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
