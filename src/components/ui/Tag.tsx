export function Tag({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`tag ${className}`.trim()}>{children}</span>;
}
