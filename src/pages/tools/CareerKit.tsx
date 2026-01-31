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
  ArrowLeft,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";

import { useMoat } from "@/hooks/useMoat";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

/** Creates a share URL with encoded settings (works even if Moat doesn’t provide share URL helper) */
function buildShareUrl(toolSlug: string, settings: any) {
  const base = window.location.origin + window.location.pathname;
  const payload = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(settings)))));
  return `${base}?tool=${encodeURIComponent(toolSlug)}&s=${payload}`;
}

/** Reads ?tool=...&s=... and returns decoded settings if matches current toolSlug */
function readShareUrl(toolSlug: string) {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tool");
  const s = params.get("s");
  if (!t || !s) return null;
  if (t !== toolSlug) return null;

  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(s))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function MoatPanel({
  toolSlug,
  settings,
  setSettings,
  defaultSettings,
  recommendedPresets,
}: {
  toolSlug: string;
  settings: any;
  setSettings: (fn: any) => void;
  defaultSettings: any;
  recommendedPresets: { name: string; settings: any }[];
}) {
  const copyShare = async () => {
    const url = buildShareUrl(toolSlug, settings);
    await copyToClipboard(url);
    toast.success("Share link copied");
  };

  return (
    <div className="rounded-lg border bg-background p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Presets</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyShare}>
            <LinkIcon className="w-4 h-4 mr-2" /> Copy Link
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSettings(() => ({ ...defaultSettings }));
              toast.success("Reset");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {recommendedPresets.map((p) => (
          <Button
            key={p.name}
            size="sm"
            variant="outline"
            onClick={() => {
              setSettings(() => ({ ...p.settings }));
              toast.success(`Applied: ${p.name}`);
            }}
          >
            {p.name}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: presets + link make this tool “shareable”. You can save favorite defaults later via Moat.
      </p>
    </div>
  );
}

/* =============================
   SIGNATURE (MOAT ENABLED)
============================= */
function SignatureGeneratorEmbedded() {
  const toolSlug = "career-kit-signature";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  type SignatureSettings = {
    mode: string;
    penWidth: number;
    penColor: string;
    bgColor: string;
    strokes: { points: { x: number; y: number }[]; width: number; color: string }[];
    typedName: string;
    typedSize: number;
    typedStyle: string;
    typedColor: string;
    isDrawing?: boolean;
  };

  const DEFAULT: SignatureSettings = {
    mode: "draw",
    penWidth: 3,
    penColor: "#0f172a",
    bgColor: "#ffffff",
    strokes: [],
    typedName: "Your Name",
    typedSize: 56,
    typedStyle: "cursive",
    typedColor: "#0f172a",
    isDrawing: false,
  };

  const RECOMMENDED = [
    {
      name: "Classic (Black)",
      settings: { ...DEFAULT, penColor: "#0f172a", typedColor: "#0f172a", bgColor: "#ffffff" },
    },
    {
      name: "Blue Ink",
      settings: { ...DEFAULT, penColor: "#1d4ed8", typedColor: "#1d4ed8", bgColor: "#ffffff" },
    },
    {
      name: "Green Ink",
      settings: { ...DEFAULT, penColor: "#16a34a", typedColor: "#16a34a", bgColor: "#ffffff" },
    },
    {
      name: "Warm Paper",
      settings: { ...DEFAULT, bgColor: "#fef3c7" },
    },
  ];

  const [settings, setSettings] = useState<SignatureSettings>(DEFAULT);

  // Wrapper for moat integration
  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as SignatureSettings);

  // Moat: persist + hydrate
  useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT as Record<string, unknown>,
    recommendedPresets: RECOMMENDED.map((p) => ({ id: p.name, ...p, settings: p.settings as Record<string, unknown> })),
  });

  // Also allow share URL hydration even if Moat share layer isn’t wired yet
  useEffect(() => {
    const shared = readShareUrl(toolSlug);
    if (shared) {
      setSettings((prev: any) => ({ ...prev, ...shared }));
      toast.success("Loaded from shared link");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { mode, penWidth, penColor, bgColor, strokes, typedName, typedSize, typedStyle, typedColor } = settings;

  const set = (patch: any) => setSettings((p: any) => ({ ...p, ...patch }));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === "draw") drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, penWidth, mode, bgColor, penColor]);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: any) => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const pos = getPos(e.nativeEvent);
    set({ strokes: [...strokes, { points: [pos], width: penWidth, color: penColor }], isDrawing: true });
  };

  const onPointerMove = (e: any) => {
    if (mode !== "draw" || !settings.isDrawing) return;
    const pos = getPos(e.nativeEvent);

    setSettings((prev: any) => {
      const last = prev.strokes[prev.strokes.length - 1];
      if (!last) return prev;
      const updated = { ...last, points: [...last.points, pos] };
      return { ...prev, strokes: [...prev.strokes.slice(0, -1), updated] };
    });
  };

  const stopDrawing = () => set({ isDrawing: false });

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

      const fontMap: any = {
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
      <MoatPanel
        toolSlug={toolSlug}
        settings={settings}
        setSettings={setSettings}
        defaultSettings={DEFAULT}
        recommendedPresets={RECOMMENDED}
      />

      <div className="flex gap-2 w-full">
        <Button
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={() => set({ mode: "draw" })}
          className="flex-1 sm:flex-none min-w-0"
        >
          <PenTool className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">Draw</span>
        </Button>
        <Button
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          onClick={() => set({ mode: "type" })}
          className="flex-1 sm:flex-none min-w-0"
        >
          <span className="truncate">Type</span>
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-3 sm:p-4 w-full max-w-full">
        <div className="text-sm font-medium mb-3">Preview</div>
        <div
          className="rounded-lg border border-dashed p-3 sm:p-6 flex items-center justify-center min-h-[200px] sm:min-h-[260px] w-full max-w-full"
          style={{ backgroundColor: bgColor }}
        >
          {mode === "draw" ? (
            <div ref={wrapRef} className="w-full max-w-full">
              <canvas
                ref={canvasRef}
                className="w-full max-w-full rounded-md border bg-transparent touch-none cursor-crosshair"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
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
              <Label className="text-sm">Pen Width: {penWidth}px</Label>
              <Slider
                value={[penWidth]}
                onValueChange={(v) => set({ penWidth: v[0] })}
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
                  onChange={(e) => set({ penColor: e.target.value })}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ penColor: c })}
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
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => set({ bgColor: e.target.value })}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ bgColor: c })}
                      className={`h-9 w-9 shrink-0 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set background ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                size="sm"
                variant="outline"
                onClick={() => set({ strokes: strokes.slice(0, -1) })}
                disabled={isEmpty}
                className="w-full min-w-0"
              >
                <Undo2 className="w-4 h-4 mr-1 sm:mr-2" /> <span className="truncate">Undo</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => set({ strokes: [] })}
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
              <Input value={typedName} onChange={(e) => set({ typedName: e.target.value })} className="w-full" />
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Font Size: {typedSize}px</Label>
              <Slider
                value={[typedSize]}
                onValueChange={(v) => set({ typedSize: v[0] })}
                min={28}
                max={120}
                step={4}
                className="w-full"
              />
            </div>

            <div className="space-y-2 w-full">
              <Label className="text-sm">Font Style</Label>
              <Select value={typedStyle} onValueChange={(v) => set({ typedStyle: v })}>
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
                  onChange={(e) => set({ typedColor: e.target.value })}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ typedColor: c })}
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
              <div className="flex items-start gap-2 w-full max-w-full">
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(e) => set({ bgColor: e.target.value })}
                  className="w-12 h-10 p-1 shrink-0"
                />
                <div className="flex gap-2 flex-wrap flex-1 min-w-0">
                  {["#ffffff", "#f8fafc", "#fef3c7", "#dbeafe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ bgColor: c })}
                      className={`h-9 w-9 shrink-0 rounded-md border ${bgColor === c ? "ring-2 ring-ring" : ""}`}
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

/* =============================
   RESUME (MOAT ENABLED)
============================= */
function ResumeGeneratorEmbedded() {
  const toolSlug = "career-kit-resume";

  const DEFAULT = {
    fullName: "",
    title: "",
    location: "",
    email: "",
    phone: "",
    website: "",
    linkedin: "",
    summary: "",
    experiences: [{ id: "1", role: "", company: "", start: "", end: "", bullets: "" }],
    education: [{ id: "1", school: "", degree: "", start: "", end: "", details: "" }],
    skills: [] as { id: string; name: string }[],
    newSkill: "",
  };

  const RECOMMENDED = [
    { name: "Simple Starter", settings: { ...DEFAULT, summary: "Results-driven professional with experience in..." } },
    {
      name: "Sales Profile",
      settings: {
        ...DEFAULT,
        title: "Sales / Business Development",
        summary: "Commercial leader with proven growth, pipeline, and negotiation experience.",
        skills: [
          { id: "1", name: "Prospecting" },
          { id: "2", name: "Negotiation" },
          { id: "3", name: "CRM" },
        ],
      },
    },
    {
      name: "Tech Profile",
      settings: {
        ...DEFAULT,
        title: "Software / Web Developer",
        summary: "Builder mindset. I ship fast, clean products with strong UX.",
        skills: [
          { id: "1", name: "React" },
          { id: "2", name: "TypeScript" },
          { id: "3", name: "Supabase" },
        ],
      },
    },
  ];

  const [settings, setSettings] = useState(DEFAULT);

  // Wrapper for moat integration
  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as typeof DEFAULT);

  useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT as Record<string, unknown>,
    recommendedPresets: RECOMMENDED.map((p) => ({ id: p.name, ...p, settings: p.settings as Record<string, unknown> })),
  });

  useEffect(() => {
    const shared = readShareUrl(toolSlug);
    if (shared) {
      setSettings((prev: any) => ({ ...prev, ...shared }));
      toast.success("Loaded from shared link");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: any) => setSettings((p: any) => ({ ...p, ...patch }));

  const output = useMemo(() => {
    const { fullName, title, location, email, phone, website, linkedin, summary, experiences, education, skills } =
      settings;

    const contacts = [location, email, phone, website, linkedin].filter(Boolean);
    const headerLine = contacts.length > 0 ? contacts.join(" • ") : "";

    const expBlock = experiences
      .filter((e: any) => e.role || e.company)
      .map((e: any) => {
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        const top = [e.role, e.company].filter(Boolean).join(" @ ");
        return `${top}${dates ? ` (${dates})` : ""}\n${e.bullets || ""}`.trim();
      })
      .join("\n\n");

    const eduBlock = education
      .filter((ed: any) => ed.school || ed.degree)
      .map((ed: any) => {
        const dates = [ed.start, ed.end].filter(Boolean).join(" – ");
        const top = [ed.degree, ed.school].filter(Boolean).join(", ");
        return `${top}${dates ? ` (${dates})` : ""}${ed.details ? `\n${ed.details}` : ""}`.trim();
      })
      .join("\n\n");

    const skillsBlock = skills.length > 0 ? skills.map((s: any) => s.name).join(" • ") : "";

    let result = `${(fullName || "YOUR NAME").toUpperCase()}\n${title || ""}`;
    if (headerLine) result += `\n${headerLine}`;
    if (summary) result += `\n\nPROFESSIONAL SUMMARY\n${summary}`;
    if (skillsBlock) result += `\n\nSKILLS\n${skillsBlock}`;
    if (expBlock) result += `\n\nEXPERIENCE\n${expBlock}`;
    if (eduBlock) result += `\n\nEDUCATION\n${eduBlock}`;

    return result.trim();
  }, [settings]);

  const addSkill = () => {
    if (!settings.newSkill.trim()) return;
    set({
      skills: [...settings.skills, { id: Date.now().toString(), name: settings.newSkill.trim() }],
      newSkill: "",
    });
  };

  return (
    <div className="space-y-4 w-full max-w-full">
      <MoatPanel
        toolSlug={toolSlug}
        settings={settings}
        setSettings={setSettings}
        defaultSettings={DEFAULT}
        recommendedPresets={RECOMMENDED}
      />

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
                  <Input
                    value={settings.fullName}
                    onChange={(e) => set({ fullName: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Job Title</Label>
                  <Input value={settings.title} onChange={(e) => set({ title: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Location</Label>
                  <Input
                    value={settings.location}
                    onChange={(e) => set({ location: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Email</Label>
                  <Input value={settings.email} onChange={(e) => set({ email: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Phone</Label>
                  <Input value={settings.phone} onChange={(e) => set({ phone: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Website</Label>
                  <Input
                    value={settings.website}
                    onChange={(e) => set({ website: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 w-full">
                  <Label className="text-sm">LinkedIn</Label>
                  <Input
                    value={settings.linkedin}
                    onChange={(e) => set({ linkedin: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2 w-full">
                <Label className="text-sm">Professional Summary</Label>
                <Textarea
                  value={settings.summary}
                  onChange={(e) => set({ summary: e.target.value })}
                  rows={4}
                  className="resize-none w-full"
                />
              </div>

              <div className="space-y-2 w-full max-w-full">
                <Label className="text-sm">Skills</Label>
                <div className="flex gap-2 w-full">
                  <Input
                    placeholder="Add a skill"
                    value={settings.newSkill}
                    onChange={(e) => set({ newSkill: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    className="flex-1 min-w-0"
                  />
                  <Button onClick={addSkill} size="icon" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {settings.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 w-full">
                    {settings.skills.map((skill: any) => (
                      <div
                        key={skill.id}
                        className="bg-muted px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border flex items-center gap-2"
                      >
                        <span className="text-xs sm:text-sm">{skill.name}</span>
                        <button
                          onClick={() => set({ skills: settings.skills.filter((s: any) => s.id !== skill.id) })}
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
                set({
                  experiences: [
                    ...settings.experiences,
                    { id: Date.now().toString(), role: "", company: "", start: "", end: "", bullets: "" },
                  ],
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          {settings.experiences.map((exp: any, i: number) => (
            <Card key={exp.id} className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="text-xs text-muted-foreground">Experience {i + 1}</div>
                  {settings.experiences.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        set({ experiences: settings.experiences.filter((_: any, idx: number) => idx !== i) })
                      }
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
                      const next = [...settings.experiences];
                      next[i] = { ...next[i], role: e.target.value };
                      set({ experiences: next });
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Company"
                    value={exp.company}
                    onChange={(e) => {
                      const next = [...settings.experiences];
                      next[i] = { ...next[i], company: e.target.value };
                      set({ experiences: next });
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Start"
                    value={exp.start}
                    onChange={(e) => {
                      const next = [...settings.experiences];
                      next[i] = { ...next[i], start: e.target.value };
                      set({ experiences: next });
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="End"
                    value={exp.end}
                    onChange={(e) => {
                      const next = [...settings.experiences];
                      next[i] = { ...next[i], end: e.target.value };
                      set({ experiences: next });
                    }}
                    className="w-full"
                  />
                </div>

                <Textarea
                  placeholder="Bullets"
                  value={exp.bullets}
                  onChange={(e) => {
                    const next = [...settings.experiences];
                    next[i] = { ...next[i], bullets: e.target.value };
                    set({ experiences: next });
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
                set({
                  education: [
                    ...settings.education,
                    { id: Date.now().toString(), school: "", degree: "", start: "", end: "", details: "" },
                  ],
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>

          {settings.education.map((ed: any, i: number) => (
            <Card key={ed.id} className="shadow-none w-full max-w-full">
              <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="text-xs text-muted-foreground">Education {i + 1}</div>
                  {settings.education.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => set({ education: settings.education.filter((_: any, idx: number) => idx !== i) })}
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
                      const next = [...settings.education];
                      next[i] = { ...next[i], school: e.target.value };
                      set({ education: next });
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Degree"
                    value={ed.degree}
                    onChange={(e) => {
                      const next = [...settings.education];
                      next[i] = { ...next[i], degree: e.target.value };
                      set({ education: next });
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="Start"
                    value={ed.start}
                    onChange={(e) => {
                      const next = [...settings.education];
                      next[i] = { ...next[i], start: e.target.value };
                      set({ education: next });
                    }}
                    className="w-full"
                  />
                  <Input
                    placeholder="End"
                    value={ed.end}
                    onChange={(e) => {
                      const next = [...settings.education];
                      next[i] = { ...next[i], end: e.target.value };
                      set({ education: next });
                    }}
                    className="w-full"
                  />
                </div>

                <Textarea
                  placeholder="Details"
                  value={ed.details}
                  onChange={(e) => {
                    const next = [...settings.education];
                    next[i] = { ...next[i], details: e.target.value };
                    set({ education: next });
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

/* =============================
   COVER LETTER (MOAT ENABLED)
============================= */
function CoverLetterGeneratorEmbedded() {
  const toolSlug = "career-kit-cover-letter";

  const DEFAULT = {
    fullName: "",
    email: "",
    phone: "",
    address: "",
    company: "",
    role: "",
    hiringManager: "",
    tone: "Professional",
    content: "",
  };

  const RECOMMENDED = [
    {
      name: "Professional",
      settings: {
        ...DEFAULT,
        tone: "Professional",
        content: "I bring strong execution and clear communication. I’d love to contribute to your team’s goals.",
      },
    },
    {
      name: "Bold",
      settings: {
        ...DEFAULT,
        tone: "Bold",
        content: "I move fast, learn faster, and I ship results. If you need someone who owns outcomes—let’s talk.",
      },
    },
    {
      name: "Concise",
      settings: {
        ...DEFAULT,
        tone: "Concise",
        content: "I’m interested in this role and believe my background fits. I’d welcome the opportunity to discuss.",
      },
    },
  ];

  const [settings, setSettings] = useState(DEFAULT);

  // Wrapper for moat integration
  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as typeof DEFAULT);

  useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT as Record<string, unknown>,
    recommendedPresets: RECOMMENDED.map((p) => ({ id: p.name, ...p, settings: p.settings as Record<string, unknown> })),
  });

  useEffect(() => {
    const shared = readShareUrl(toolSlug);
    if (shared) {
      setSettings((prev: any) => ({ ...prev, ...shared }));
      toast.success("Loaded from shared link");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: any) => setSettings((p: any) => ({ ...p, ...patch }));

  const letter = useMemo(() => {
    const { fullName, email, phone, address, company, role, hiringManager, tone, content } = settings;

    const greetings: any = {
      Professional: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Manager,",
      Bold: `To the Team at ${company || "the Company"},`,
      Friendly: hiringManager ? `Hi ${hiringManager.split(" ")[0]},` : "Hi there!",
      Concise: "To whom it may concern,",
      Enthusiastic: hiringManager ? `Dear ${hiringManager},` : "Dear Hiring Team!",
    };

    const closings: any = {
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
  }, [settings]);

  return (
    <div className="space-y-4 w-full max-w-full">
      <MoatPanel
        toolSlug={toolSlug}
        settings={settings}
        setSettings={setSettings}
        defaultSettings={DEFAULT}
        recommendedPresets={RECOMMENDED}
      />

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
                  <Input
                    value={settings.fullName}
                    onChange={(e) => set({ fullName: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Email</Label>
                  <Input value={settings.email} onChange={(e) => set({ email: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Phone</Label>
                  <Input value={settings.phone} onChange={(e) => set({ phone: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Address</Label>
                  <Input
                    value={settings.address}
                    onChange={(e) => set({ address: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none w-full max-w-full">
            <CardContent className="pt-4 sm:pt-6 space-y-3 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Company</Label>
                  <Input
                    value={settings.company}
                    onChange={(e) => set({ company: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2 w-full">
                  <Label className="text-sm">Role</Label>
                  <Input value={settings.role} onChange={(e) => set({ role: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-2 sm:col-span-2 w-full">
                  <Label className="text-sm">Hiring Manager</Label>
                  <Input
                    value={settings.hiringManager}
                    onChange={(e) => set({ hiringManager: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2 w-full">
                <Label className="text-sm">Tone</Label>
                <Select value={settings.tone} onValueChange={(v) => set({ tone: v })}>
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
                  value={settings.content}
                  onChange={(e) => set({ content: e.target.value })}
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

/* =============================
   PAGE
============================= */
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
