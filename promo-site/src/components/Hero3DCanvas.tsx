import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const Hero3DCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. 3D Particle Constellation (Focus Nodes)
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const purpleColor = new THREE.Color('#8b5cf6');
    const indigoColor = new THREE.Color('#6366f1');
    const pinkColor = new THREE.Color('#ec4899');
    const emeraldColor = new THREE.Color('#10b981');

    const colorPalette = [purpleColor, indigoColor, pinkColor, emeraldColor];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 3. Connecting Constellation Lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.15
    });

    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(particleCount * particleCount * 6);
    let linePointsCount = 0;

    const posAttr = geometry.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      for (let j = i + 1; j < particleCount; j++) {
        const x1 = posAttr.getX(i), y1 = posAttr.getY(i), z1 = posAttr.getZ(i);
        const x2 = posAttr.getX(j), y2 = posAttr.getY(j), z2 = posAttr.getZ(j);

        const dist = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2);
        if (dist < 8) {
          linePositions[linePointsCount * 6] = x1;
          linePositions[linePointsCount * 6 + 1] = y1;
          linePositions[linePointsCount * 6 + 2] = z1;
          linePositions[linePointsCount * 6 + 3] = x2;
          linePositions[linePointsCount * 6 + 4] = y2;
          linePositions[linePointsCount * 6 + 5] = z2;
          linePointsCount++;
        }
      }
    }

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions.slice(0, linePointsCount * 6), 3));
    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);

    // 4. Mouse Tracking for 3D Parallax Effect
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.01;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.01;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 5. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      particles.rotation.y = elapsedTime * 0.05 + targetX * 0.5;
      particles.rotation.x = elapsedTime * 0.02 + targetY * 0.5;

      linesMesh.rotation.y = particles.rotation.y;
      linesMesh.rotation.x = particles.rotation.x;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // 6. Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-0 opacity-60 overflow-hidden"
      aria-hidden="true"
    />
  );
};
