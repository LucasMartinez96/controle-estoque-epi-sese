import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CatalogApp } from '@/components/catalog-workspace';
import { MovementsApp } from '@/components/movements-workspace';
import { AlertsApp } from '@/components/alerts-workspace';
import { PurchaseListApp } from '@/components/purchase-list-workspace';
import { CollaboratorHistoryApp } from '@/components/collaborator-history-workspace';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={() => <CatalogApp focus="dashboard" />} />
        <Route path="/produtos" component={() => <CatalogApp focus="products" />} />
        <Route path="/categorias" component={() => <CatalogApp focus="categories" />} />
        <Route path="/fornecedores" component={() => <CatalogApp focus="suppliers" />} />
        <Route path="/movimentacoes" component={MovementsApp} />
        <Route path="/colaboradores" component={CollaboratorHistoryApp} />
        <Route path="/alertas" component={AlertsApp} />
        <Route path="/compras" component={PurchaseListApp} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
