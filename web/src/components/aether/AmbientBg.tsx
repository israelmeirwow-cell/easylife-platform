export function AmbientBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "#07090E" }} />
      {/* mesh blobs */}
      <div
        className="absolute -top-40 -left-40 h-[55vw] w-[55vw] rounded-full blur-3xl opacity-40 animate-blob"
        style={{ background: "radial-gradient(circle at 30% 30%, #7ff0ff 0%, transparent 60%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[55vw] w-[55vw] rounded-full blur-3xl opacity-20 animate-blob"
        style={{
          background: "radial-gradient(circle at 60% 40%, #ffffff 0%, transparent 60%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="absolute -bottom-40 left-1/4 h-[55vw] w-[55vw] rounded-full blur-3xl opacity-25 animate-blob"
        style={{
          background: "radial-gradient(circle at 50% 50%, #7ff0ff 0%, transparent 65%)",
          animationDelay: "-12s",
        }}
      />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,220,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(120,220,255,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      {/* noise */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}