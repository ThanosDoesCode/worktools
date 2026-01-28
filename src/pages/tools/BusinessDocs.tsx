import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";

const BusinessDocs = () => {
  return (
    <ToolLayout
      title="Business Documents"
      description="Create professional business documents quickly and easily."
    >
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Coming soon...</p>
        </CardContent>
      </Card>
    </ToolLayout>
  );
};

export default BusinessDocs;
