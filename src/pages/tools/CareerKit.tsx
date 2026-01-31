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

/* ---------------------------------
  Signature Generator (with presets)
----------------------------------*/
function SignatureGeneratorEmbedded() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#0f172a");

  // Background can be solid color OR transparent
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgTransparent, setBgTransparent] = useState(false);

  const [strokes, setStrokes] = useState<{ points: { x: number; y: number }[]; width: number; color: string }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [typedName, setTypedName] = useState("Your Name");
  const [typedSize, setTypedSize] = useState(56);
  const [typedStyle, setTypedStyle] = useState<"cursive" | "serif" | "sans" | "elegant" | "modern">("cursive");
  const [typedColor, setTypedColor] = useState("#0f172a");

  const palette = ["#0f172a", "#334155", "#16a34a", "#dc2626", "#7c3aed"];

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

  // Checkerboard for transparent preview
  const transparentBgStyle: React.CSSProperties = bgTransparent
    ? {
        backgroundImage:
          "linear-gradient(45deg, rgba(0,0,0,.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,.06) 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
      }
    : { backgroundColor: bgColor };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === "draw") drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, penWidth, mode, bgColor, bgTransparent, penColor]);

  const getPos = (ev: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
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
      const updated = { ...last, points: [...last.points, pos] };
      return [...prev.slice(0, -1), updated];
    });
  };

  const exportDrawToPNG = () => {
    const srcCanvas = canvasRef.current;
    if (!srcCanvas) return;

    const cw = srcCanvas.clientWidth || 600;
    const ch = srcCanvas.clientHeight || 220;

    const out = document.createElement("canvas");
    const W = 1200;
    const H = 420;
    out.width = W;
    out.height = H;

    const ctx = out.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.clearRect(0, 0, W, H);
    if (!bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    const sx = W / cw;
    const sy = H / ch;
    const s = Math.min(sx, sy);

    // Center scale (keep proportions)
    const scaledW = cw * s;
    const scaledH = ch * s;
    const ox = (W - scaledW) / 2;
    const oy = (H - scaledH) / 2;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * s;

      ctx.beginPath();
      ctx.moveTo(ox + stroke.points[0].x * s, oy + stroke.points[0].y * s);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(ox + stroke.points[i].x * s, oy + stroke.points[i].y * s);
      }
      ctx.stroke();
    }

    out.toBlob((b) => b && downloadBlob("signature.png", b));
  };

  const exportTypedToPNG = () => {
    const out = document.createElement("canvas");
    const W = 1200;
    const H = 420;
    out.width = W;
    out.height = H;

    const ctx = out.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    if (!bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    const fontMap: Record<string, string> = {
      cursive: "cursive",
      serif: "Georgia, serif",
      sans: "Arial, sans-serif",
      elegant: "'Times New Roman', serif",
      modern: "'Helvetica Neue', sans-serif",
    };

    ctx.fillStyle = typedColor;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `${typedSize * 4}px ${fontMap[typedStyle]}`;
    ctx.fillText(typedName || "Your Name", W / 2, H / 2);

    out.toBlob((b) => b && downloadBlob("signature.png", b));
  };

  const downloadPNG = () => {
    if (mode === "type") exportTypedToPNG();
    else exportDrawToPNG();
  };

  const isEmpty = strokes.length === 0;

  const applyInkPreset = (preset: {
    label: string;
    penWidth: number;
    penColor: string;
    bg?: string;
    transparent?: boolean;
  }) => {
    setMode("draw");
    setPenWidth(preset.penWidth);
    setPenColor(preset.penColor);
    if (preset.transparent) {
      setBgTransparent(true);
    } else if (preset.bg) {
      setBgTransparent(false);
      setBgColor(preset.bg);
    }
    toast.success(`Preset: ${preset.label}`);
  };

  const applyBgPreset = (preset: { label: string; bg?: string; transparent?: boolean }) => {
    if (preset.transparent) {
      setBgTransparent(true);
      toast.success("Background: Transparent");
      return;
    }
    if (preset.bg) {
      setBgTransparent(false);
      setBgColor(preset.bg);
      toast.success(`Background: ${preset.label}`);
    }
  };

  const applyTypedPreset = (preset: {
    label: string;
    typedStyle: any;
    typedSize: number;
    typedColor: string;
    bg?: string;
    transparent?: boolean;
  }) => {
    setMode("type");
    setTypedStyle(preset.typedStyle);
    setTypedSize(preset.typedSize);
    setTypedColor(preset.typedColor);
    if (preset.transparent) {
      setBgTransparent(true);
    } else if (preset.bg) {
      setBgTransparent(false);
      setBgColor(preset.bg);
    }
    toast.success(`Preset: ${preset.label}`);
  };

  // Presets (as requested)
  const INK_PRESETS = [
    { label: "Black Ballpoint", penWidth: 3, penColor: "#0f172a", bg: "#ffffff" },
    { label: "Blue Ballpoint", penWidth: 3, penColor: "#1d4ed8", bg: "#ffffff" },
    { label: "Fountain Pen", penWidth: 6, penColor: "#0b1220", bg: "#ffffff" },
    { label: "Thin Elegant", penWidth: 2, penColor: "#0f172a", bg: "#ffffff" },
    { label: "Contract Grey", penWidth: 3, penColor: "#0f172a", bg: "#f8fafc" },
    { label: "Scanned Paper", penWidth: 3, penColor: "#0f172a", bg: "#fef3c7" },
    { label: "Transparent Ink", penWidth: 3, penColor: "#0f172a", transparent: true },
  ];

  const BG_PRESETS = [
    { label: "White", bg: "#ffffff" },
    { label: "Light Gray", bg: "#f8fafc" },
    { label: "Warm Paper", bg: "#fef3c7" },
    { label: "Cool Paper", bg: "#dbeafe" },
    { label: "Transparent", transparent: true },
  ];

  const TYPED_PRESETS = [
    { label: "Typed Cursive Large", typedStyle: "cursive", typedSize: 64, typedColor: "#0f172a", bg: "#ffffff" },
    { label: "Typed Modern Minimal", typedStyle: "modern", typedSize: 48, typedColor: "#0f172a", bg: "#ffffff" },
    { label: "Typed Executive Serif", typedStyle: "elegant", typedSize: 56, typedColor: "#0f172a", bg: "#ffffff" },
    { label: "Typed Cursive Blue", typedStyle: "cursive", typedSize: 64, typedColor: "#1d4ed8", bg: "#ffffff" },
    { label: "Typed Transparent", typedStyle: "cursive", typedSize: 64, typedColor: "#0f172a", transparent: true },
  ];

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Presets */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-sm font-medium">Presets</div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Ink</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {INK_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyInkPreset(p as any)}
                  className="shrink-0"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Background</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {BG_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyBgPreset(p as any)}
                  className="shrink-0"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Typed</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TYPED_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyTypedPreset(p as any)}
                  className="shrink-0"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            Tip: choose <span className="font-medium text-foreground">Transparent</span> background to export a PNG with
            no background.
          </div>
        </div>
      </div>

      {/* Mode */}
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

      {/* Preview */}
      <div className="rounded-lg border bg-background p-3 sm:p-4 w-full max-w-full">
        <div className="text-sm font-medium mb-3">Preview</div>
        <div
          className="rounded-lg border border-dashed p-3 sm:p-6 flex items-center justify-center min-h-[200px] sm:min-h-[260px] w-full max-w-full"
          style={transparentBgStyle}
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

      {/* Controls */}
      <div className="rounded-lg border bg-background p-3 sm:p-4 space-y-4 w-full max-w-full">
        {mode === "draw" ? (
          <>
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

            <div className="space-y-2 w-full max-w-full">
              <Label className="text-sm">Background</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={bgTransparent ? "default" : "outline"}
                  onClick={() => setBgTransparent(true)}
                  className="justify-start"
                >
                  Transparent
                </Button>
                {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={!bgTransparent && bgColor === c ? "default" : "outline"}
                    onClick={() => {
                      setBgTransparent(false);
                      setBgColor(c);
                    }}
                    className="justify-start"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: c }} />
                      {c === "#ffffff"
                        ? "White"
                        : c === "#f8fafc"
                          ? "Light Gray"
                          : c === "#fef3c7"
                            ? "Warm Paper"
                            : "Cool Paper"}
                    </span>
                  </Button>
                ))}
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
              <Select value={typedStyle} onValueChange={(v) => setTypedStyle(v as any)}>
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
              <Label className="text-sm">Background</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={bgTransparent ? "default" : "outline"}
                  onClick={() => setBgTransparent(true)}
                  className="justify-start"
                >
                  Transparent
                </Button>
                {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={!bgTransparent && bgColor === c ? "default" : "outline"}
                    onClick={() => {
                      setBgTransparent(false);
                      setBgColor(c);
                    }}
                    className="justify-start"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: c }} />
                      {c === "#ffffff"
                        ? "White"
                        : c === "#f8fafc"
                          ? "Light Gray"
                          : c === "#fef3c7"
                            ? "Warm Paper"
                            : "Cool Paper"}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Button className="w-full" onClick={downloadPNG}>
        <Download className="w-4 h-4 mr-2" /> Download Signature (PNG{bgTransparent ? " • Transparent" : ""})
      </Button>
    </div>
  );
}

