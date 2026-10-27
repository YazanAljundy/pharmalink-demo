const isDemoBadgeEnabled = import.meta.env.VITE_SHOW_DEMO_BADGE !== 'false';

export function DemoBadge() {
  if (!isDemoBadgeEnabled) return null;
  return (
    <span className="demo-badge" title="Demo build">
      Demo
    </span>
  );
}
