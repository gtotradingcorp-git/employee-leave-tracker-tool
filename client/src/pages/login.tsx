import gtoLogo from "@assets/gto_logov2_1768485259388.webp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="absolute top-4 right-4">
        <ThemeToggle />
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <img
              src={gtoLogo}
              alt="GTO Trading Corporation"
              className="h-16 w-auto"
            />
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Leave Management System
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to manage your leave requests
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>
                Sign in with your Replit account to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                size="lg"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign in with Replit
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                You can sign in with Google, GitHub, or email through Replit's secure authentication.
              </p>
            </CardContent>
          </Card>

          <footer className="text-center text-xs text-muted-foreground">
            <p>Tool Developed By: IT & Digital Transformation Department</p>
            <p className="mt-1">GTO Trading Corporation</p>
            <p className="mt-1">For support: techcare@gtotradingcorp.com</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
