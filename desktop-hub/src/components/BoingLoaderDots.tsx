type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "boing-loader--sm",
  md: "",
  lg: "boing-loader--lg",
};

/** Decorative three-dot bouncy loader; put inside a parent with `role="status"` / `aria-label` when needed. */
export function BoingLoaderDots({ size = "md", className = "" }: { size?: Size; className?: string }) {
  const sc = sizeClass[size];
  return (
    <div className={["boing-loader", sc, className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className="boing-loader__dot" />
      <span className="boing-loader__dot" />
      <span className="boing-loader__dot" />
    </div>
  );
}
