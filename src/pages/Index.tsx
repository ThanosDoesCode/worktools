import { Header } from '@/components/layout/Header';
import { SearchBar } from '@/components/home/SearchBar';
import { PopularTools } from '@/components/home/PopularTools';
import { CategorySection } from '@/components/home/CategorySection';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="border-b border-border bg-surface py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Simple business tools that actually get used.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              No login. No signup. Just instant, professional tools for your daily work.
            </p>
            <div className="mt-8">
              <SearchBar />
            </div>
          </div>
        </div>
      </section>
      
      {/* Main Content */}
      <main className="container py-12 space-y-16">
        <PopularTools />
        <CategorySection />
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>WORKTOOLS — Free business utilities. No login required.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
