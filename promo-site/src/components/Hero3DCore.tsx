import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Hero3DCoreProps {
  scrollProgress: number; // 0.0 to 1.0
}

export const Hero3DCore: React.FC<Hero3DCoreProps> = ({ scrollProgress }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const coreMeshRef = useRef<THREE.Group | null>(null);
  const layersGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Central Samaritan Core Object
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);
    coreMeshRef.current = coreGroup;

    // Inner Core Icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(3.5, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Inner Glowing Core Sphere
    const innerGeo = new THREE.SphereGeometry(2.0, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.8 });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    // 3. Orbiting Temporal Subsystem Layers
    const layersGroup = new THREE.Group();
    scene.add(layersGroup);
    layersGroupRef.current = layersGroup;

    const layerColors = [0x6366f1, 0xec4899, 0x10b981, 0x3b82f6, 0xf59e0b, 0x8b5cf6];

    layerColors.forEach((color, i) => {
      const radius = 6.5 + i * 1.8;
      const ringGeo = new THREE.RingGeometry(radius, radius + 0.1, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 3 + i * 0.2;
      ringMesh.rotation.y = i * 0.3;
      layersGroup.add(ringMesh);

      // Orbiting Subsystem Node
      const nodeGeo = new THREE.SphereGeometry(0.5, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({ color });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.x = Math.cos((i * Math.PI) / 3) * radius;
      nodeMesh.position.y = Math.sin((i * Math.PI) / 3) * radius;
      layersGroup.add(nodeMesh);
    });

    // 4. Background Particle Constellation
    const particleCount = 200;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 80;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.6,
      color: 0x818cf8,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // 5. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Continuous rotation
      if (coreGroup) {
        coreGroup.rotation.y = elapsed * 0.15;
        coreGroup.rotation.x = elapsed * 0.1;
      }
      if (layersGroup) {
        layersGroup.rotation.y = -elapsed * 0.1;
        layersGroup.rotation.z = elapsed * 0.05;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D camera and decomposition based on deterministic scroll progress
  useEffect(() => {
    if (!coreMeshRef.current || !layersGroupRef.current) return;

    // Deterministic scroll progress transforms
    const rotationX = scrollProgress * Math.PI * 0.5;
    const explosionFactor = 1 + scrollProgress * 1.5; // Separate temporal layers

    if (coreMeshRef.current) {
      coreMeshRef.current.scale.set(explosionFactor, explosionFactor, explosionFactor);
      coreMeshRef.current.rotation.x = rotationX;
    }
    if (layersGroupRef.current) {
      layersGroupRef.current.scale.set(explosionFactor * 1.1, explosionFactor * 1.1, explosionFactor * 1.1);
    }
  }, [scrollProgress]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-0 opacity-75 overflow-hidden"
      aria-hidden="true"
    />
  );
};
