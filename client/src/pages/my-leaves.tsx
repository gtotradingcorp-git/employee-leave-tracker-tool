import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { LeaveTypeIcon, getLeaveTypeLabel } from "@/components/leave-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Calendar, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import type { LeaveRequestWithUser } from "@shared/schema";
import { LEAVE_TYPES } from "@shared/schema";

export default function MyLeavesPage() {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: leaves, isLoading } = useQuery<LeaveRequestWithUser[]>({
    queryKey: ["/api/leave-requests"],
  });

  if (!user) return null;

  const filteredLeaves = leaves?.filter((leave) => {
    const matchesStatus = filterStatus === "all" || leave.status === filterStatus;
    const matchesType = filterType === "all" || leave.leaveType === filterType;
    const matchesSearch =
      searchTerm === "" ||
      leave.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getLeaveTypeLabel(leave.leaveType as any).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            My Leave Requests
          </h1>
          <p className="text-muted-foreground">View and manage your leave applications</p>
        </div>
        <Button asChild data-testid="button-file-leave">
          <Link href="/file-leave">
            <Plus className="h-4 w-4 mr-2" />
            File New Request
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Leave History
              </CardTitle>
              <CardDescription>
                All your submitted leave requests
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-48"
                  data-testid="input-search"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36" data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-type">
                  <SelectValue placeholder="Leave Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {LEAVE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
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
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredLeaves && filteredLeaves.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaves.map((leave) => (
                    <TableRow key={leave.id} data-testid={`leave-row-${leave.id}`}>
                      <TableCell>
                        <LeaveTypeIcon type={leave.leaveType as any} showLabel />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {format(new Date(leave.startDate), "MMM d")} -{" "}
                            {format(new Date(leave.endDate), "MMM d, yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono">
                          {leave.totalDays}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-xs truncate text-sm text-muted-foreground">
                          {leave.reason}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={leave.status as any} isLwop={leave.isLwop} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(leave.filedAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                {searchTerm || filterStatus !== "all" || filterType !== "all"
                  ? "No leave requests match your filters"
                  : "You haven't filed any leave requests yet"}
              </p>
              {filterStatus === "all" && filterType === "all" && !searchTerm && (
                <Button asChild variant="outline">
                  <Link href="/file-leave">File your first leave request</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
