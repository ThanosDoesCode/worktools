import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";

const CareerKit = () => {
  return (
    <ToolLayout
      title="Career Kit"
      description="Tools to help you advance your career."
    >
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Coming soon...</p>
        </CardContent>
      </Card>
    </ToolLayout>
  );
};

export default CareerKit;