/* ---------------------------------
  Resume Generator (with presets)
----------------------------------*/
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

  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);
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

  const applyResumeProfilePreset = (p: {
    label: string;
    title: string;
    summary: string;
    skills: string[];
    exp?: { role: string; company: string; start: string; end: string; bullets: string }[];
    edu?: { school: string; degree: string; start: string; end: string; details: string }[];
  }) => {
    setTitle(p.title);
    setSummary(p.summary);
    setSkills(p.skills.map((s) => ({ id: `${Date.now()}-${s}`, name: s })));
    if (p.exp?.length) {
      setExperiences(p.exp.map((e, idx) => ({ id: `${Date.now()}-exp-${idx}`, ...e })));
    }
    if (p.edu?.length) {
      setEducation(p.edu.map((e, idx) => ({ id: `${Date.now()}-edu-${idx}`, ...e })));
    }
    toast.success(`Resume preset: ${p.label}`);
  };

  const applyResumeStylePreset = (p: { label: string; summaryAdd?: string; bulletsTemplate?: string }) => {
    if (p.summaryAdd) setSummary((prev) => (prev ? `${prev}\n${p.summaryAdd}` : p.summaryAdd));
    if (p.bulletsTemplate) {
      setExperiences((prev) =>
        prev.map((e, idx) =>
          idx === 0 ? { ...e, bullets: e.bullets ? `${e.bullets}\n${p.bulletsTemplate}` : p.bulletsTemplate } : e,
        ),
      );
    }
    toast.success(`Style: ${p.label}`);
  };

  const RESUME_PROFILE_PRESETS = [
    {
      label: "Student / Graduate",
      title: "Student / Graduate",
      summary:
        "Motivated student with hands-on projects and strong fundamentals. Quick learner with a focus on clean communication, problem solving, and reliable execution.",
      skills: [
        "Communication",
        "Teamwork",
        "Problem Solving",
        "Research",
        "Time Management",
        "Microsoft Office / Google Workspace",
      ],
      exp: [
        {
          role: "Student Project",
          company: "University / Personal",
          start: "2025",
          end: "Present",
          bullets:
            "- Built and delivered a project from requirements to final result\n- Documented decisions and results clearly\n- Collaborated with teammates and met deadlines",
        },
      ],
      edu: [
        {
          school: "University",
          degree: "BSc / Program",
          start: "2023",
          end: "Present",
          details: "Relevant coursework, projects, and achievements.",
        },
      ],
    },
    {
      label: "Sales / BDR",
      title: "Business Development Representative (BDR)",
      summary:
        "Commercial and outbound-focused professional with experience in prospecting, qualification, and pipeline creation. Strong at messaging, objection handling, and turning conversations into meetings.",
      skills: [
        "Prospecting",
        "Cold Calling",
        "Email Outreach",
        "Qualification",
        "Pipeline Management",
        "CRM (Salesforce/HubSpot)",
      ],
      exp: [
        {
          role: "BDR / Sales Development",
          company: "Company",
          start: "2024",
          end: "Present",
          bullets:
            "- Prospected and qualified leads via calls, email, and LinkedIn\n- Booked meetings and supported account executives with handoffs\n- Maintained CRM hygiene and improved conversion with structured follow-ups",
        },
      ],
    },
    {
      label: "Account Executive",
      title: "Account Executive (AE)",
      summary:
        "Quota-carrying seller with end-to-end ownership: discovery, solution positioning, negotiation, and closing. Strong at stakeholder management and building repeatable deal processes.",
      skills: [
        "Discovery",
        "Consultative Selling",
        "Negotiation",
        "Forecasting",
        "Stakeholder Management",
        "Contracting",
      ],
      exp: [
        {
          role: "Account Executive",
          company: "Company",
          start: "2023",
          end: "Present",
          bullets:
            "- Managed full sales cycle from discovery to close\n- Built multi-threaded relationships and presented value to decision-makers\n- Improved win rate via better qualification and clear next steps",
        },
      ],
    },
    {
      label: "Customer Support",
      title: "Customer Support Specialist",
      summary:
        "Customer-focused support professional with experience resolving issues fast and clearly. Strong at prioritization, de-escalation, and improving customer experience through feedback loops.",
      skills: [
        "Customer Support",
        "Troubleshooting",
        "De-escalation",
        "Ticketing Systems",
        "Documentation",
        "Communication",
      ],
    },
    {
      label: "Marketing",
      title: "Marketing Specialist",
      summary:
        "Data-informed marketer focused on growth, content, and conversion. Comfortable running campaigns, analyzing performance, and iterating based on customer behavior.",
      skills: ["Content", "SEO", "Campaigns", "Analytics", "Copywriting", "Social Media"],
    },
    {
      label: "Software / Web Developer",
      title: "Software Developer",
      summary:
        "Developer focused on building clean, reliable products. Comfortable shipping features, debugging issues, and improving performance with practical engineering tradeoffs.",
      skills: ["JavaScript/TypeScript", "React", "APIs", "Databases", "Testing", "Git"],
    },
    {
      label: "Operations / Project",
      title: "Operations / Project Coordinator",
      summary:
        "Operations-minded contributor who brings structure, clarity, and accountability. Experienced coordinating tasks, stakeholders, and timelines to deliver on measurable outcomes.",
      skills: [
        "Project Coordination",
        "Process Improvement",
        "Stakeholder Management",
        "Documentation",
        "Reporting",
        "Problem Solving",
      ],
    },
    {
      label: "Executive / Director",
      title: "Director / Head of Function",
      summary:
        "Senior leader with experience setting strategy, driving execution, and leading teams. Focused on measurable impact, operational discipline, and cross-functional alignment.",
      skills: ["Leadership", "Strategy", "P&L / Budgeting", "KPI Management", "Hiring & Coaching", "Execution"],
    },
  ];

  const RESUME_STYLE_PRESETS = [
    {
      label: "Concise (1-page)",
      summaryAdd:
        "Keeps writing tight and impact-focused. Prioritizes only the strongest achievements and removes noise.",
      bulletsTemplate:
        "- [Impact] using [Method] resulting in [Metric]\n- Reduced / improved [X] by [Y]%\n- Owned [Task] end-to-end with clear outcomes",
    },
    {
      label: "Achievement-heavy",
      summaryAdd: "Highlights measurable achievements and business outcomes (metrics, rankings, revenue, time saved).",
      bulletsTemplate:
        "- Achieved [Result] by [Action] (impact: [Metric])\n- Increased [KPI] from [A] to [B]\n- Built a repeatable process that improved [Outcome]",
    },
    {
      label: "ATS-safe",
      summaryAdd: "Uses simple wording, standard section titles, and role-relevant keywords to improve ATS parsing.",
      bulletsTemplate:
        "- Tools: [CRM/Stack] • Methods: [Methodologies] • Keywords: [Role keywords]\n- Documented processes and maintained clean records\n- Collaborated cross-functionally with clear handoffs",
    },
  ];

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Presets */}
      <Card className="shadow-none w-full max-w-full">
        <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
          <div className="text-sm font-medium">Presets</div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Profile</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {RESUME_PROFILE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyResumeProfilePreset(p as any)}
                  className="shrink-0"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Writing style</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {RESUME_STYLE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyResumeStylePreset(p)}
                  className="shrink-0"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            Presets fill examples + structure. Replace placeholders with your real info and metrics.
          </div>
        </CardContent>
      </Card>

      {/* Mobile Preview */}
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

