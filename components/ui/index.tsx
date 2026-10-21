"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
          "inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 select-none whitespace-nowrap",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60",
          "disabled:opacity-40 disabled:pointer-events-none",
          {
            // Variants
            "bg-white/[0.04] border border-border text-text-primary hover:bg-white/[0.07] hover:border-border-strong":
              variant === "default",
            "text-text-secondary hover:text-text-primary hover:bg-white/[0.05]":
              variant === "ghost",
            "bg-accent hover:bg-accent-hover text-white border border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]":
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
            "rounded text-2xs px-1.5 h-5": size === "xs",
            "rounded-md text-xs px-2 h-6": size === "sm",
            "rounded-md text-sm px-2.5 h-7": size === "md",
            "rounded-md text-base px-3.5 h-8": size === "lg",
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
            "relative inline-flex items-center gap-1.5 font-medium transition-colors duration-150 select-none",
            size === "sm" && "text-xs px-3 h-8",
            size === "md" && "text-sm px-3.5 h-9",
            activeTab === tab.id
              ? "text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {activeTab === tab.id && (
            <span className="absolute inset-x-2 bottom-0 h-px bg-accent" aria-hidden />
          )}
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className={cn(
              "rounded-sm px-1 text-2xs font-mono leading-none",
              activeTab === tab.id
                ? "bg-white/10 text-text-primary"
                : "bg-white/[0.06] text-text-muted"
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

// ─── Menu ────────────────────────────────────────────────────────────────────
// Small dropdown used by the Topbar (Compile options, overflow, account).
// Closes on outside click, Escape, or after an item is selected.

const MenuCloseContext = createContext<() => void>(() => {});

export function Menu({
  trigger,
  children,
  align = "end",
  width = 224,
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={cn(
            "absolute top-full mt-1.5 z-50 rounded-lg border border-border-strong bg-surface-2 p-1",
            "shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] animate-[slide-up_0.12s_ease-out]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <MenuCloseContext.Provider value={() => setOpen(false)}>
            {children}
          </MenuCloseContext.Provider>
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onSelect,
  children,
  hint,
  icon,
  disabled,
  checked,
  tone = "default",
}: {
  onSelect: () => void;
  children: ReactNode;
  /** Right-aligned secondary text, e.g. a shortcut. */
  hint?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Renders a check mark slot (for radio-style options). */
  checked?: boolean;
  tone?: "default" | "muted";
}) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        close();
        onSelect();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 h-7 text-left text-sm transition-colors",
        "hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none",
        tone === "muted" ? "text-text-secondary hover:text-text-primary" : "text-text-primary",
      )}
    >
      {checked !== undefined ? (
        <span className="w-3.5 flex justify-center text-accent">{checked ? "✓" : ""}</span>
      ) : (
        icon && <span className="w-3.5 flex justify-center text-text-muted">{icon}</span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-2xs text-text-muted font-mono">{hint}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
