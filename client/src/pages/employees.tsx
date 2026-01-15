import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Users, Search, Building2 } from "lucide-react";
import type { UserWithPtoCredits } from "@shared/schema";
import { DEPARTMENTS } from "@shared/schema";

function getDepartmentLabel(value: string): string {
  return DEPARTMENTS.find((d) => d.value === value)?.label || value;
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  const { data: employees, isLoading } = useQuery<UserWithPtoCredits[]>({
    queryKey: ["/api/employees"],
  });

  if (!user) return null;

  const filteredEmployees = employees?.filter((emp) => {
    const matchesDepartment = filterDepartment === "all" || emp.department === filterDepartment;
    const matchesSearch =
      searchTerm === "" ||
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const departmentStats = employees?.reduce((acc, emp) => {
    const dept = emp.department;
    if (!acc[dept]) {
      acc[dept] = { count: 0, totalPto: 0, usedPto: 0, lwopDays: 0 };
    }
    acc[dept].count++;
    if (emp.ptoCredits) {
      acc[dept].totalPto += emp.ptoCredits.totalCredits;
      acc[dept].usedPto += emp.ptoCredits.usedCredits;
      acc[dept].lwopDays += emp.ptoCredits.lwopDays;
    }
    return acc;
  }, {} as Record<string, { count: number; totalPto: number; usedPto: number; lwopDays: number }>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          All Employees
        </h1>
        <p className="text-muted-foreground">
          Company-wide employee directory and PTO overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-2xl font-semibold" data-testid="text-total-employees">
                {employees?.length ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total PTO Used
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold" data-testid="text-total-pto">
                {employees?.reduce((sum, e) => sum + (e.ptoCredits?.usedCredits ?? 0), 0) ?? 0} days
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total LWOP Days
            </CardTitle>
            <Building2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400" data-testid="text-total-lwop">
                {employees?.reduce((sum, e) => sum + (e.ptoCredits?.lwopDays ?? 0), 0) ?? 0} days
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Directory
              </CardTitle>
              <CardDescription>
                View all employees and their PTO status
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                  data-testid="input-search"
                />
              </div>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-full sm:w-52" data-testid="select-department">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredEmployees && filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>PTO Balance</TableHead>
                    <TableHead className="text-center">LWOP Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const initials = emp.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    const ptoRemaining = emp.ptoCredits
                      ? emp.ptoCredits.totalCredits - emp.ptoCredits.usedCredits
                      : 0;
                    const ptoTotal = emp.ptoCredits?.totalCredits ?? 5;
                    const ptoPercent = (ptoRemaining / ptoTotal) * 100;

                    return (
                      <TableRow key={emp.id} data-testid={`employee-row-${emp.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{emp.fullName}</p>
                              <p className="text-xs text-muted-foreground">{emp.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{emp.employeeId}</TableCell>
                        <TableCell className="text-sm">{getDepartmentLabel(emp.department)}</TableCell>
                        <TableCell className="text-sm">{emp.position}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-32">
                            <Progress value={ptoPercent} className="flex-1 h-2" />
                            <span className="text-xs font-medium w-12">
                              {ptoRemaining}/{ptoTotal}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.ptoCredits?.lwopDays ? (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                              {emp.ptoCredits.lwopDays}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || filterDepartment !== "all"
                  ? "No employees match your filters"
                  : "No employees found"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
