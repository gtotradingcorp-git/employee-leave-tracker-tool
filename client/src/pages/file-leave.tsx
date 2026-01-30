import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarIcon, Send, AlertTriangle, FileUp, UserCheck } from "lucide-react";
import { LEAVE_TYPES, DEPARTMENTS, type DepartmentApproverWithUser } from "@shared/schema";
import { PtoBalanceBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpload } from "@/hooks/use-upload";

const leaveFormSchema = z.object({
  leaveType: z.string().min(1, "Please select a leave type"),
  department: z.string().min(1, "Please select your department"),
  approverId: z.string().min(1, "Please select an approver"),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

type LeaveFormData = z.infer<typeof leaveFormSchema>;

function calculateBusinessDays(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

export default function FileLeaveRequestPage() {
  const { user, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLwopDialog, setShowLwopDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<LeaveFormData | null>(null);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setAttachmentPath(response.objectPath);
      toast({
        title: "File uploaded",
        description: "Your document has been attached successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<LeaveFormData>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      leaveType: "",
      department: user?.department || "",
      approverId: "",
      reason: "",
    },
  });

  const selectedDepartment = form.watch("department");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  const { data: departmentApprovers, isLoading: isLoadingApprovers } = useQuery<DepartmentApproverWithUser[]>({
    queryKey: ["/api/department-approvers", selectedDepartment],
    queryFn: async () => {
      if (!selectedDepartment) return [];
      const response = await fetch(`/api/department-approvers/${selectedDepartment}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedDepartment,
  });

  useEffect(() => {
    form.setValue("approverId", "");
  }, [selectedDepartment, form]);

  const totalDays = useMemo(() => {
    if (startDate && endDate) {
      return calculateBusinessDays(startDate, endDate);
    }
    return 0;
  }, [startDate, endDate]);

  const ptoCredits = user?.ptoCredits;
  const remaining = ptoCredits ? ptoCredits.totalCredits - ptoCredits.usedCredits : 0;
  const willBeLwop = remaining <= 0 || totalDays > remaining;
  const lwopDays = Math.max(0, totalDays - remaining);

  const submitMutation = useMutation({
    mutationFn: async (data: LeaveFormData & { attachmentPath?: string }) => {
      const response = await apiRequest("POST", "/api/leave-requests", {
        leaveType: data.leaveType,
        department: data.department,
        approverId: data.approverId,
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: format(data.endDate, "yyyy-MM-dd"),
        totalDays,
        reason: data.reason,
        attachmentPath: data.attachmentPath,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      refreshUser();
      toast({
        title: "Leave request submitted",
        description: "Your leave request has been sent for approval.",
      });
      navigate("/my-leaves");
    },
    onError: (error) => {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: LeaveFormData) => {
    if (willBeLwop && !pendingSubmit) {
      setPendingSubmit(data);
      setShowLwopDialog(true);
      return;
    }
    submitMutation.mutate({ ...data, attachmentPath: attachmentPath || undefined });
  };

  const confirmLwopSubmit = () => {
    if (pendingSubmit) {
      submitMutation.mutate({ ...pendingSubmit, attachmentPath: attachmentPath || undefined });
      setShowLwopDialog(false);
      setPendingSubmit(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            File Leave Request
          </h1>
          <p className="text-muted-foreground">
            Submit a new leave application for approval
          </p>
        </div>
      </div>

      {ptoCredits && (
        <Card>
          <CardContent className="pt-4">
            <PtoBalanceBadge
              used={ptoCredits.usedCredits}
              total={ptoCredits.totalCredits}
            />
          </CardContent>
        </Card>
      )}

      {willBeLwop && totalDays > 0 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                Leave Without Pay (LWOP) Notice
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                {remaining <= 0
                  ? `All ${totalDays} day(s) of this leave will be classified as LWOP since your PTO credits are exhausted.`
                  : `${lwopDays} of ${totalDays} day(s) will be classified as LWOP since you only have ${remaining} PTO credit(s) remaining.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leave Application Form</CardTitle>
          <CardDescription>
            Please fill in all required fields. Date &amp; time of filing will be recorded automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type of Leave *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-leave-type">
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LEAVE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept.value} value={dept.value}>
                              {dept.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="approverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Leave Approver *
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedDepartment || isLoadingApprovers}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-approver">
                          <SelectValue placeholder={
                            !selectedDepartment 
                              ? "Select department first" 
                              : isLoadingApprovers 
                                ? "Loading approvers..." 
                                : "Select your approver"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departmentApprovers && departmentApprovers.length > 0 ? (
                          departmentApprovers.map((approver) => (
                            <SelectItem key={approver.id} value={approver.approverUserId}>
                              {approver.approver.fullName} - {approver.approver.position || "Approver"}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No approvers assigned for this department
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the designated approver for your department
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-start-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-end-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                              (startDate && date < startDate)
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {totalDays > 0 && (
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm font-medium">
                    Total Leave Days: <span className="text-lg" data-testid="text-total-days">{totalDays}</span>{" "}
                    <span className="text-muted-foreground">(business days only)</span>
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Leave *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide a detailed reason for your leave request..."
                        className="min-h-[120px] resize-none"
                        data-testid="textarea-reason"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Minimum 10 characters required</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Supporting Documents (Optional)</FormLabel>
                <div className="mt-2">
                  <label
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer transition-colors",
                      "hover:bg-muted/50 border-muted-foreground/25",
                      isUploading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {attachmentPath
                          ? "File attached successfully"
                          : isUploading
                          ? "Uploading..."
                          : "Click to upload or drag and drop"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, DOC, DOCX, JPG, PNG (max 10MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      data-testid="input-file-upload"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/dashboard")}
                  disabled={submitMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitMutation.isPending || isUploading}
                  data-testid="button-submit-leave"
                >
                  {submitMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Submit Leave Request
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={showLwopDialog} onOpenChange={setShowLwopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Leave Without Pay Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {remaining <= 0
                  ? "Your PTO credits are exhausted. This entire leave request will be classified as Leave Without Pay (LWOP)."
                  : `You only have ${remaining} PTO credit(s) remaining. ${lwopDays} day(s) of this ${totalDays}-day leave will be classified as LWOP.`}
              </p>
              <p className="font-medium">
                LWOP means you will not receive pay for those days.
              </p>
              <p>Do you wish to proceed with this leave request?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-lwop">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLwopSubmit}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-confirm-lwop"
            >
              Yes, Submit LWOP Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
