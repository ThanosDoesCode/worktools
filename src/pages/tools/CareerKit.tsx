import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PenTool, FileUser, Mail, Download, Copy, Trash2, Plus, X, Undo2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";

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

// ✅ CHANGE 1: replace your existing checkerboardStyle with this (works in dark mode too)
const checkerboardStyle = {
  // light tiles + dark tiles mixed so it's visible in both themes
  backgroundImage: `
    linear-gradient(45deg, rgba(255,255,255,.10) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,.10) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(0,0,0,.22) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(0,0,0,.22) 75%)
  `,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

// Preset configurations
const BG_PRESETS = [
  { label: "White", bg: "#ffffff" },
  { label: "Light Gray", bg: "#f8fafc" },
  { label: "Cream", bg: "#fef3c7" },
  { label: "Light Blue", bg: "#dbeafe" },
  { label: "Transparent", transparent: true },
];

const TYPED_PRESETS = [
  { label: "Classic Black", typedStyle: "elegant", typedSize: 56, typedColor: "#0f172a", bg: "#ffffff" },
  { label: "Modern Blue", typedStyle: "modern", typedSize: 48, typedColor: "#1e40af", bg: "#f8fafc" },
  { label: "Elegant Serif", typedStyle: "serif", typedSize: 52, typedColor: "#334155", bg: "#ffffff" },
  { label: "Bold Sans", typedStyle: "sans", typedSize: 60, typedColor: "#0f172a", bg: "#f8fafc" },
  { label: "Cursive Classic", typedStyle: "cursive", typedSize: 64, typedColor: "#16a34a", bg: "#ffffff" },
  { label: "Transparent", typedStyle: "cursive", typedSize: 56, typedColor: "#0f172a", transparent: true },
];

const INK_PRESETS = [
  { label: "Fine Black", penWidth: 2, penColor: "#0f172a", bg: "#ffffff" },
  { label: "Medium Black", penWidth: 3, penColor: "#0f172a", bg: "#ffffff" },
  { label: "Bold Black", penWidth: 5, penColor: "#0f172a", bg: "#ffffff" },
  { label: "Blue Ink", penWidth: 3, penColor: "#1e40af", bg: "#ffffff" },
  { label: "Green Signature", penWidth: 4, penColor: "#16a34a", bg: "#f8fafc" },
];

function SignatureGeneratorEmbedded() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  const [mode, setMode] = useState("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgTransparent, setBgTransparent] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [typedName, setTypedName] = useState("Your Name");
  const [typedSize, setTypedSize] = useState(56);
  const [typedStyle, setTypedStyle] = useState("cursive");
  const [typedColor, setTypedColor] = useState("#0f172a");

  const [bgPreset, setBgPreset] = useState("White");
  const [typedPreset, setTypedPreset] = useState("Classic Black");
  const [inkPreset, setInkPreset] = useState("Medium Black");

  // ✅ CHANGE 2: add this new state + helpers INSIDE SignatureGeneratorEmbedded (near your other useState)
  const [transparentMode, setTransparentMode] = useState("none");

  const setTransparency = (mode) => {
    setTransparentMode(mode);
    setBgTransparent(mode !== "none");
  };

  // ✅ CHANGE 3: replace your previewStyle logic with this (still shows checkerboard when transparent)
  const previewStyle = transparentMode !== "none" ? checkerboardStyle : { backgroundColor: bgColor };

  // ✅ CHANGE 4: update applyBgPreset to enforce exclusive transparency
  const applyBgPreset = (label) => {
    const p = BG_PRESETS.find((x) => x.label === label);
    if (!p) return;
    setBgPreset(label);

    if (p.transparent) {
      // choosing transparent background means transparent DRAW export only (exclusive)
      setTransparency("draw");
      toast.success("Background: Transparent (exports transparent PNG)");
      return;
    }

    if (p.bg) {
      setTransparency("none");
      setBgColor(p.bg);
      toast.success(`Background: ${p.label}`);
    }
  };

  // ✅ CHANGE 5: update applyTypedPreset to enforce exclusive transparency
  const applyTypedPreset = (label) => {
    const p = TYPED_PRESETS.find((x) => x.label === label);
    if (!p) return;
    setTypedPreset(label);

    setMode("type");
    setTypedStyle(p.typedStyle);
    setTypedSize(p.typedSize);
    setTypedColor(p.typedColor);

    if (p.transparent) {
      // choosing typed transparent means transparent TYPE export only (exclusive)
      setTransparency("type");
    } else if (p.bg) {
      setTransparency("none");
      setBgColor(p.bg);
    }

    toast.success(`Preset: ${p.label}`);
  };

  // ✅ CHANGE 6: update applyInkPreset to NOT set transparency (ink preset shouldn't fight background/typed)
  const applyInkPreset = (label) => {
    const p = INK_PRESETS.find((x) => x.label === label);
    if (!p) return;
    setInkPreset(label);

    setMode("draw");
    setPenWidth(p.penWidth);
    setPenColor(p.penColor);

    // keep ink preset focused on ink only; do not toggle transparency here
    if (p.bg) {
      setBgColor(p.bg);
    }

    toast.success(`Preset: ${p.label}`);
  };

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    if (!bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

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
  }, [strokes, penWidth, mode, bgColor, bgTransparent]);

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

      if (!bgTransparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
      }

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
    <div className="space-y-4 w-full max-w-full">
      <div className="flex gap-2 w-full">
        <Button
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={() => setMode("draw")}
          className="flex-1 sm:flex-none min-w-0"
        >
          <PenTool className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">Draw</span>
        </Button>
        <Button
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          onClick={() => setMode("type")}
          className="flex-1 sm:flex-none min-w-0"
        >
          <span className="truncate">Type</span>
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-3 sm:p-4 w-full max-w-full">
        <div className="text-sm font-medium mb-3">Preview</div>
        <div
          className="rounded-lg border border-dashed p-3 sm:p-6 flex items-center justify-center min-h-[200px] sm:min-h-[260px] w-full max-w-full"
          style={previewStyle}
        >
          {mode === "draw" ? (
            <div ref={wrapRef} className="w-full max-w-full">
              <canvas
                ref={canvasRef}
                className="w-full max-w-full rounded-md border bg-transparent touch-none cursor-crosshair"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => setIsDrawing(false)}
                onPointerCancel={() => setIsDrawing(false)}
              />
            </div>
          ) : (
            <div className="text-center w-full max-w-full overflow-hidden px-2">
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

      <div className="rounded-lg border bg-background p-3 sm:p-4 space-y-4 w-full max-w-full">
        {mode === "draw" ? (
          <>
            <div className="space-y-2 w-full">
              <Label className="text-sm">Ink Preset</Label>
              <Select value={inkPreset} onValueChange={applyInkPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INK_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Pen Width: {penWidth}px</Label>
              <Slider
                value={[penWidth]}
                onValueChange={(v) => setPenWidth(v[0])}
                min={1}
                max={12}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2 w-full max-w-full">
              <Label className="text-sm">Pen Color</Label>
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPenColor(c)}
                      className={`h-9 w-9 shrink-0 rounded-md border ${penColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set pen color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Background Preset</Label>
              <Select value={bgPreset} onValueChange={applyBgPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ CHANGE 7: make BG_PRESETS disable their transparent options when the other is active */}
                  {BG_PRESETS.map((p) => {
                    const isTransparentOption = !!p.transparent;
                    const disabled = isTransparentOption && transparentMode === "type"; // block bg transparent if typed transparent active
                    return (
                      <SelectItem key={p.label} value={p.label} disabled={disabled}>
                        {p.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full max-w-full">
              <Label className="text-sm">Background Color</Label>
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-12 h-10 p-1 shrink-0"
                  disabled={bgTransparent}
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => !bgTransparent && setBgColor(c)}
                      className={`h-9 w-9 shrink-0 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""} ${bgTransparent ? "opacity-50 cursor-not-allowed" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                      disabled={bgTransparent}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                disabled={isEmpty}
                className="w-full min-w-0"
              >
                <Undo2 className="w-4 h-4 mr-1 sm:mr-2" /> <span className="truncate">Undo</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStrokes([])}
                disabled={isEmpty}
                className="hover:text-destructive w-full min-w-0"
              >
                <Trash2 className="w-4 h-4 mr-1 sm:mr-2" /> <span className="truncate">Clear</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 w-full">
              <Label className="text-sm">Typed Preset</Label>
              <Select value={typedPreset} onValueChange={applyTypedPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ CHANGE 7: make TYPED_PRESETS disable their transparent options when the other is active */}
                  {TYPED_PRESETS.map((p) => {
                    const isTransparentOption = !!p.transparent;
                    const disabled = isTransparentOption && transparentMode === "draw"; // block typed transparent if bg transparent active
                    return (
                      <SelectItem key={p.label} value={p.label} disabled={disabled}>
                        {p.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Name</Label>
              <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} className="w-full" />
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Font Size: {typedSize}px</Label>
              <Slider
                value={[typedSize]}
                onValueChange={(v) => setTypedSize(v[0])}
                min={28}
                max={120}
                step={4}
                className="w-full"
              />
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Font Style</Label>
              <Select value={typedStyle} onValueChange={(v) => setTypedStyle(v)}>
                <SelectTrigger className="w-full">
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

            <div className="space-y-2 w-full max-w-full">
              <Label className="text-sm">Text Color</Label>
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={typedColor}
                  onChange={(e) => setTypedColor(e.target.value)}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTypedColor(c)}
                      className={`h-9 w-9 shrink-0 rounded-md border ${typedColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set text color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 w-full max-w-full">
              <Label className="text-sm">Background Color</Label>
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-12 h-10 p-1 shrink-0"
                  disabled={bgTransparent}
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => !bgTransparent && setBgColor(c)}
                      className={`h-9 w-9 shrink-0 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""} ${bgTransparent ? "opacity-50 cursor-not-allowed" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                      disabled={bgTransparent}
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

      {/* ✅ CHANGE 8: make the "status text" use transparentMode instead of bgTransparent */}
      <div className="text-xs text-muted-foreground">
        {transparentMode === "none"
          ? "Solid background export"
          : transparentMode === "draw"
            ? "Transparent export: Draw"
            : "Transparent export: Type"}
      </div>
    </div>
  );
}

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
    <div className="space-y-4 w-full max-w-full">
      <Card className="shadow-none lg:hidden w-full max-w-full">
        <CardContent className="pt-4 sm:pt-6 w-full">
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
          <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed max-h-[50vh] overflow-auto rounded-md border bg-muted/30 p-3 sm:p-4 w-full max-w-full">
            {output}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 w-full max-w-full">
        <div className="space-y-4 w-full max-w-full">
          <Card className="shadow-none w-full max-w-full">
            <CardContent className="pt-4 sm:pt-6 space-y-4 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Job Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 sm:col-span-2 w-full">
                  <Label className="text-sm">LinkedIn</Label>
                  <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="w-full" />
                </div>
              </div>

              <div className="space-y-2 w-full">
                <Label className="text-sm">Professional Summary</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  className="resize-none w-full"
                />
              </div>

              <div className="space-y-2 w-full max-w-full">
                <Label className="text-sm">Skills</Label>
                <div className="flex gap-2 w-full">
                  <Input
                    placeholder="Add a skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    className="flex-1 min-w-0"
                  />
                  <Button onClick={addSkill} size="icon" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 w-full">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="bg-muted px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border flex items-center gap-2"
                      >
                        <span className="text-xs sm:text-sm">{skill.name}</span>
                        <button
                          onClick={() => setSkills((prev) => prev.filter((s) => s.id !== skill.id))}
                          className="text-muted-foreground hover:text-destructive shrink-0"
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

          <div className="flex items-center justify-between w-full">
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
            <Card key={exp.id} className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
                <div className="flex items-center justify-between w-full">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <Input
                    placeholder="Role"
                    value={exp.role}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[i].role = e.target.value;
                      setExperiences(next);
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Company"
                    value={exp.company}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[i].company = e.target.value;
                      setExperiences(next);
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Start"
                    value={exp.start}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[i].start = e.target.value;
                      setExperiences(next);
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="End"
                    value={exp.end}
                    onChange={(e) => {
                      const next = [...experiences];
                      next[i].end = e.target.value;
                      setExperiences(next);
                    }}
                    className="w-full"
                  />
                </div>

                <Textarea
                  placeholder="Bullets"
                  value={exp.bullets}
                  onChange={(e) => {
                    const next = [...experiences];
                    next[i].bullets = e.target.value;
                    setExperiences(next);
                  }}
                  rows={3}
                  className="resize-none w-full"
                />
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between pt-2 w-full">
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
            <Card key={ed.id} className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
                <div className="flex items-center justify-between w-full">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <Input
                    placeholder="School"
                    value={ed.school}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].school = e.target.value;
                      setEducation(next);
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Degree"
                    value={ed.degree}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].degree = e.target.value;
                      setEducation(next);
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Start"
                    value={ed.start}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].start = e.target.value;
                      setEducation(next);
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="End"
                    value={ed.end}
                    onChange={(e) => {
                      const next = [...education];
                      next[i].end = e.target.value;
                      setEducation(next);
                    }}
                    className="w-full"
                  />
                </div>

                <Textarea
                  placeholder="Details"
                  value={ed.details}
                  onChange={(e) => {
                    const next = [...education];
                    next[i].details = e.target.value;
                    setEducation(next);
                  }}
                  rows={2}
                  className="resize-none w-full"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-none hidden lg:block w-full max-w-full">
          <CardContent className="pt-6 w-full">
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
            <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-[70vh] overflow-auto rounded-md border bg-muted/30 p-4 w-full max-w-full">
              {output}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
    <div className="space-y-4 w-full max-w-full">
      <Card className="shadow-none lg:hidden w-full max-w-full">
        <CardContent className="pt-4 sm:pt-6 w-full">
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

          <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed max-h-[50vh] overflow-auto rounded-md border bg-muted/30 p-3 sm:p-4 w-full max-w-full">
            {letter}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 w-full max-w-full">
        <div className="space-y-4 w-full max-w-full">
          <Card className="shadow-none w-full max-w-full">
            <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none w-full max-w-full">
            <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Company</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Role</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2 sm:col-span-2 w-full">
                  <Label className="text-sm">Hiring Manager</Label>
                  <Input value={hiringManager} onChange={(e) => setHiringManager(e.target.value)} className="w-full" />
                </div>
              </div>

              <div className="space-y-2 w-full">
                <Label className="text-sm">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
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

              <div className="space-y-2 w-full">
                <Label className="text-sm">Body</Label>
                <Textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="resize-none w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-none hidden lg:block w-full max-w-full">
          <CardContent className="pt-6 w-full">
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

            <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-[70vh] overflow-auto rounded-md border bg-muted/30 p-4 w-full max-w-full">
              {letter}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CareerToolkit() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <Header />
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10 space-y-4 sm:space-y-6">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Tools
        </Link>

        <header className="space-y-1 w-full">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight">Career Toolkit</h1>
          <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
            Fast, clean tools for signatures, resumes, and cover letters.
          </p>
        </header>

        <Tabs defaultValue="signature" className="space-y-3 sm:space-y-4 w-full max-w-full">
          <TabsList className="w-full grid grid-cols-3 h-auto p-1 gap-1">
            <TabsTrigger
              value="signature"
              className="flex-col sm:flex-row gap-1 sm:gap-2 text-[10px] sm:text-sm py-2 px-1 sm:px-3 min-w-0"
            >
              <PenTool className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Signature</span>
            </TabsTrigger>
            <TabsTrigger
              value="resume"
              className="flex-col sm:flex-row gap-1 sm:gap-2 text-[10px] sm:text-sm py-2 px-1 sm:px-3 min-w-0"
            >
              <FileUser className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Resume</span>
            </TabsTrigger>
            <TabsTrigger
              value="cover-letter"
              className="flex-col sm:flex-row gap-1 sm:gap-2 text-[10px] sm:text-sm py-2 px-1 sm:px-3 min-w-0"
            >
              <Mail className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline truncate">Cover Letter</span>
              <span className="sm:hidden truncate">Letter</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signature" className="w-full max-w-full">
            <Card className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 w-full max-w-full">
                <SignatureGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume" className="w-full max-w-full">
            <Card className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 w-full max-w-full">
                <ResumeGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cover-letter" className="w-full max-w-full">
            <Card className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 w-full max-w-full">
                <CoverLetterGeneratorEmbedded />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
