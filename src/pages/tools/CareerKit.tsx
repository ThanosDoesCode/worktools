import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* -----------------------------
   Helpers
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
type InkPreset = {
  label: string;
  penWidth: number;
  penColor: string;
};

type BgPreset = {
  label: string;
  bg?: string;
  transparent?: boolean;
};

type TypedPreset = {
  label: string;
  typedStyle: "cursive" | "elegant" | "serif" | "modern" | "sans";
  typedSize: number;
  typedColor: string;
  bg?: string;
  transparent?: boolean;
};

function SignatureGeneratorEmbedded() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [strokes, setStrokes] = useState<{ points: { x: number; y: number }[]; width: number; color: string }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [typedName, setTypedName] = useState("Your Name");
  const [typedSize, setTypedSize] = useState(56);
  const [typedStyle, setTypedStyle] = useState<TypedPreset["typedStyle"]>("cursive");
  const [typedColor, setTypedColor] = useState("#0f172a");

  // Exclusive transparency mode:
  // - "draw": exported PNG is transparent ONLY for drawing
  // - "type": exported PNG is transparent ONLY for typing
  // - "none": solid background export
  type TransparentMode = "none" | "draw" | "type";
  const [transparentMode, setTransparentMode] = useState<TransparentMode>("none");
  const [bgTransparent, setBgTransparent] = useState(false);

  const setTransparency = (m: TransparentMode) => {
    setTransparentMode(m);
    setBgTransparent(m !== "none");
  };

  /* -----------------------------
     Presets
  ------------------------------*/
  const INK_PRESETS: InkPreset[] = [
    { label: "Classic Black (3px)", penWidth: 3, penColor: "#0f172a" },
    { label: "Bold Black (6px)", penWidth: 6, penColor: "#0f172a" },
    { label: "Marker Black (9px)", penWidth: 9, penColor: "#0f172a" },

    { label: "Ballpoint Blue (3px)", penWidth: 3, penColor: "#1d4ed8" },
    { label: "Navy Ink (4px)", penWidth: 4, penColor: "#0b1f4a" },

    { label: "Slate Ink (3px)", penWidth: 3, penColor: "#334155" },
    { label: "Charcoal Ink (4px)", penWidth: 4, penColor: "#111827" },

    { label: "Green Ink (3px)", penWidth: 3, penColor: "#16a34a" },
    { label: "Emerald Ink (4px)", penWidth: 4, penColor: "#059669" },
    { label: "Red Ink (3px)", penWidth: 3, penColor: "#dc2626" },
    { label: "Burgundy Ink (4px)", penWidth: 4, penColor: "#7f1d1d" },
    { label: "Purple Ink (3px)", penWidth: 3, penColor: "#7c3aed" },
    { label: "Indigo Ink (4px)", penWidth: 4, penColor: "#4f46e5" },
  ];

  const BG_PRESETS: BgPreset[] = [
    { label: "White", bg: "#ffffff" },
    { label: "Paper (Cool)", bg: "#f8fafc" },
    { label: "Paper (Warm)", bg: "#fef3c7" },
    { label: "Soft Blue", bg: "#dbeafe" },
    { label: "Soft Green", bg: "#dcfce7" },
    { label: "Soft Pink", bg: "#fce7f3" },
    { label: "Light Gray", bg: "#f3f4f6" },

    // Transparent for DRAW exports (exclusive with typed transparent)
    { label: "Transparent Background (Draw PNG)", transparent: true },
  ];

  const TYPED_PRESETS: TypedPreset[] = [
    { label: "Cursive — Elegant Black", typedStyle: "cursive", typedSize: 60, typedColor: "#0f172a", bg: "#ffffff" },
    { label: "Cursive — Slate", typedStyle: "cursive", typedSize: 60, typedColor: "#334155", bg: "#ffffff" },
    { label: "Cursive — Navy", typedStyle: "cursive", typedSize: 60, typedColor: "#0b1f4a", bg: "#ffffff" },
    { label: "Cursive — Emerald", typedStyle: "cursive", typedSize: 60, typedColor: "#059669", bg: "#ffffff" },
    { label: "Cursive — Burgundy", typedStyle: "cursive", typedSize: 60, typedColor: "#7f1d1d", bg: "#ffffff" },
    { label: "Cursive — Purple", typedStyle: "cursive", typedSize: 60, typedColor: "#7c3aed", bg: "#ffffff" },

    {
      label: "Elegant Serif — Luxury Black",
      typedStyle: "elegant",
      typedSize: 64,
      typedColor: "#0f172a",
      bg: "#ffffff",
    },
    { label: "Classic Serif — Black", typedStyle: "serif", typedSize: 58, typedColor: "#0f172a", bg: "#ffffff" },
    { label: "Classic Serif — Slate", typedStyle: "serif", typedSize: 58, typedColor: "#334155", bg: "#ffffff" },

    { label: "Modern Sans — Black", typedStyle: "modern", typedSize: 56, typedColor: "#0f172a", bg: "#ffffff" },
    { label: "Modern Sans — Blue", typedStyle: "modern", typedSize: 56, typedColor: "#1d4ed8", bg: "#ffffff" },
    { label: "Simple Sans — Charcoal", typedStyle: "sans", typedSize: 54, typedColor: "#111827", bg: "#ffffff" },

    { label: "Cursive on Warm Paper", typedStyle: "cursive", typedSize: 60, typedColor: "#0f172a", bg: "#fef3c7" },
    { label: "Modern on Cool Paper", typedStyle: "modern", typedSize: 56, typedColor: "#0f172a", bg: "#f8fafc" },

    // Transparent for TYPE exports (exclusive with draw transparent)
    { label: "Transparent (Type PNG)", typedStyle: "cursive", typedSize: 60, typedColor: "#0f172a", transparent: true },
  ];

  const [inkPreset, setInkPreset] = useState(INK_PRESETS[0].label);
  const [bgPreset, setBgPreset] = useState(BG_PRESETS[0].label);
  const [typedPreset, setTypedPreset] = useState(TYPED_PRESETS[0].label);

  /* -----------------------------
     IMPORTANT: Light checkerboard ALWAYS
     (Even in dark mode so black ink is visible)
  ------------------------------*/
  const lightCheckerboardStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    backgroundImage: `
      linear-gradient(45deg, rgba(0,0,0,.06) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(0,0,0,.06) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(0,0,0,.06) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(0,0,0,.06) 75%)
    `,
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
  };

  const previewStyle: React.CSSProperties =
    transparentMode !== "none" ? lightCheckerboardStyle : { backgroundColor: bgColor };

  /* -----------------------------
     Mode switching with mutual reset
     - When switching to DRAW: deactivate typed transparency preset (if active)
     - When switching to TYPE: deactivate draw transparency preset (if active)
  ------------------------------*/
  const switchToDraw = () => {
    setMode("draw");

    // If type transparency was active, turn it off and reset typed preset
    if (transparentMode === "type") {
      setTransparency("none");
      setBgPreset(BG_PRESETS[0].label);
      setBgColor(BG_PRESETS[0].bg || "#ffffff");
    }

    // Reset typed preset selection (deactivate typed option)
    const tp = TYPED_PRESETS[0];
    setTypedPreset(tp.label);
    setTypedStyle(tp.typedStyle);
    setTypedSize(tp.typedSize);
    setTypedColor(tp.typedColor);
  };

  const switchToType = () => {
    setMode("type");

    // If draw transparency was active, turn it off and reset bg preset
    if (transparentMode === "draw") {
      setTransparency("none");
      setBgPreset(BG_PRESETS[0].label);
      setBgColor(BG_PRESETS[0].bg || "#ffffff");
    }

    // Reset ink preset selection (deactivate draw option)
    const ip = INK_PRESETS[0];
    setInkPreset(ip.label);
    setPenWidth(ip.penWidth);
    setPenColor(ip.penColor);
  };

  /* -----------------------------
     Canvas drawing
  ------------------------------*/
  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Fill background only when not transparent
    if (!bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    // helper line
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
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
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
  }, [strokes, penWidth, penColor, bgColor, bgTransparent, mode]);

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
      const updated = { ...last, points: [...last.points, pos] };
      return [...prev.slice(0, -1), updated];
    });
  };

  /* -----------------------------
     Apply Presets
  ------------------------------*/
  const applyInkPreset = (label: string) => {
    const p = INK_PRESETS.find((x) => x.label === label);
    if (!p) return;

    // activate draw and reset type
    switchToDraw();

    setInkPreset(label);
    setPenWidth(p.penWidth);
    setPenColor(p.penColor);
    toast.success(`Ink preset: ${p.label}`);
  };

  const applyBgPreset = (label: string) => {
    const p = BG_PRESETS.find((x) => x.label === label);
    if (!p) return;

    setBgPreset(label);

    if (p.transparent) {
      // transparent background for DRAW only
      switchToDraw();
      setTransparency("draw");
      toast.success("Background: Transparent (Draw exports as transparent PNG)");
      return;
    }

    if (p.bg) {
      // solid bg disables transparency
      setTransparency("none");
      setBgColor(p.bg);
      toast.success(`Background: ${p.label}`);
    }
  };

  const applyTypedPreset = (label: string) => {
    const p = TYPED_PRESETS.find((x) => x.label === label);
    if (!p) return;

    // activate type and reset draw
    switchToType();

    setTypedPreset(label);
    setTypedStyle(p.typedStyle);
    setTypedSize(p.typedSize);
    setTypedColor(p.typedColor);

    if (p.transparent) {
      setTransparency("type");
      toast.success("Typed: Transparent (Type exports as transparent PNG)");
      return;
    }

    if (p.bg) {
      setTransparency("none");
      setBgColor(p.bg);
      toast.success(`Typed preset: ${p.label}`);
    }
  };

  /* -----------------------------
     Export
  ------------------------------*/
  const downloadPNG = () => {
    if (mode === "type") {
      const exportCanvas = document.createElement("canvas");
      const w = 1200;
      const h = 420;
      exportCanvas.width = w;
      exportCanvas.height = h;

      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return;

      // Background: fill only when NOT type-transparent
      if (transparentMode !== "type") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.fillStyle = typedColor;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      const fontMap: Record<TypedPreset["typedStyle"], string> = {
        cursive: "cursive",
        serif: "Georgia, serif",
        sans: "Arial, sans-serif",
        elegant: "'Times New Roman', serif",
        modern: "'Helvetica Neue', sans-serif",
      };

      ctx.font = `${typedSize * 4}px ${fontMap[typedStyle]}`;
      ctx.fillText(typedName || "Your Name", w / 2, h / 2);

      exportCanvas.toBlob((b) => b && downloadBlob("signature.png", b));
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

  const palette = ["#0f172a", "#334155", "#16a34a", "#dc2626", "#7c3aed", "#1d4ed8", "#111827"];

  return (
    <div className="space-y-4 w-full max-w-full">
      <div className="flex gap-2 w-full">
        <Button
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={switchToDraw}
          className="flex-1 sm:flex-none min-w-0"
        >
          <PenTool className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">Draw</span>
        </Button>
        <Button
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          onClick={switchToType}
          className="flex-1 sm:flex-none min-w-0"
        >
          <span className="truncate">Type</span>
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-3 sm:p-4 w-full max-w-full">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="text-sm font-medium">Preview</div>
          <div className="text-xs text-muted-foreground">
            {transparentMode === "none"
              ? "Solid background export"
              : transparentMode === "draw"
                ? "Transparent export: Draw"
                : "Transparent export: Type"}
          </div>
        </div>

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

      {/* Presets (Dropdowns) */}
      <div className="rounded-lg border bg-background p-3 sm:p-4 space-y-4 w-full max-w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div className="space-y-2">
            <Label className="text-sm">Ink Preset</Label>
            <Select value={inkPreset} onValueChange={applyInkPreset}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose ink preset" />
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

          <div className="space-y-2">
            <Label className="text-sm">Background Preset</Label>
            <Select value={bgPreset} onValueChange={applyBgPreset}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose background" />
              </SelectTrigger>
              <SelectContent>
                {BG_PRESETS.map((p) => {
                  const isTransparentOption = !!p.transparent;
                  const disabled = isTransparentOption && transparentMode === "type";
                  return (
                    <SelectItem key={p.label} value={p.label} disabled={disabled}>
                      {p.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {transparentMode === "type" && (
              <p className="text-xs text-muted-foreground">
                “Transparent Background (Draw PNG)” is disabled while “Transparent (Type PNG)” is active.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Typed Preset</Label>
            <Select value={typedPreset} onValueChange={applyTypedPreset}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose typed preset" />
              </SelectTrigger>
              <SelectContent>
                {TYPED_PRESETS.map((p) => {
                  const isTransparentOption = !!p.transparent;
                  const disabled = isTransparentOption && transparentMode === "draw";
                  return (
                    <SelectItem key={p.label} value={p.label} disabled={disabled}>
                      {p.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {transparentMode === "draw" && (
              <p className="text-xs text-muted-foreground">
                “Transparent (Type PNG)” is disabled while “Transparent Background (Draw PNG)” is active.
              </p>
            )}
          </div>
        </div>

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
              <Label className="text-sm">Background Color</Label>
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => {
                    setBgColor(e.target.value);
                    if (transparentMode !== "none") setTransparency("none");
                  }}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#f3f4f6"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setBgColor(c);
                        if (transparentMode !== "none") setTransparency("none");
                      }}
                      className={`h-9 w-9 shrink-0 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                    />
                  ))}
                </div>
              </div>
              {transparentMode !== "none" && (
                <p className="text-xs text-muted-foreground">
                  Picking a solid background color turns off transparency.
                </p>
              )}
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
              <Label className="text-sm">Background Color</Label>
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => {
                    setBgColor(e.target.value);
                    if (transparentMode !== "none") setTransparency("none");
                  }}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#f3f4f6"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setBgColor(c);
                        if (transparentMode !== "none") setTransparency("none");
                      }}
                      className={`h-9 w-9 shrink-0 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                    />
                  ))}
                </div>
              </div>
              {transparentMode !== "none" && (
                <p className="text-xs text-muted-foreground">
                  Picking a solid background color turns off transparency.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <Button className="w-full" onClick={downloadPNG}>
        <Download className="w-4 h-4 mr-2" /> Download Signature (PNG)
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

I am writing to express my ${tone === "Enthusiastic" ? "strong " : ""}interest in the ${
      role || "open position"
    }${company ? ` at ${company}` : ""}. ${content}

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

/* -----------------------------
   Page
------------------------------*/
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
