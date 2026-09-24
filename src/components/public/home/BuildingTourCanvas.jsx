/* eslint-disable react/no-unknown-property */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { sampleCamera } from './buildingTourMath';

function TourScene({ tour, progressRef, invalidateRef, onReady, onFailure, attempt }) {
  const { scene } = useGLTF(`/models/lpq-building.glb${attempt ? `?retry=${attempt}` : ''}`);
  const { camera, gl, invalidate, size } = useThree();
  const current = useRef(progressRef.current);
  const visible = useRef(true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (!object.isMesh) return;
      // Only the reveal meshes need private materials; cached GLTF materials stay reusable.
      if (object.userData.tourReveal) {
        object.material = object.material.clone();
        object.userData.baseOpacity = object.material.opacity;
        object.material.transparent = true;
        object.material.depthWrite = false;
      }
      object.castShadow = !object.userData.tourReveal && !object.name.includes('Anyaman');
      object.receiveShadow = true;
    });
    return copy;
  }, [scene]);

  useEffect(() => {
    invalidateRef.current = invalidate;
    gl.shadowMap.needsUpdate = true;
    const lost = (event) => { event.preventDefault(); onFailure('Konteks WebGL terputus'); };
    const visibility = () => {
      visible.current = !document.hidden;
      if (visible.current) invalidate();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', visibility);
    onReady();
    invalidate();
    return () => {
      invalidateRef.current = null;
      gl.domElement.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', visibility);
      model.traverse((object) => {
        if (object.isMesh && object.userData.tourReveal) object.material.dispose();
      });
    };
  }, [gl, invalidate, invalidateRef, model, onFailure, onReady]);

  useFrame((_, delta) => {
    if (!visible.current) return;
    const remaining = progressRef.current - current.current;
    current.current = Math.abs(remaining) < 0.00001
      ? progressRef.current
      : current.current + remaining * (1 - Math.exp(-Math.min(delta, 0.1) * 10));
    const pose = sampleCamera(tour.keyframes, current.current);
    camera.position.fromArray(pose.position);
    camera.lookAt(...pose.target);
    const aspect = size.width / Math.max(1, size.height);
    camera.fov = Math.min(85, 2 * Math.atan(Math.tan(pose.fov * Math.PI / 360) * Math.max(1, (1500 / 950) / aspect)) * 180 / Math.PI);
    camera.updateProjectionMatrix();
    const opacity = 1 - Math.max(0, Math.min(1, (current.current - 0.70) / 0.08));
    model.traverse((object) => {
      if (!object.isMesh || !object.userData.tourReveal) return;
      object.material.opacity = opacity * object.userData.baseOpacity;
      object.visible = opacity > 0.01;
    });
    if (Math.abs(remaining) > 0.00001) invalidate();
  });

  return <primitive object={model} dispose={null} />;
}

export default function BuildingTourCanvas(props) {
  return (
    <Canvas
      shadows={!props.mobile}
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{ position: props.tour.keyframes[0].position, fov: props.tour.keyframes[0].fov, near: 0.04, far: 160 }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearColor(0x000000, 0);
        gl.shadowMap.autoUpdate = false;
      }}
      fallback={<span>Pratinjau gedung tersedia dalam bentuk gambar.</span>}
    >
      <hemisphereLight args={['#f0f6ff', '#b6aaa0', 1.5]} />
      <directionalLight position={[8, 20, 12]} intensity={2.2} color="#fff0d8" castShadow={!props.mobile}
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-28} shadow-camera-right={28}
        shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={0.5}
        shadow-camera-far={70} shadow-bias={-0.0003} shadow-normalBias={0.03} />
      <directionalLight position={[-3, 8, 5]} intensity={0.6} color="#bedbff" />
      <Suspense fallback={null}><TourScene {...props} /></Suspense>
    </Canvas>
  );
}
