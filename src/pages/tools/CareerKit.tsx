import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PenTool, FileUser, Mail, Download, Copy, Trash2, Plus, X, Undo2 } from "lucide-react";
import { toast } from "sonner";

/* -----------------------------
   Helper Functions
------------------------------*/
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

/* -----------------------------
   Signature Generator
------------------------------*/
function SignatureGeneratorEmbedded() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  const [mode, setMode] = useState("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [strokes, setStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [typedName, setTypedName] = useState("Your Name");
  const [typedSize, setTypedSize] = useState(56);
  const [typedStyle, setTypedStyle] = useState("cursive");
  const [typedColor, setTypedColor] = useState("#0f172a");

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    if (mode === "draw") {
      ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, h * 0.68);
      ctx.lineTo(w - 20, h * 0.68);
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
    const width = Math.max(260, Math.floor(rect.width));
    const height = 220;

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
  }, [strokes, penWidth, mode, bgColor]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const pos = getPos(e.nativeEvent);
    setStrokes((prev) => [...prev, { points: [pos], width: penWidth, color: penColor }]);
  };

  const onPointerMove = (e) => {
    if (mode !== "draw" || !isDrawing) return;
    const pos = getPos(e.nativeEvent);
    setStrokes((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const updated = { ...last, points: [...last.points, pos] };
      return [...prev.slice(0, -1), updated];
    });
  };

  const downloadPNG = () => {
    if (mode === "type") {
      const canvas = document.createElement("canvas");
      const w = 1200;
      const h = 420;
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

  const isEmpty = strokes.length === 0;

  const fontFamily =
    typedStyle === "cursive"
      ? "cursive"
      : typedStyle === "elegant"
        ? "'Times New Roman', serif"
        : typedStyle === "modern"
          ? "'Helvetica Neue', sans-serif"
          : typedStyle === "serif"
            ? "Georgia, serif"
            : "Arial, sans-serif";

  const palette = ["#0f172a", "#334155", "#16a34a", "#dc2626", "#7c3aed"];

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={() => setMode("draw")}
          className="flex-1 sm:flex-none"
        >
          <PenTool className="w-4 h-4 mr-2" />
          Draw
        </Button>
        <Button
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          onClick={() => setMode("type")}
          className="flex-1 sm:flex-none"
        >
          Type
        </Button>
      </div>

      {/* Preview - Now on top for mobile */}
      <div className="rounded-lg border bg-background p-3 sm:p-4">
        <div className="text-sm font-medium mb-3">Preview</div>
        <div
          className="rounded-lg border border-dashed p-3 sm:p-6 flex items-center justify-center min-h-[200px] sm:min-h-[260px]"
          style={{ backgroundColor: bgColor }}
        >
          {mode === "draw" ? (
            <div ref={wrapRef} className="w-full">
              <canvas
                ref={canvasRef}
                className="w-full rounded-md border bg-transparent touch-none cursor-crosshair"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => setIsDrawing(false)}
                onPointerCancel={() => setIsDrawing(false)}
              />
            </div>
          ) : (
            <div className="text-center max-w-full overflow-hidden px-2">
              <span
                className="block break-words"
                style={{
                  fontFamily,
                  fontSize: Math.min(typedSize, 72),
                  color: typedColor,
                }}
              >
                {typedName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-lg border bg-background p-3 sm:p-4 space-y-4">
        {mode === "draw" ? (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Pen Width: {penWidth}px</Label>
              <Slider value={[penWidth]} onValueChange={(v) => setPenWidth(v[0])} min={1} max={12} step={1} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Pen Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <div className="flex gap-2 flex-wrap">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPenColor(c)}
                      className={`h-9 w-9 rounded-md border ${penColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set pen color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Background</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <div className="flex gap-2 flex-wrap">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBgColor(c)}
                      className={`h-9 w-9 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                disabled={isEmpty}
              >
                <Undo2 className="w-4 h-4 mr-2" /> Undo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStrokes([])}
                disabled={isEmpty}
                className="hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Name</Label>
              <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Font Size: {typedSize}px</Label>
              <Slider value={[typedSize]} onValueChange={(v) => setTypedSize(v[0])} min={28} max={120} step={4} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Font Style</Label>
              <Select value={typedStyle} onValueChange={(v) => setTypedStyle(v)}>
                <SelectTrigger>
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
              <Label className="text-sm">Text Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="color"
                  value={typedColor}
                  onChange={(e) => setTypedColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <div className="flex gap-2 flex-wrap">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTypedColor(c)}
                      className={`h-9 w-9 rounded-md border ${typedColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set text color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Background</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <div className="flex gap-2 flex-wrap">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBgColor(c)}
                      className={`h-9 w-9 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Button className="w-full" onClick={downloadPNG}>
        <Download className="w-4 h-4 mr-2" /> Download Signature
      </Button>
    </div>
  );
}

/* -----------------------------
   Resume Generator
------------------------------*/
function ResumeGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [summary, setSummary] = useState("");

  const [experiences, setExperiences] = useState([{ id: "1", role: "", company: "", start: "", end: "", bullets: "" }]);

  const [education, setEducation] = useState([{ id: "1", school: "", degree: "", start: "", end: "", details: "" }]);

  const [skills, setSkills] = useState([]);
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
    <div className="space-y-4">
      {/* Preview First on Mobile */}
      <Card className="shadow-none lg:hidden">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-sm font-medium">Preview</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(output)}>
                <Copy className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadBlob("resume.txt", new Blob([output], { type: "text/plain;charset=utf-8" }))}
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 p-3 sm:p-4">
            {output}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-4 max-h-none lg:max-h-[78vh] overflow-y-auto lg:pr-2">
          <Card className="shadow-none">
            <CardContent className="pt-4 sm:pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Job Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Website/Portfolio</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm">LinkedIn</Label>
                  <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Professional Summary</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Skills</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  />
                  <Button onClick={addSkill} size="icon" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="bg-muted px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border flex items-center gap-2"
                      >
                        <span className="text-xs sm:text-sm">{skill.name}</span>
                        <button
                          onClick={() => setSkills((prev) => prev.filter((s) => s.id !== skill.id))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove skill"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Experience</Label>
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
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          {experiences.map((exp, i) => (
            <Card key={exp.id} className="shadow-none">
              <CardContent className="pt-4 sm:pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Experience {i + 1}</div>
                  {experiences.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setExperiences((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="w-4 h-4" />
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
                    placeholder="Start Date"
                    value={exp.start}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[i].start = e.target.value;
                      setExperiences(next);
                    }}
                  />
                  <Input
                    placeholder="End Date"
                    value={exp.end}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[i].end = e.target.value;
                      setExperiences(next);
                    }}
                  />
                </div>

                <Textarea
                  placeholder="Bullets (one per line)"
                  value={exp.bullets}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[i].bullets = e.target.value;
                    setExperiences(next);
                  }}
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          ))}

          {/* Education */}
          <div className="flex items-center justify-between pt-2">
            <Label className="text-sm font-medium">Education</Label>
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
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          {education.map((ed, i) => (
            <Card key={ed.id} className="shadow-none">
              <CardContent className="pt-4 sm:pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Education {i + 1}</div>
                  {education.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="w-4 h-4" />
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
                    placeholder="Degree"
                    value={ed.degree}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].degree = e.target.value;
                      setEducation(next);
                    }}
                  />
                  <Input
                    placeholder="Start Year"
                    value={ed.start}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].start = e.target.value;
                      setEducation(next);
                    }}
                  />
                  <Input
                    placeholder="End Year"
                    value={ed.end}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].end = e.target.value;
                      setEducation(next);
                    }}
                  />
                </div>

                <Textarea
                  placeholder="Additional details"
                  value={ed.details}
                  onChange={(e) => {
                    const next = [...education];
                    next[i].details = e.target.value;
                    setEducation(next);
                  }}
                  rows={2}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Preview - Desktop Only */}
        <Card className="shadow-none hidden lg:block">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-medium">Preview</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(output)}>
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBlob("resume.txt", new Blob([output], { type: "text/plain;charset=utf-8" }))}
                >
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-[70vh] overflow-y-auto rounded-md border bg-muted/30 p-4">
              {output}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -----------------------------
   Cover Letter Generator
