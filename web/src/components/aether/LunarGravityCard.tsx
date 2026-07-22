import React, { useRef, useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { cn } from '../../lib/utils';

/* Faithful port of the 21st.dev "Lunar Gravity" card. Only two deliberate
   changes from the original, both about robustness — the LOOK is unchanged:
   - assets are VENDORED locally (public/textures/moon_1024.jpg,
     public/hdri/city_1k.hdr) instead of hotlinking GitHub / a CDN at runtime;
   - Hebrew title/description defaults + RTL for Easy Life.
   The realistic moon texture, the city HDRI lighting, the particle shader and
   the click-to-form-the-ring interaction are all intact. */

const MOON_TEXTURE = '/textures/moon_1024.jpg';
const CITY_HDRI = '/hdri/city_1k.hdr';
const RADIUS = 2.0;

// Per-frame scratch objects — reused every frame so the render loop allocates
// nothing (no GC pauses = smooth motion). Safe: a single ParticleRing exists.
const _invMat = new THREE.Matrix4();
const _astVec = new THREE.Vector3();

const RealisticMoon = ({ onClick }: { onClick?: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const colorMap = useTexture(MOON_TEXTURE);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.07;
  });

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial map={colorMap} bumpMap={colorMap} bumpScale={0.02} roughness={0.8} metalness={0.1} />
    </mesh>
  );
};

const particlesCount = 35000;
const [ringPositions, ringColors, ringRandoms] = (() => {
  const pos = new Float32Array(particlesCount * 3);
  const col = new Float32Array(particlesCount * 3);
  const rnd = new Float32Array(particlesCount);

  for (let i = 0; i < particlesCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rDist = Math.pow(Math.random(), 1.5);
    const radius = 2.2 + rDist * 2.2;
    const thickness = 0.4 - rDist * 0.2;
    const ySpread = Math.random() + Math.random() + Math.random() - 1.5;
    const y = ySpread * thickness;

    pos[i * 3] = Math.cos(angle) * radius;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(angle) * radius;

    const intensity = 1.0 - rDist;
    const paletteType = Math.random();
    let baseR, baseG, baseB;
    if (paletteType < 0.8) {
      baseR = 0.25; baseG = 0.3; baseB = 0.35;
    } else if (paletteType < 0.92) {
      baseR = 0.0; baseG = 0.6; baseB = 0.8;
    } else {
      baseR = 0.6; baseG = 0.2; baseB = 0.8;
    }
    baseR = Math.min(1, Math.max(0, baseR + (Math.random() - 0.5) * 0.1));
    baseG = Math.min(1, Math.max(0, baseG + (Math.random() - 0.5) * 0.1));
    baseB = Math.min(1, Math.max(0, baseB + (Math.random() - 0.5) * 0.1));

    const sparkle = Math.random() > 0.95 ? 2.5 : 1.0;
    col[i * 3] = baseR * intensity * sparkle;
    col[i * 3 + 1] = baseG * intensity * sparkle;
    col[i * 3 + 2] = baseB * intensity * sparkle;
    rnd[i] = Math.random();
  }
  return [pos, col, rnd];
})();

