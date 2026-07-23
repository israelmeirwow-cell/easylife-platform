/* Quiet SaaS background: flat canvas color, nothing moving, nothing tinted.
   (The old animated mesh blobs read as decoration — big-SaaS surfaces are calm.) */
export function AmbientBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: '#f5f7fb' }} />
  );
}
