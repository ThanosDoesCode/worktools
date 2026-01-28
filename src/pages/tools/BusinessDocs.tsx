// src/pages/tools/BusinessDocs.tsx
import { useEffect, useRef, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import InvoiceTab from "@/pages/tools/business-docs/tabs/InvoiceTab";
import ReceiptTab from "@/pages/tools/business-docs/tabs/ReceiptTab";
import ContractLetterTab from "@/pages/tools/business-docs/tabs/ContractLetterTab";

export default function BusinessDocs() {
  // Scrollable tabs UX (works on mobile/iPad) + visible affordance
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
    <ToolLayout
      title="Business Docs"
      description="Create invoices, receipts, and contracts — ready to print."
    >
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="invoice" className="w-full">
            {/* Tabs header with clear scroll affordance */}
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
                  {/* edge fades */}
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
                    className="
                      w-full h-11
                      flex items-center justify-start gap-2
                      overflow-x-auto whitespace-nowrap
                      rounded-lg p-1
                      [-ms-overflow-style:none] [scrollbar-width:none]
                      [&::-webkit-scrollbar]:hidden
                    "
                  >
                    <TabsTrigger value="invoice" className="shrink-0 min-w-max px-4">
                      Invoice
                    </TabsTrigger>
                    <TabsTrigger value="receipt" className="shrink-0 min-w-max px-4">
                      Receipt
                    </TabsTrigger>
                    <TabsTrigger value="contract" className="shrink-0 min-w-max px-4">
                      Contract / Letter
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

            <TabsContent value="invoice">
              <InvoiceTab />
            </TabsContent>

            <TabsContent value="receipt">
              <ReceiptTab />
            </TabsContent>

            <TabsContent value="contract">
              <ContractLetterTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ToolLayout>
  );
}
