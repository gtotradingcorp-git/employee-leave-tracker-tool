import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Info, Plus, X } from "lucide-react";
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
  const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string>>({});

  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/settings/users"],
  });

  const { data: departmentApprovers, isLoading: isLoadingApprovers } = useQuery<DepartmentApproverWithUser[]>({
    queryKey: ["/api/settings/department-approvers"],
  });

  const addApproverMutation = useMutation({
    mutationFn: async ({ department, approverUserId }: { department: string; approverUserId: string }) => {
      const response = await apiRequest("POST", `/api/settings/department-approvers/${department}`, { approverUserId });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/department-approvers"] });
      setSelectedApprovers(prev => ({ ...prev, [variables.department]: "" }));
      toast({
        title: "Approver added",
        description: "Department approver has been assigned successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add approver",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const removeApproverMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await apiRequest("DELETE", `/api/settings/department-approvers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/department-approvers"] });
      toast({
        title: "Approver removed",
        description: "Department approver has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove approver",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const getApproversForDepartment = (deptValue: string) => {
    return departmentApprovers?.filter(a => a.department === deptValue) || [];
  };

  const getEligibleUsersForDepartment = (deptValue: string) => {
    const currentApproverIds = getApproversForDepartment(deptValue).map(a => a.approverUserId);
    return users?.filter(
      (u) => (u.role === "manager" || u.role === "hr" || u.role === "admin" || u.role === "top_management") &&
             !currentApproverIds.includes(u.id)
    ) || [];
  };

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
            Assign designated leave approvers for each department. Employees will select their approver when filing leaves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md mb-4">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Multiple approvers can be assigned per department. Employees will choose from these approvers when filing leave requests.
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
            <div className="space-y-4">
              {DEPARTMENTS.filter(d => d.value !== "top_management").map((dept) => {
                const currentApprovers = getApproversForDepartment(dept.value);
                const eligibleUsers = getEligibleUsersForDepartment(dept.value);

                return (
                  <div
                    key={dept.value}
                    className="p-4 border rounded-md space-y-3"
                    data-testid={`approver-row-${dept.value}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{dept.label}</p>
                      <Badge variant={currentApprovers.length > 0 ? "default" : "secondary"}>
                        {currentApprovers.length} approver{currentApprovers.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {currentApprovers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {currentApprovers.map((approver) => (
                          <Badge
                            key={approver.id}
                            variant="outline"
                            className="flex items-center gap-1 py-1 px-2"
                          >
                            <span>{approver.approver.fullName}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 hover:bg-destructive/20"
                              onClick={() => removeApproverMutation.mutate({ id: approver.id })}
                              disabled={removeApproverMutation.isPending}
                              data-testid={`button-remove-approver-${approver.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Select
                        value={selectedApprovers[dept.value] || ""}
                        onValueChange={(value) => setSelectedApprovers(prev => ({ ...prev, [dept.value]: value }))}
                      >
                        <SelectTrigger
                          className="flex-1"
                          data-testid={`select-approver-${dept.value}`}
                        >
                          <SelectValue placeholder="Select an approver to add..." />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName || "Unknown"} - {getDepartmentLabel(u.department || "")} ({getRoleLabel(u.role)})
                            </SelectItem>
                          ))}
                          {eligibleUsers.length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No eligible users available
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        onClick={() => {
                          const approverUserId = selectedApprovers[dept.value];
                          if (approverUserId) {
                            addApproverMutation.mutate({ department: dept.value, approverUserId });
                          }
                        }}
                        disabled={!selectedApprovers[dept.value] || addApproverMutation.isPending}
                        data-testid={`button-add-approver-${dept.value}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
