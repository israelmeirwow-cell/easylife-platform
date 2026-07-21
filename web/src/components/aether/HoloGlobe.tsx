import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function latLonToVec3(lat: number, lon: number, r: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// Israel + major hubs the business's contacts/channels are likely to come from.
const NODES = [
  { lat: 32.08, lon: 34.78, name: 'תל אביב' },
  { lat: 31.77, lon: 35.21, name: 'ירושלים' },
  { lat: 32.79, lon: 34.99, name: 'חיפה' },
  { lat: 31.25, lon: 34.79, name: 'באר שבע' },
  { lat: 40.7, lon: -74, name: 'ניו יורק' },
  { lat: 51.5, lon: -0.12, name: 'לונדון' },
  { lat: 48.85, lon: 2.35, name: 'פריז' },
  { lat: 52.52, lon: 13.4, name: 'ברלין' },
];

function Globe() {
  const ref = useRef<THREE.Group>(null);
  const dotsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const R = 2;
    for (let lat = -80; lat <= 80; lat += 6) {
      const circumference = Math.cos((lat * Math.PI) / 180) * 2 * Math.PI;
      const count = Math.max(6, Math.floor(circumference * 12));
      for (let i = 0; i < count; i++) {
        const lon = (i / count) * 360 - 180;
        const v = latLonToVec3(lat, lon, R);
        positions.push(v.x, v.y, v.z);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  const nodes = useMemo(() => NODES.map((l) => latLonToVec3(l.lat, l.lon, 2.02)), []);
  const arcs = useMemo(() => {
    const list: THREE.Vector3[][] = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[0]; // arcs radiate from Tel Aviv (home base)
      const b = nodes[i];
      if (a === b) continue;
      const mid = a.clone().add(b).multiplyScalar(0.5).setLength(3.1);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      list.push(curve.getPoints(40));
    }
    return list;
  }, [nodes]);

  useFrame((_state, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[1.98, 64, 64]} />
        <meshBasicMaterial color="#0a1626" transparent opacity={0.85} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.02, 32, 32]} />
        <meshBasicMaterial color="#7ff0ff" wireframe transparent opacity={0.06} />
      </mesh>
      <points geometry={dotsGeo}>
        <pointsMaterial size={0.028} color="#7ff0ff" transparent opacity={0.85} sizeAttenuation />
      </points>
      {nodes.map((v, i) => (
        <group key={i} position={v.toArray()}>
          <mesh>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={i === 0 ? '#e6edf3' : i % 3 === 1 ? '#7ff0ff' : '#8ea3b5'} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshBasicMaterial
              color={i === 0 ? '#e6edf3' : i % 3 === 1 ? '#7ff0ff' : '#8ea3b5'}
              transparent
              opacity={0.15}
            />
          </mesh>
        </group>
      ))}
      {arcs.map((pts, i) => {
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <primitive
            key={i}
            object={
              new THREE.Line(g, new THREE.LineBasicMaterial({ color: i % 2 ? '#e6edf3' : '#7ff0ff', transparent: true, opacity: 0.5 }))
            }
          />
        );
      })}
      {/* outer glow */}
      <mesh>
        <sphereGeometry args={[2.35, 32, 32]} />
        <meshBasicMaterial color="#7ff0ff" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

export function HoloGlobe() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#7ff0ff" />
      <pointLight position={[-5, -3, -5]} intensity={0.8} color="#e6edf3" />
      <Stars radius={40} depth={30} count={2000} factor={2} fade speed={0.5} />
      <Globe />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.4} />
    </Canvas>
  );
}
