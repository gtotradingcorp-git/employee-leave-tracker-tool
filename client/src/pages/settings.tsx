import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Info } from "lucide-react";
import type { User, DepartmentApproverWithUser } from "@shared/schema";
import { DEPARTMENTS, USER_ROLES } from "@shared/schema";

function getDepartmentLabel(value: string): string {
  return DEPARTMENTS.find((d) => d.value === value)?.label || value;
}

function getRoleLabel(value: string): string {
  return USER_ROLES.find((r) => r.value === value)?.label || value;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/settings/users"],
  });

  const { data: departmentApprovers, isLoading: isLoadingApprovers } = useQuery<DepartmentApproverWithUser[]>({
    queryKey: ["/api/settings/department-approvers"],
  });

  const updateApproverMutation = useMutation({
    mutationFn: async ({ department, approverUserId }: { department: string; approverUserId: string }) => {
      const response = await apiRequest("PUT", `/api/settings/department-approvers/${department}`, { approverUserId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/department-approvers"] });
      toast({
        title: "Approver updated",
        description: "Department approver has been assigned successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Settings
        </h1>
        <p className="text-muted-foreground">
          System configuration and leave approver management
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Department Leave Approvers
          </CardTitle>
          <CardDescription>
            Assign the designated leave approver for each department. Leave requests will be routed to the assigned approver for approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md mb-4">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Only users with Manager, HR, or Admin roles can be assigned as department approvers. HR and Admin users can also approve requests from any department.
            </p>
          </div>

          {isLoadingApprovers || isLoadingUsers ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-md">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-48" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {DEPARTMENTS.map((dept) => {
                const currentApprover = departmentApprovers?.find(
                  (a) => a.department === dept.value
                );
                const eligibleUsers = users?.filter(
                  (u) => u.role === "manager" || u.role === "hr" || u.role === "admin"
                );

                return (
                  <div
                    key={dept.value}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-md"
                    data-testid={`approver-row-${dept.value}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{dept.label}</p>
                      {currentApprover ? (
                        <p className="text-xs text-muted-foreground">
                          Current: {currentApprover.approver.fullName} ({getRoleLabel(currentApprover.approver.role)})
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">
                          No approver assigned
                        </p>
                      )}
                    </div>
                    <Select
                      value={currentApprover?.approverUserId || ""}
                      onValueChange={(value) => {
                        if (value) {
                          updateApproverMutation.mutate({
                            department: dept.value,
                            approverUserId: value,
                          });
                        }
                      }}
                    >
                      <SelectTrigger
                        className="w-full sm:w-72"
                        data-testid={`select-approver-${dept.value}`}
                      >
                        <SelectValue placeholder="Select approver..." />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleUsers?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName || "Unknown"} - {getDepartmentLabel(u.department || "")} ({getRoleLabel(u.role)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>
            Application configuration and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded-md">
              <p className="text-sm font-medium">Default PTO Credits</p>
              <p className="text-2xl font-bold text-primary">5</p>
              <p className="text-xs text-muted-foreground">
                Days allocated to new employees per year
              </p>
            </div>
            <div className="p-3 border rounded-md">
              <p className="text-sm font-medium">Leave Types</p>
              <p className="text-2xl font-bold text-primary">7</p>
              <p className="text-xs text-muted-foreground">
                Vacation, Sick, Emergency, Bereavement, Maternity, Paternity, Indefinite
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