------------------------------*/
function CoverLetterGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState("Professional");
  const [content, setContent] = useState("");

  const letter = useMemo(() => {
    const greetings = {
      Professional: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Manager,",
      Bold: `To the Team at ${company || "the Company"},`,
      Friendly: hiringManager ? `Hi ${hiringManager.split(" ")[0]},` : "Hi there!",
      Concise: "To whom it may concern,",
      Enthusiastic: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Team!",
    };

    const closings = {
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
    <div className="space-y-4">
      {/* Preview First on Mobile */}
      <Card className="shadow-none lg:hidden">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-sm font-medium">Preview</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(letter)}>
                <Copy className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadBlob("cover-letter.txt", new Blob([letter], { type: "text/plain;charset=utf-8" }))
                }
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>

          <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 p-3 sm:p-4">
            {letter}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-4">
          <Card className="shadow-none">
            <CardContent className="pt-4 sm:pt-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Address (optional)</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="pt-4 sm:pt-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Company</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Role</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm">Hiring Manager (optional)</Label>
                  <Input value={hiringManager} onChange={(e) => setHiringManager(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Professional", "Bold", "Friendly", "Concise", "Enthusiastic"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Body</Label>
                <Textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview - Desktop Only */}
        <Card className="shadow-none hidden lg:block">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-medium">Preview</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(letter)}>
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadBlob("cover-letter.txt", new Blob([letter], { type: "text/plain;charset=utf-8" }))
                  }
                >
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
            </div>

            <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-[70vh] overflow-y-auto rounded-md border bg-muted/30 p-4">
              {letter}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Page
------------------------------*/
export default function CareerToolkit() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10 space-y-4 sm:space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight">Career Toolkit</h1>
          <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
            Fast, clean tools for signatures, resumes, and cover letters.
          </p>
        </header>

        <Tabs defaultValue="signature" className="space-y-3 sm:space-y-4">
          <TabsList className="w-full grid grid-cols-3 h-auto p-1">
            <TabsTrigger value="signature" className="flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <PenTool className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Signature</span>
            </TabsTrigger>
            <TabsTrigger value="resume" className="flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <FileUser className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Resume</span>
            </TabsTrigger>
            <TabsTrigger value="cover-letter" className="flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Cover Letter</span>
              <span className="sm:hidden">Letter</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signature">
            <Card className="shadow-none">
              <CardContent className="pt-4 sm:pt-6">
                <SignatureGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume">
            <Card className="shadow-none">
              <CardContent className="pt-4 sm:pt-6">
                <ResumeGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cover-letter">
            <Card className="shadow-none">
              <CardContent className="pt-4 sm:pt-6">
                <CoverLetterGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
