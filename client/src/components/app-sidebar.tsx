import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import gtoLogo from "@assets/gto_logov2_1768485259388.webp";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PtoBalanceBadge } from "@/components/status-badge";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const getMenuItems = () => {
    const baseItems = [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "My Leaves",
        url: "/my-leaves",
        icon: FileText,
      },
    ];

    if (user.role === "manager" || user.role === "admin") {
      baseItems.push({
        title: "Approvals",
        url: "/approvals",
        icon: ClipboardCheck,
      });
    }

    if (user.role === "hr" || user.role === "admin") {
      baseItems.push(
        {
          title: "All Employees",
          url: "/employees",
          icon: Users,
        },
        {
          title: "Reports",
          url: "/reports",
          icon: BarChart3,
        }
      );
    }

    if (user.role === "admin") {
      baseItems.push({
        title: "Administration",
        url: "/admin",
        icon: Settings,
      });
    }

    if (user.role === "top_management") {
      baseItems.push({
        title: "Executive Dashboard",
        url: "/executive",
        icon: Building2,
      });
    }

    return baseItems;
  };

  const menuItems = getMenuItems();
  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src={gtoLogo} alt="GTO Trading Corporation" className="h-10 w-auto" />
        </Link>
        <p className="text-xs text-muted-foreground mt-1">Leave Management System</p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user.ptoCredits && (
          <SidebarGroup>
            <SidebarGroupLabel>PTO Balance</SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <PtoBalanceBadge
                used={user.ptoCredits.usedCredits}
                total={user.ptoCredits.totalCredits}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user.fullName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.position}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
