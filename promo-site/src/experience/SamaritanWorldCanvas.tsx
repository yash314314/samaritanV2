import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SamaritanWorldCanvasProps {
  scrollProgress: number; // Master normalized scroll 0.0 to 1.0
  activeSection: string;
}

export const SamaritanWorldCanvas: React.FC<SamaritanWorldCanvasProps> = ({ scrollProgress }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const coreGroupRef = useRef<THREE.Group | null>(null);
  const ringGroupRef = useRef<THREE.Group | null>(null);
  const blocksGroupRef = useRef<THREE.Group | null>(null);
  const activityMeshesRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030304, 0.022);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 26);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Depth Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const mainLight = new THREE.PointLight(0x6366f1, 18, 110);
    mainLight.position.set(10, 15, 20);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x818cf8, 10, 90);
    rimLight.position.set(-15, -10, -10);
    scene.add(rimLight);

    // 3. Environment 1: Samaritan Core Object
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);
    coreGroupRef.current = coreGroup;

    // Core Icosahedron Wireframe
    const coreGeo = new THREE.IcosahedronGeometry(4, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      wireframe: true,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Inner Glowing Core Sphere (NOW)
    const innerGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.85 });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    // Orbiting Concentric Temporal Rings (Day, Activities, Focus, NOW)
    const ringGroup = new THREE.Group();
    coreGroup.add(ringGroup);
    ringGroupRef.current = ringGroup;

    const ringColors = [0x6366f1, 0xec4899, 0x10b981, 0x3b82f6, 0xf59e0b];
    ringColors.forEach((color, i) => {
      const radius = 6.5 + i * 1.6;
      const ringGeo = new THREE.RingGeometry(radius, radius + 0.12, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 3 + i * 0.25;
      ringMesh.rotation.y = i * 0.4;
      ringGroup.add(ringMesh);
    });

    // 4. Environment 2 & 3: 3D Spatial Activity Blocks & Calendar Grid
    const blocksGroup = new THREE.Group();
    scene.add(blocksGroup);
    blocksGroupRef.current = blocksGroup;

    const activityData = [
      { name: 'Cursor IDE', duration: 4.5, color: 0x6366f1, initialPos: [-12, 3, -6] },
      { name: 'Figma Design Tokens', duration: 2.0, color: 0xec4899, initialPos: [-5, -2, -12] },
      { name: 'Architecture Review', duration: 1.5, color: 0x10b981, initialPos: [2, 4, -18] },
      { name: 'API Refactor Session', duration: 3.0, color: 0x3b82f6, initialPos: [9, -1, -24] },
      { name: 'Calendar Timeblock', duration: 2.5, color: 0xf59e0b, initialPos: [15, 2, -30] }
    ];

    const activityMeshes: THREE.Mesh[] = [];
    activityData.forEach((act) => {
      const boxGeo = new THREE.BoxGeometry(3.6, 1.8, 1.2);
      const boxMat = new THREE.MeshStandardMaterial({
        color: act.color,
        roughness: 0.25,
        metalness: 0.55,
        emissive: act.color,
        emissiveIntensity: 0.25
      });
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.position.set(act.initialPos[0], act.initialPos[1], act.initialPos[2]);
      blocksGroup.add(mesh);
      activityMeshes.push(mesh);
    });
    activityMeshesRef.current = activityMeshes;

    // 5. Constellation Particles (Time Moments)
    const particleCount = 350;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 100;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.5,
      color: 0x818cf8,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // 6. Pointer Movement Listener for Damped Parallax
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 7. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Damped pointer parallax interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Base 3D rotations
      if (coreGroup) {
        coreGroup.rotation.y = elapsed * 0.12 + mouseRef.current.x * 0.3;
        coreGroup.rotation.x = elapsed * 0.08 + mouseRef.current.y * 0.3;
      }
      if (ringGroup) {
        ringGroup.rotation.z = -elapsed * 0.15;
      }
      if (particles) {
        particles.rotation.y = elapsed * 0.02;
      }

      // Dynamic activity block floating animation
      activityMeshes.forEach((mesh, idx) => {
        mesh.position.y += Math.sin(elapsed * 2 + idx) * 0.004;
      });

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
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D Camera, Splines & Morphing Transformations based on Master Scroll Progress
  useEffect(() => {
    if (!cameraRef.current || !coreGroupRef.current) return;

    const camera = cameraRef.current;
    const coreGroup = coreGroupRef.current;

    // Transformation A: Core Opens & Rings Extend (0.0 -> 0.25)
    // Transformation B: Horizontal Travel alongside Spatial Time Rail (0.25 -> 0.50)
    // Transformation C: Activity Blocks Rotate & Align into Calendar Grid (0.50 -> 0.75)
    // Transformation D/E: System Collapse & Reassembly back to Core (0.75 -> 1.00)

    const targetCameraZ = 26 - scrollProgress * 18;
    const targetCameraX = Math.sin(scrollProgress * Math.PI * 2) * 8;
    const targetCameraY = (scrollProgress - 0.5) * 6;

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraZ, 0.1);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.1);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCameraY, 0.1);

    // Scale & separate Samaritan Core based on scroll
    const coreScale = 1 + scrollProgress * 0.8;
    coreGroup.scale.set(coreScale, coreScale, coreScale);

    // Rotate spatial blocks into calendar alignment when scroll reaches calendar section
    activityMeshesRef.current.forEach((mesh) => {
      const rotY = scrollProgress > 0.4 ? (scrollProgress - 0.4) * Math.PI * 0.5 : 0;
      mesh.rotation.y = rotY;
    });
  }, [scrollProgress]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
};