const ParticleRing = ({
  ringState,
  massiveAsteroidsRef,
}: {
  ringState: 'hidden' | 'animating' | 'visible';
  massiveAsteroidsRef: React.MutableRefObject<Float32Array>;
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const uniforms = useRef({
    uProgress: { value: ringState === 'visible' ? 1.0 : 0.0 },
    uAsteroids: { value: new Float32Array(75 * 4) },
    time: { value: 0 },
  });

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= delta * 0.035;
      pointsRef.current.updateMatrix();
      _invMat.copy(pointsRef.current.matrix).invert();
      const src = massiveAsteroidsRef.current;
      const dst = uniforms.current.uAsteroids.value; // write in place — no realloc
      for (let i = 0; i < 75; i++) {
        _astVec.set(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]).applyMatrix4(_invMat);
        dst[i * 4] = _astVec.x;
        dst[i * 4 + 1] = _astVec.y;
        dst[i * 4 + 2] = _astVec.z;
        dst[i * 4 + 3] = src[i * 4 + 3];
      }
    }
    uniforms.current.time.value = state.clock.elapsedTime;

    if (ringState === 'animating') {
      uniforms.current.uProgress.value += delta * 0.35;
      if (uniforms.current.uProgress.value > 1.0) uniforms.current.uProgress.value = 1.0;
    } else if (ringState === 'visible') {
      uniforms.current.uProgress.value = 1.0;
    } else {
      uniforms.current.uProgress.value = 0.0;
    }
  });

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uProgress = uniforms.current.uProgress;
    shader.uniforms.uAsteroids = uniforms.current.uAsteroids;
    shader.uniforms.time = uniforms.current.time;

    shader.vertexShader = `
      uniform float uProgress;
      uniform vec4 uAsteroids[75];
      uniform float time;
      attribute float aRandom;
      varying float vProgress;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `
      vec3 transformed = vec3(position);
      float angle = atan(transformed.x, transformed.z);
      float normalizedAngle = abs(angle) / 3.14159265359;
      float spawnThreshold = 1.0 - normalizedAngle;
      float progressValue = (uProgress * 1.4) - spawnThreshold;
      float particleProgress = smoothstep(0.0, 0.4, progressValue);
      vProgress = particleProgress;
      transformed.y += sin(angle * 10.0 + time) * 0.05 * aRandom;
      if (uProgress > 0.5) {
        for(int i = 0; i < 75; i++) {
          vec4 astData = uAsteroids[i];
          vec3 delta = transformed - astData.xyz;
          float dist = length(delta);
          float rad = astData.w * 2.0 + 0.15;
          if (dist < rad) {
             float force = pow((rad - dist) / rad, 2.0);
             transformed += normalize(delta) * force * 0.4;
             transformed.y += force * 0.20 * (aRandom - 0.5);
          }
        }
      }
      float swirl = (1.0 - particleProgress) * 4.0;
      float s = sin(swirl);
      float c = cos(swirl);
      transformed.xz = mat2(c, -s, s, c) * transformed.xz;
      transformed.y += (1.0 - particleProgress) * (transformed.y >= 0.0 ? 1.0 : -1.0);
      vec3 moonSurface = normalize(transformed) * 2.1;
      transformed = mix(moonSurface, transformed, particleProgress);
      `,
    );

    shader.fragmentShader = `
      varying float vProgress;
      ${shader.fragmentShader}
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      `
      #include <color_fragment>
      diffuseColor.a *= vProgress;
      `,
    );
  };

  return (
    <points ref={pointsRef} rotation={[-Math.PI / 2, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particlesCount} array={ringPositions} itemSize={3} args={[ringPositions, 3]} />
        <bufferAttribute attach="attributes-color" count={particlesCount} array={ringColors} itemSize={3} args={[ringColors, 3]} />
        <bufferAttribute attach="attributes-aRandom" count={particlesCount} array={ringRandoms} itemSize={1} args={[ringRandoms, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.008}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        onBeforeCompile={onBeforeCompile}
      />
    </points>
  );
};

const generateAsteroids = (count: number) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    const rotationSpeedX = (Math.random() - 0.5) * 0.05;
    const rotationSpeedY = (Math.random() - 0.5) * 0.05;
    const rotationSpeedZ = (Math.random() - 0.5) * 0.05;
    data.push({
      angle: Math.random() * Math.PI * 2,
      baseRadius: 2.8 + Math.random() * 2.0,
      radialAmplitude: 0.5 + Math.random() * 1.5,
      radialSpeed: 0.15 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      zOffset: (Math.random() - 0.5) * 0.8,
      speed: (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1),
      rx: Math.random() * Math.PI, ry: Math.random() * Math.PI, rz: Math.random() * Math.PI,
      rsx: rotationSpeedX, rsy: rotationSpeedY, rsz: rotationSpeedZ,
      scale: 0.02 + Math.pow(Math.random(), 4) * 0.18,
    });
  }
  data.sort((a, b) => b.scale - a.scale);
  return data;
};

