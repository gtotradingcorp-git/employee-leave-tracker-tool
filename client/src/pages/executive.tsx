import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Building2, Users, Calendar, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { DEPARTMENTS } from "@shared/schema";
import { Progress } from "@/components/ui/progress";

function getDepartmentLabel(value: string): string {
  const dept = DEPARTMENTS.find((d) => d.value === value);
  return dept?.label.split(" ")[0] || value;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface ExecutiveData {
  overview: {
    totalEmployees: number;
    activeLeaves: number;
    pendingApprovals: number;
    ptoUtilization: number;
    lwopRate: number;
  };
  departmentHealth: { department: string; employees: number; ptoUsed: number; lwopDays: number }[];
  monthlyTrend: { month: string; leaves: number; lwop: number }[];
  operationalImpact: { department: string; coverage: number }[];
}

export default function ExecutiveDashboardPage() {
  const { user } = useAuth();

  const { data: execData, isLoading } = useQuery<ExecutiveData>({
    queryKey: ["/api/executive/dashboard"],
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            Executive Dashboard
          </h1>
          <p className="text-muted-foreground">
            High-level overview of leave management and operational health
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold">{execData?.overview.totalEmployees ?? 0}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Leaves
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                {execData?.overview.activeLeaves ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approvals
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {execData?.overview.pendingApprovals ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PTO Utilization
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div>
                <p className="text-2xl font-semibold">
                  {Math.round(execData?.overview.ptoUtilization ?? 0)}%
                </p>
                <Progress value={execData?.overview.ptoUtilization ?? 0} className="h-1.5 mt-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              LWOP Rate
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400">
                {(execData?.overview.lwopRate ?? 0).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Department Health Overview</CardTitle>
            <CardDescription>PTO usage and LWOP by department</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : execData?.departmentHealth && execData.departmentHealth.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={execData.departmentHealth.map((d) => ({
                      ...d,
                      name: getDepartmentLabel(d.department),
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="ptoUsed" name="PTO Used" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lwopDays" name="LWOP Days" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Trend (6 Months)</CardTitle>
            <CardDescription>Monthly leave requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : execData?.monthlyTrend && execData.monthlyTrend.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={execData.monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area
                      type="monotone"
                      dataKey="leaves"
                      name="Leave Requests"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="lwop"
                      name="LWOP"
                      stroke="hsl(25, 95%, 53%)"
                      fill="hsl(25, 95%, 53%)"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Coverage</CardTitle>
          <CardDescription>
            Staff availability percentage by department (considering current leaves)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : execData?.operationalImpact && execData.operationalImpact.length > 0 ? (
            <div className="space-y-4">
              {execData.operationalImpact.map((dept) => (
                <div key={dept.department} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-40 truncate">
                    {getDepartmentLabel(dept.department)}
                  </span>
                  <div className="flex-1">
                    <Progress
                      value={dept.coverage}
                      className="h-3"
                    />
                  </div>
                  <span
                    className={`text-sm font-medium w-12 text-right ${
                      dept.coverage < 70
                        ? "text-red-600 dark:text-red-400"
                        : dept.coverage < 85
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {dept.coverage}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No operational data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
