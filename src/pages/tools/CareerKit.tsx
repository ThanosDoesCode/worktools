import { useEffect, useRef, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, PenTool, FileUser, Mail } from "lucide-react";

export default function CareerKit() {
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const el = tabScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = tabScrollRef.current;
    if (!el) return;

    const onScroll = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => updateScrollButtons());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const scrollTabsBy = (delta: number) => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <ToolLayout title="Career Kit" description="Signature, Resume/CV, Cover Letter — fast and clean.">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="signature" className="w-full">
            <div className="mb-6">
              <div className="relative flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => scrollTabsBy(-240)}
                  disabled={!canScrollLeft}
                  className="h-9 w-9 shrink-0 rounded-full bg-background/80 backdrop-blur disabled:opacity-40"
                  aria-label="Scroll tabs left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="relative flex-1 min-w-0">
                  <div
                    className={[
                      "pointer-events-none absolute inset-y-0 left-0 w-8",
                      "bg-gradient-to-r from-background to-transparent",
                      canScrollLeft ? "opacity-100" : "opacity-0",
                      "transition-opacity",
                    ].join(" ")}
                  />
                  <div
                    className={[
                      "pointer-events-none absolute inset-y-0 right-0 w-8",
                      "bg-gradient-to-l from-background to-transparent",
                      canScrollRight ? "opacity-100" : "opacity-0",
                      "transition-opacity",
                    ].join(" ")}
                  />

                  <TabsList
                    ref={tabScrollRef as any}
                    className="w-full mb-0 flex overflow-x-auto gap-1 p-1 h-11 whitespace-nowrap rounded-lg
                      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <TabsTrigger value="signature" className="flex-1 min-w-max gap-2">
                      <PenTool className="h-4 w-4" />
                      <span className="hidden sm:inline">Signature</span>
                    </TabsTrigger>

                    <TabsTrigger value="resume" className="flex-1 min-w-max gap-2">
                      <FileUser className="h-4 w-4" />
                      <span className="hidden sm:inline">Resume / CV</span>
                    </TabsTrigger>

                    <TabsTrigger value="cover" className="flex-1 min-w-max gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="hidden sm:inline">Cover Letter</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => scrollTabsBy(240)}
                  disabled={!canScrollRight}
                  className="h-9 w-9 shrink-0 rounded-full bg-background/80 backdrop-blur disabled:opacity-40"
                  aria-label="Scroll tabs right"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {(canScrollLeft || canScrollRight) && (
                <p className="mt-2 text-xs text-muted-foreground">Swipe tabs or use arrows.</p>
              )}
            </div>
            {/* ---------------- Signature generator (draw + export PNG/SVG) ---------------- */}
            <TabsContent value="signature" className="space-y-6">
              <div className="p-6 rounded-xl border border-border bg-surface-elevated">
                
              </div>
            </TabsContent>
            {/* ----------------  Resume / CV generator ---------------- */}
            <TabsContent value="resume" className="space-y-6">
              <div className="p-6 rounded-xl border border-border bg-surface-elevated">
            
              </div>
            </TabsContent>
            {/* ---------------- Cover letter generator ---------------- */}
            <TabsContent value="cover" className="space-y-6">
              <div className="p-6 rounded-xl border border-border bg-surface-elevated">
              
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ToolLayout>
  );
}