const AsteroidBelt = ({
  ringState,
  massiveAsteroidsRef,
}: {
  ringState: 'hidden' | 'animating' | 'visible';
  massiveAsteroidsRef: React.MutableRefObject<Float32Array>;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [colorMap, bumpMap] = useTexture([MOON_TEXTURE, MOON_TEXTURE]);
  const count = 75;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [asteroids] = useState(() => generateAsteroids(count));
  const scaleRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetScale = ringState === 'hidden' ? 0 : 1;
    const lerpSpeed = ringState === 'hidden' ? 5 : 2;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * lerpSpeed);
    if (scaleRef.current < 0.01) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    asteroids.forEach((ast, i) => {
      ast.angle += ast.speed * delta;
      ast.phase += ast.radialSpeed * delta;
      let currentRadius = ast.baseRadius + Math.sin(ast.phase) * ast.radialAmplitude;
      if (currentRadius < 2.15) currentRadius = 2.15 + (2.15 - currentRadius) * 0.85;
      const x = Math.cos(ast.angle) * currentRadius;
      const y = Math.sin(ast.angle) * currentRadius;

      massiveAsteroidsRef.current[i * 4] = x;
      massiveAsteroidsRef.current[i * 4 + 1] = y;
      massiveAsteroidsRef.current[i * 4 + 2] = ast.zOffset;
      massiveAsteroidsRef.current[i * 4 + 3] = ast.scale;

      ast.rx += ast.rsx; ast.ry += ast.rsy; ast.rz += ast.rsz;
      dummy.position.set(x, y, ast.zOffset);
      dummy.rotation.set(ast.rx, ast.ry, ast.rz);
      dummy.scale.setScalar(ast.scale * scaleRef.current);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial map={colorMap} bumpMap={bumpMap} bumpScale={0.08} color="#ffffff" roughness={0.7} metalness={0.1} />
    </instancedMesh>
  );
};

export interface LunarGravityCardProps {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export default function LunarGravityCard({ className, title, description }: LunarGravityCardProps) {
  const [ringState, setRingState] = useState<'hidden' | 'animating' | 'visible'>('hidden');
  const massiveAsteroidsRef = useRef<Float32Array>(new Float32Array(75 * 4));

  // Auto-form the asteroid ring shortly after mount so the scene is alive
  // without needing a click; a click still re-triggers it while hidden.
  useEffect(() => {
    const t = setTimeout(() => setRingState((s) => (s === 'hidden' ? 'animating' : s)), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      dir="rtl"
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-white to-[#eef2f8] shadow-card md:flex-row',
        className,
      )}
    >
      {/* text side (right in RTL) */}
      <div className="pointer-events-none relative z-20 flex w-full flex-col justify-center px-8 py-8 md:w-[45%] md:pe-12 md:ps-4">
        <h2
          className="mb-4 text-4xl font-bold leading-[1.05] tracking-tight text-ink md:text-5xl"
          style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
        >
          {title ?? (
            <>
              הכנסה ב<span className="text-gradient">מהירות המחשבה</span>
            </>
          )}
        </h2>
        <p className="max-w-[340px] text-sm font-medium leading-relaxed text-muted md:text-base">
          {description ?? 'כל הסוכנים חולקים מוח אחד — לידים, שיחות ועסקאות זורמים אליכם בזמן אמת.'}
        </p>
      </div>

      {/* light scrim so text stays legible over the scene (left in RTL) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden h-full w-[55%] bg-gradient-to-l from-transparent via-white/50 to-white md:block" />

      {/* 3D side */}
      <div className="pointer-events-auto absolute inset-0 z-0 flex items-center justify-center md:right-auto md:left-0 md:w-[65%]">
        <Canvas shadows camera={{ position: [0, 4, 10], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[8, 5, 5]} intensity={1.8} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-5, -3, -5]} intensity={0.25} color="#4a90e2" />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.9} />
          <group rotation={[Math.PI / 8, 0, 0]}>
            <Suspense fallback={null}>
              <RealisticMoon onClick={() => ringState === 'hidden' && setRingState('animating')} />
              <ParticleRing ringState={ringState} massiveAsteroidsRef={massiveAsteroidsRef} />
              <AsteroidBelt ringState={ringState} massiveAsteroidsRef={massiveAsteroidsRef} />
              <Environment files={CITY_HDRI} />
            </Suspense>
          </group>
        </Canvas>
      </div>
    </div>
  );
}

export { LunarGravityCard as Component };
