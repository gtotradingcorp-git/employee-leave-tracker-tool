import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PtoBalanceBadge, StatusBadge } from "@/components/status-badge";
import { LeaveTypeIcon, getLeaveTypeLabel } from "@/components/leave-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Plus,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { LeaveRequestWithUser } from "@shared/schema";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: dashboardData, isLoading } = useQuery<{
    stats: { pending: number; approved: number; rejected: number; total: number };
    recentRequests: LeaveRequestWithUser[];
  }>({
    queryKey: ["/api/dashboard"],
  });

  const stats = dashboardData?.stats;
  const recentLeaves = dashboardData?.recentRequests;
  const isLoadingLeaves = isLoading;
  const isLoadingStats = isLoading;

  if (!user) return null;

  const ptoCredits = user.ptoCredits;
  const remaining = ptoCredits ? ptoCredits.totalCredits - ptoCredits.usedCredits : 0;
  const showLwopWarning = remaining <= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            Welcome, {user.fullName.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Button asChild data-testid="button-file-leave">
          <Link href="/file-leave">
            <Plus className="h-4 w-4 mr-2" />
            File Leave Request
          </Link>
        </Button>
      </div>

      {showLwopWarning && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                PTO Balance Depleted
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Your PTO credits are exhausted. Any new leave requests will be classified as Leave Without Pay (LWOP).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PTO Balance
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ptoCredits ? (
              <PtoBalanceBadge
                used={ptoCredits.usedCredits}
                total={ptoCredits.totalCredits}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold" data-testid="text-pending-count">
                {stats?.pending ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved Leaves
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold" data-testid="text-approved-count">
                {stats?.approved ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              LWOP Days Taken
            </CardTitle>
            <XCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {ptoCredits ? (
              <p className="text-2xl font-semibold" data-testid="text-lwop-count">
                {ptoCredits.lwopDays ?? 0}
              </p>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Leave Requests
              </CardTitle>
              <CardDescription>Your most recent leave applications</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/my-leaves" data-testid="link-view-all-leaves">
                View All
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingLeaves ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : recentLeaves && recentLeaves.length > 0 ? (
            <div className="space-y-4">
              {recentLeaves.slice(0, 5).map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center gap-4 p-3 rounded-md bg-muted/50 hover-elevate"
                  data-testid={`leave-item-${leave.id}`}
                >
                  <LeaveTypeIcon type={leave.leaveType as any} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {getLeaveTypeLabel(leave.leaveType as any)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(leave.startDate), "MMM d")} -{" "}
                      {format(new Date(leave.endDate), "MMM d, yyyy")} ({leave.totalDays}{" "}
                      {leave.totalDays === 1 ? "day" : "days"})
                    </p>
                  </div>
                  <StatusBadge status={leave.status as any} isLwop={leave.isLwop} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No leave requests yet</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/file-leave">File your first leave request</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
