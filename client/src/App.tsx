import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import FileLeaveRequestPage from "@/pages/file-leave";
import MyLeavesPage from "@/pages/my-leaves";
import ApprovalsPage from "@/pages/approvals";
import EmployeesPage from "@/pages/employees";
import ReportsPage from "@/pages/reports";
import AdminPage from "@/pages/admin";
import ExecutiveDashboardPage from "@/pages/executive";
import SettingsPage from "@/pages/settings";

function ProtectedRoute({ 
  children, 
  allowedRoles, 
  allowedDepartments 
}: { 
  children: React.ReactNode; 
  allowedRoles?: string[]; 
  allowedDepartments?: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const roleAllowed = !allowedRoles || allowedRoles.includes(user.role);
  const deptAllowed = !allowedDepartments || (user.department && allowedDepartments.includes(user.department));
  
  if (allowedRoles && allowedDepartments) {
    if (!roleAllowed && !deptAllowed) {
      return <Redirect to="/dashboard" />;
    }
  } else if (allowedRoles && !roleAllowed) {
    return <Redirect to="/dashboard" />;
  } else if (allowedDepartments && !deptAllowed) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-3 border-b bg-background shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/register">
        <PublicOnlyRoute>
          <RegisterPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DashboardPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/file-leave">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <FileLeaveRequestPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/my-leaves">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <MyLeavesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/approvals">
        <ProtectedRoute allowedRoles={["manager", "hr", "admin"]}>
          <AuthenticatedLayout>
            <ApprovalsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/employees">
        <ProtectedRoute allowedRoles={["hr", "admin"]}>
          <AuthenticatedLayout>
            <EmployeesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute allowedRoles={["hr", "admin", "top_management"]}>
          <AuthenticatedLayout>
            <ReportsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AuthenticatedLayout>
            <AdminPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/executive">
        <ProtectedRoute allowedRoles={["top_management", "admin"]}>
          <AuthenticatedLayout>
            <ExecutiveDashboardPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute allowedRoles={["admin"]} allowedDepartments={["it_digital_transformation"]}>
          <AuthenticatedLayout>
            <SettingsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/">
        <Redirect to="/login" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
