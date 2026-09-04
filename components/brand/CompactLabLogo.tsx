import { cn } from "@/lib/utils";

type CompactLabLogoProps = {
  /** Full wordmark (default) or square mark only. */
  variant?: "wordmark" | "icon";
  /** Render height in px. Wordmark width scales with aspect ratio. */
  height?: number;
  className?: string;
  alt?: string;
};

const WORDMARK_ASPECT = 415.2 / 77.63;

/**
 * Official Compact Lab branding (same assets as the landing page).
 * Sized for IDE chrome: keep height modest so the topbar stays calm.
 */
export function CompactLabLogo({
  variant = "wordmark",
  height = 28,
  className,
  alt = "Compact Lab",
}: CompactLabLogoProps) {
  if (variant === "icon") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local brand asset; avoid Image SVG/PNG config friction
      <img
        src="/cl-icon.png"
        alt={alt}
        width={height}
        height={height}
        className={cn("object-contain select-none", className)}
        draggable={false}
      />
    );
  }

  const width = Math.round(height * WORDMARK_ASPECT);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/cl-logo.svg"
      alt={alt}
      width={width}
      height={height}
      className={cn("object-contain object-left select-none", className)}
      draggable={false}
    />
  );
}
