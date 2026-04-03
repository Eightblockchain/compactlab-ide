"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "accent" | "danger" | "muted";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", loading, active, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 select-none whitespace-nowrap",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:opacity-40 disabled:pointer-events-none",
          {
            // Variants
            "bg-white/5 border border-border text-text-primary hover:bg-white/8 hover:border-border-strong":
              variant === "default",
            "text-text-secondary hover:text-text-primary hover:bg-white/5":
              variant === "ghost",
            "bg-accent hover:bg-accent-hover text-white border border-transparent shadow-accent-glow":
              variant === "accent",
            "bg-error/15 hover:bg-error/20 text-error border border-error/20":
              variant === "danger",
            "text-text-muted hover:text-text-secondary":
              variant === "muted",
            // Active state
            "bg-accent/15 text-accent border-accent/30": active && variant === "default",
          },
          {
            // Sizes
            "rounded text-xs px-1.5 py-0.5 h-5": size === "xs",
            "rounded text-sm px-2.5 py-1 h-6": size === "sm",
            "rounded text-base px-3 py-1.5 h-7": size === "md",
            "rounded-md text-md px-4 py-2 h-8": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode; badge?: string | number }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function Tabs({ tabs, activeTab, onTabChange, className, size = "md" }: TabsProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "inline-flex items-center gap-1.5 font-medium transition-all duration-150 select-none",
            "border-b-2",
            size === "sm" && "text-xs px-3 py-1.5 h-8",
            size === "md" && "text-sm px-4 py-2 h-9",
            activeTab === tab.id
              ? "text-text-primary border-accent"
              : "text-text-secondary border-transparent hover:text-text-primary hover:border-border-strong"
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className={cn(
              "rounded-sm px-1 text-2xs font-mono leading-none",
              activeTab === tab.id
                ? "bg-accent/20 text-accent"
                : "bg-white/8 text-text-muted"
            )}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface BadgeProps {
  variant?: "default" | "success" | "error" | "warning" | "info" | "muted";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = "default", size = "sm", children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-sm",
        size === "sm" && "text-2xs px-1.5 py-0.5",
        size === "md" && "text-xs px-2 py-1",
        {
          "bg-white/8 text-text-secondary": variant === "default",
          "bg-success/15 text-success": variant === "success",
          "bg-error/15 text-error": variant === "error",
          "bg-warning/15 text-warning": variant === "warning",
          "bg-info/15 text-info": variant === "info",
          "bg-white/5 text-text-muted": variant === "muted",
        },
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", {
          "bg-white/40": variant === "default" || variant === "muted",
          "bg-success": variant === "success",
          "bg-error": variant === "error",
          "bg-warning": variant === "warning",
          "bg-info": variant === "info",
        })} />
      )}
      {children}
    </span>
  );
}

interface StatusDotProps {
  status: "idle" | "running" | "success" | "error" | "warning";
  label?: string;
  className?: string;
}

export function StatusDot({ status, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        {
          "bg-white/30": status === "idle",
          "bg-accent status-pulse": status === "running",
          "bg-success": status === "success",
          "bg-error": status === "error",
          "bg-warning status-pulse": status === "warning",
        }
      )} />
      {label && <span className="text-xs text-text-secondary">{label}</span>}
    </span>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "xs" | "sm" | "md";
  active?: boolean;
  tooltip?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", active, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded transition-all duration-150",
          "text-text-muted hover:text-text-primary hover:bg-white/6",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:opacity-40 disabled:pointer-events-none",
          size === "xs" && "w-5 h-5 text-xs",
          size === "sm" && "w-6 h-6 text-sm",
          size === "md" && "w-7 h-7 text-base",
          active && "text-text-primary bg-white/6",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";

export function Divider({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        vertical ? "w-px self-stretch bg-border" : "h-px w-full bg-border",
        className
      )}
    />
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 text-2xs font-mono bg-white/6 text-text-muted border border-border rounded-sm px-1 py-0.5">
      {children}
    </kbd>
  );
}
