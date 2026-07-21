/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const createSeededRandom = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const Constellation = ({ accentColor, active, points }) => {
  const groupRef = useRef(null);
  const score = Math.max(0, Number(points) || 0);
  const { starPositions, connectionPositions } = useMemo(() => {
    const random = createSeededRandom(20260716 + Math.min(score, 100));
    const stars = [];
    const starCount = 58;

    for (let index = 0; index < starCount; index += 1) {
      stars.push([
        (random() - 0.5) * 12.8,
        (random() - 0.5) * 5.6,
        (random() - 0.5) * 2.8,
      ]);
    }

    const connections = [];
    stars.forEach((star, index) => {
      let closestIndex = -1;
      let closestDistance = 2.15;

      for (let candidate = index + 1; candidate < stars.length; candidate += 1) {
        const distance = Math.hypot(
          star[0] - stars[candidate][0],
          star[1] - stars[candidate][1],
          star[2] - stars[candidate][2],
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = candidate;
        }
      }

      if (closestIndex >= 0) connections.push(...star, ...stars[closestIndex]);
    });

    return {
      starPositions: new Float32Array(stars.flat()),
      connectionPositions: new Float32Array(connections),
    };
  }, [score]);

  useFrame((state) => {
    if (!active || !groupRef.current) return;
    const elapsed = state.clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(elapsed * 0.08) * 0.025;
    groupRef.current.rotation.y = Math.sin(elapsed * 0.12) * 0.055;
    groupRef.current.position.y = Math.sin(elapsed * 0.28) * 0.08;
  });

  return (
    <group ref={groupRef}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[connectionPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={accentColor}
          transparent
          opacity={0.24}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.075}
          sizeAttenuation
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <Sparkles
        count={active ? 42 : 0}
        scale={[12.5, 5.2, 2.5]}
        size={1.35}
        speed={active ? 0.22 : 0}
        color={accentColor}
        opacity={0.46}
      />
    </group>
  );
};

const useMotionState = () => {
  const [state, setState] = useState({ reduced: false, visible: true });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setState({ reduced: media.matches, visible: !document.hidden });
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return state;
};

const SantriLevelScene = ({ accentColor = '#0ea5e9', points = 0 }) => {
  const { reduced, visible } = useMotionState();
  const active = visible && !reduced;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(circle at 72% 42%, ${accentColor}42, transparent 44%), radial-gradient(circle at 18% 80%, ${accentColor}22, transparent 35%)`,
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 7.2], fov: 43 }}
        dpr={[1, 1.45]}
        frameloop={active ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <Constellation accentColor={accentColor} active={active} points={points} />
      </Canvas>
    </div>
  );
};

export default SantriLevelScene;
