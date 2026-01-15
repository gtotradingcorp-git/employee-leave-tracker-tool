import { cn } from "@/lib/utils";
import {
  Palmtree,
  Thermometer,
  Siren,
  Heart,
  Baby,
  User,
  Clock,
} from "lucide-react";

type LeaveType = "vacation" | "sick" | "emergency" | "bereavement" | "maternity" | "paternity" | "indefinite";

interface LeaveTypeIconProps {
  type: LeaveType;
  className?: string;
  showLabel?: boolean;
}

const leaveTypeConfig = {
  vacation: {
    label: "Vacation Leave",
    icon: Palmtree,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  sick: {
    label: "Sick Leave",
    icon: Thermometer,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
  emergency: {
    label: "Emergency Leave",
    icon: Siren,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },
  bereavement: {
    label: "Bereavement Leave",
    icon: Heart,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/30",
  },
  maternity: {
    label: "Maternity Leave",
    icon: Baby,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/30",
  },
  paternity: {
    label: "Paternity Leave",
    icon: User,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
  },
  indefinite: {
    label: "Indefinite Leave",
    icon: Clock,
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-900/30",
  },
};

export function LeaveTypeIcon({ type, className, showLabel = false }: LeaveTypeIconProps) {
  const config = leaveTypeConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("p-2 rounded-md", config.bg)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      {showLabel && (
        <span className="text-sm font-medium">{config.label}</span>
      )}
    </div>
  );
}

export function getLeaveTypeLabel(type: LeaveType): string {
  return leaveTypeConfig[type]?.label || type;
}
