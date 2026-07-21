export function AmbientBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: '#f5f7fb' }} />
      {/* soft tinted mesh blobs */}
      <div
        className="absolute -top-40 -left-40 h-[55vw] w-[55vw] rounded-full blur-3xl opacity-40 animate-blob"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(34,184,207,0.20) 0%, transparent 60%)' }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[55vw] w-[55vw] rounded-full blur-3xl opacity-35 animate-blob"
        style={{
          background: 'radial-gradient(circle at 60% 40%, rgba(109,139,240,0.16) 0%, transparent 60%)',
          animationDelay: '-6s',
        }}
      />
      <div
        className="absolute -bottom-40 left-1/4 h-[55vw] w-[55vw] rounded-full blur-3xl opacity-30 animate-blob"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(34,184,207,0.14) 0%, transparent 65%)',
          animationDelay: '-12s',
        }}
      />
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 78%)',
        }}
      />
    </div>
  );
}
