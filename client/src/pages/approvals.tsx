import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PtoBalanceBadge } from "@/components/status-badge";
import { LeaveTypeIcon, getLeaveTypeLabel } from "@/components/leave-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  FileText,
  Eye,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { LeaveRequestWithUser } from "@shared/schema";
import { DEPARTMENTS } from "@shared/schema";

function getDepartmentLabel(value: string): string {
  return DEPARTMENTS.find((d) => d.value === value)?.label || value;
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithUser | null>(null);
  const [remarks, setRemarks] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const { data: pendingRequests, isLoading } = useQuery<LeaveRequestWithUser[]>({
    queryKey: ["/api/leave-requests/pending"],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, remarks }: { id: string; action: "approve" | "reject"; remarks: string }) => {
      const response = await apiRequest("PATCH", `/api/leave-requests/${id}/${action}`, { remarks });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      toast({
        title: variables.action === "approve" ? "Leave Approved" : "Leave Rejected",
        description: `The leave request has been ${variables.action === "approve" ? "approved" : "rejected"}.`,
      });
      setSelectedRequest(null);
      setRemarks("");
      setActionType(null);
    },
    onError: (error) => {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleAction = (request: LeaveRequestWithUser, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(action);
    setRemarks("");
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionType) return;
    
    if (actionType === "reject" && !remarks.trim()) {
      toast({
        title: "Remarks required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    if (selectedRequest.isLwop && actionType === "approve" && !remarks.trim()) {
      toast({
        title: "Remarks required",
        description: "LWOP approvals require manager remarks for audit purposes",
        variant: "destructive",
      });
      return;
    }

    actionMutation.mutate({
      id: selectedRequest.id,
      action: actionType,
      remarks: remarks.trim(),
    });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Leave Approvals
        </h1>
        <p className="text-muted-foreground">
          Review and manage pending leave requests from your team
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pending Requests
          </CardTitle>
          <CardDescription>
            Leave requests awaiting your approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-md">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          ) : pendingRequests && pendingRequests.length > 0 ? (
            <div className="space-y-4">
              {pendingRequests.map((request) => {
                const initials = request.user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={request.id}
                    className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 border rounded-md bg-card"
                    data-testid={`approval-request-${request.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{request.user.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.user.position} • {getDepartmentLabel(request.user.department)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <LeaveTypeIcon type={request.leaveType as any} showLabel />
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(request.startDate), "MMM d")} -{" "}
                          {format(new Date(request.endDate), "MMM d")}
                        </span>
                        <Badge variant="secondary" className="ml-1 font-mono">
                          {request.totalDays}d
                        </Badge>
                      </div>
                      {request.isLwop && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          LWOP
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType(null);
                        }}
                        data-testid={`button-view-${request.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAction(request, "approve")}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAction(request, "reject")}
                        data-testid={`button-reject-${request.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No pending leave requests</p>
              <p className="text-sm text-muted-foreground mt-1">
                All team leave requests have been processed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {actionType === "approve" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Approve Leave Request
                    </>
                  ) : actionType === "reject" ? (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      Reject Leave Request
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5" />
                      Leave Request Details
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {actionType
                    ? `Review and ${actionType} this leave request`
                    : "Review the details of this leave request"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {selectedRequest.user.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedRequest.user.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.user.position} • {selectedRequest.user.employeeId}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Leave Type</p>
                    <p className="font-medium">{getLeaveTypeLabel(selectedRequest.leaveType as any)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Department</p>
                    <p className="font-medium">{getDepartmentLabel(selectedRequest.department)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">
                      {format(new Date(selectedRequest.startDate), "MMM d")} -{" "}
                      {format(new Date(selectedRequest.endDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Days</p>
                    <p className="font-medium">{selectedRequest.totalDays} day(s)</p>
                  </div>
                </div>

                {selectedRequest.isLwop && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      This is a Leave Without Pay (LWOP) request
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      The employee has exhausted their PTO credits. Remarks are required for LWOP approvals.
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-muted-foreground text-sm mb-1">Reason</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.reason}</p>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm mb-1">Filed On</p>
                  <p className="text-sm">{format(new Date(selectedRequest.filedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                </div>

                {actionType && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Remarks {(actionType === "reject" || selectedRequest.isLwop) && "*"}
                    </p>
                    <Textarea
                      placeholder={
                        actionType === "approve"
                          ? "Add optional remarks for the employee..."
                          : "Please provide a reason for rejection..."
                      }
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="min-h-[80px]"
                      data-testid="textarea-remarks"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(null);
                    setRemarks("");
                    setActionType(null);
                  }}
                >
                  {actionType ? "Cancel" : "Close"}
                </Button>
                {actionType && (
                  <Button
                    variant={actionType === "approve" ? "default" : "destructive"}
                    onClick={confirmAction}
                    disabled={actionMutation.isPending}
                    data-testid={`button-confirm-${actionType}`}
                  >
                    {actionMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Processing...
                      </span>
                    ) : actionType === "approve" ? (
                      "Confirm Approval"
                    ) : (
                      "Confirm Rejection"
                    )}
                  </Button>
                )}
                {!actionType && (
                  <>
                    <Button
                      variant="default"
                      onClick={() => setActionType("approve")}
                      data-testid="button-approve-dialog"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setActionType("reject")}
                      data-testid="button-reject-dialog"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
