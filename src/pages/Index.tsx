import { Header } from '@/components/layout/Header';
import { SearchBar } from '@/components/home/SearchBar';
import { MegaCategories } from '@/components/home/MegaCategories';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      {/* Hero Section */}
      <section className="border-b border-border bg-surface py-10 sm:py-16 md:py-20">
        <div className="container px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Simple business tools that actually get used.
            </h1>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-muted-foreground">
              No login. No signup. Just instant, professional tools for your daily work.
            </p>
            <div className="mt-6 sm:mt-8">
              <SearchBar />
            </div>
          </div>
        </div>
      </section>
      
      {/* Main Content - Mega Categories */}
      <main className="container px-4 sm:px-6 py-6 sm:py-10 md:py-12">
        <MegaCategories />
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8">
        <div className="container px-4 sm:px-6 text-center text-xs sm:text-sm text-muted-foreground">
          <p>WORKTOOLS — Free business utilities. No login required.</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default Index;