/* ---------------------------------
  Cover Letter Generator (with presets)
----------------------------------*/
function CoverLetterGeneratorEmbedded() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState<"Professional" | "Bold" | "Friendly" | "Concise" | "Enthusiastic">("Professional");
  const [content, setContent] = useState("");

  const applyCoverPreset = (p: { label: string; tone: any; content: string }) => {
    setTone(p.tone);
    setContent(p.content);
    toast.success(`Cover letter preset: ${p.label}`);
  };

  const COVER_PRESETS = [
    {
      label: "Cold Application (Professional)",
      tone: "Professional",
      content:
        "With a track record of delivering results and collaborating cross-functionally, I’m confident I can contribute quickly. I’m especially drawn to this role because it aligns with my strengths in execution, communication, and ownership. I’d welcome the chance to discuss how I can help the team achieve its goals.",
    },
    {
      label: "Referral / Warm Intro",
      tone: "Professional",
      content:
        "I was encouraged to apply after speaking with a colleague/referral who shared positive feedback about the team’s work and culture. My background aligns well with the role, and I’d love to bring my experience in delivering outcomes, building relationships, and driving execution to your team.",
    },
    {
      label: "Career Switcher",
      tone: "Professional",
      content:
        "I’m transitioning into this field with a strong foundation in transferable skills: problem solving, ownership, and clear communication. Through focused learning and hands-on projects, I’ve built practical capability and I’m excited to apply it in a real business environment.",
    },
    {
      label: "Short & Punchy",
      tone: "Concise",
      content:
        "I’m applying for this role because I can bring measurable impact fast. I’m strong in execution, stakeholder communication, and structured delivery. If helpful, I can share examples of work that matches your needs.",
    },
    {
      label: "Enthusiastic",
      tone: "Enthusiastic",
      content:
        "I’m genuinely excited about the opportunity to join your team. I love environments where people move fast, own outcomes, and learn constantly. I’d be thrilled to contribute my energy, skills, and drive to help the team win.",
    },
    {
      label: "Bold (Confident)",
      tone: "Bold",
      content:
        "You’re hiring for impact — and that’s exactly what I deliver. I’m comfortable taking ownership, working with ambiguity, and driving results under pressure. I’d like to show you how I approach problems and build outcomes.",
    },
    {
      label: "Tech Role",
      tone: "Professional",
      content:
        "I build solutions with a focus on reliability, clarity, and practical tradeoffs. I’m comfortable collaborating with stakeholders, translating requirements into deliverables, and shipping iteratively. I’d love to contribute to a team that values clean execution and real user value.",
    },
    {
      label: "Sales Role",
      tone: "Professional",
      content:
        "I’m motivated by targets, process, and repeatable performance. I’m strong in discovery, messaging, and moving deals forward with clear next steps. I’d be excited to bring a structured, metrics-driven approach to pipeline creation and closing.",
    },
    {
      label: "Leadership Role",
      tone: "Professional",
      content:
        "I lead through clarity, accountability, and measurable outcomes. I’m experienced aligning stakeholders, building repeatable execution rhythms, and developing teams to perform consistently. I’d welcome the chance to contribute leadership and operating discipline to your organization.",
    },
    {
      label: "Internship / Graduate",
      tone: "Friendly",
      content:
        "I’m eager to learn, contribute, and grow quickly. I’ve built a foundation through coursework and projects, and I’m ready to apply it in a real team setting. I’d love an opportunity to bring energy, curiosity, and strong work ethic to the role.",
    },
  ];

  const letter = useMemo(() => {
    const greetings: Record<string, string> = {
      Professional: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Manager,",
      Bold: `To the Team at ${company || "the Company"},`,
      Friendly: hiringManager ? `Hi ${hiringManager.split(" ")[0]},` : "Hi there!",
      Concise: "To whom it may concern,",
      Enthusiastic: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Team!",
    };

    const closings: Record<string, string> = {
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

I am writing to express my ${tone === "Enthusiastic" ? "strong " : ""}interest in the ${role || "open position"}${company ? ` at ${company}` : ""}. ${content}

${closings[tone]}
${fullName}`.trim();
  }, [fullName, email, phone, address, company, role, hiringManager, tone, content]);

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Presets */}
      <Card className="shadow-none w-full max-w-full">
        <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
          <div className="text-sm font-medium">Presets</div>
          <div className="text-xs text-muted-foreground">Scenario</div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {COVER_PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                onClick={() => applyCoverPreset(p as any)}
                className="shrink-0"
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            Presets fill a solid base. Customize with your metrics, projects, and why this company.
          </div>
        </CardContent>
      </Card>

      {/* Mobile Preview */}
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
                <Select value={tone} onValueChange={(v) => setTone(v as any)}>
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

/* ---------------------------------
  Page
----------------------------------*/
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
