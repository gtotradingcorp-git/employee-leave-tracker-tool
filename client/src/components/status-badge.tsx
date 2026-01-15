import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

interface StatusBadgeProps {
  status: LeaveStatus;
  isLwop?: boolean;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  },
};

export function StatusBadge({ status, isLwop, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1 font-medium text-xs uppercase",
          config.className,
          className
        )}
        data-testid={`badge-status-${status}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      {isLwop && (
        <Badge
          variant="outline"
          className="flex items-center gap-1 font-medium text-xs uppercase bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800"
          data-testid="badge-lwop"
        >
          <AlertTriangle className="h-3 w-3" />
          LWOP
        </Badge>
      )}
    </div>
  );
}

interface PtoBalanceBadgeProps {
  used: number;
  total: number;
  className?: string;
}

export function PtoBalanceBadge({ used, total, className }: PtoBalanceBadgeProps) {
  const remaining = total - used;
  const isLow = remaining <= 1;
  const isEmpty = remaining <= 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">PTO Balance:</span>
        <span
          className={cn(
            "text-lg font-semibold",
            isEmpty ? "text-red-600 dark:text-red-400" : isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"
          )}
          data-testid="text-pto-balance"
        >
          {remaining}/{total}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-1">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isEmpty ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${Math.max(0, (remaining / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}
