import React, { useState, useRef } from 'react';
import { Maximize2, Sparkles, ExternalLink } from 'lucide-react';

export interface HotspotPin {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  title: string;
  tag: string;
  description: string;
  metric?: string;
}

export interface Floating3DImageCardProps {
  title: string;
  route?: string;
  badge?: string;
  imageSrc: string;
  aspectRatio?: string; // e.g. 'aspect-[16/10]'
  hotspots?: HotspotPin[];
  description?: string;
  onOpenFullscreen?: () => void;
  className?: string;
  floatingAnimation?: boolean;
}

export const Floating3DImageCard: React.FC<Floating3DImageCardProps> = ({
  title,
  route,
  badge,
  imageSrc,
  aspectRatio = 'aspect-[16/10]',
  hotspots = [],
  description,
  onOpenFullscreen,
  className = '',
  floatingAnimation = true
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glareX, setGlareX] = useState(50);
  const [glareY, setGlareY] = useState(50);
  const [activeHotspot, setActiveHotspot] = useState<HotspotPin | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotY = ((x - centerX) / centerX) * 10;
    const rotX = -((y - centerY) / centerY) * 10;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlareX((x / rect.width) * 100);
    setGlareY((y / rect.height) * 100);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setGlareX(50);
    setGlareY(50);
    setActiveHotspot(null);
  };

  return (
    <div className={`relative perspective-1000 group/container min-w-0 ${className}`}>
      {/* 3D Floating Outer Wrapper */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) ${
            isHovered ? 'scale(1.02) translateZ(15px)' : 'scale(1) translateZ(0px)'
          }`,
          transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out'
        }}
        className={`relative rounded-2xl border border-white/15 bg-[#09090D] shadow-[0_15px_40px_rgba(99,102,241,0.18)] hover:shadow-[0_25px_60px_rgba(99,102,241,0.35)] hover:border-indigo-500/50 transition-shadow duration-500 overflow-hidden transform-gpu cursor-pointer ${
          floatingAnimation ? 'animate-subtle-float' : ''
        }`}
        onClick={onOpenFullscreen}
      >
        {/* Dynamic Specular Glare Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 opacity-0 group-hover/container:opacity-100"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.15) 0%, transparent 65%)`
          }}
        />

        {/* 3D Glass Header Bar */}
        <div className="bg-[#12121A]/90 backdrop-blur-md px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3 relative z-20 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>

          {/* Title & Route Container */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <h4 className="text-xs font-mono font-bold text-zinc-200 truncate min-w-0">
              {title}
            </h4>
            {route && (
              <span className="hidden sm:inline-block text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                {route}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {badge && (
              <span className="hidden md:inline-block text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {badge}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenFullscreen) onOpenFullscreen();
              }}
              className="p-1 rounded bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
              title="Expand interactive image"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3D Image View Frame */}
        <div className={`relative ${aspectRatio} overflow-hidden bg-black`}>
          <img
            src={imageSrc}
            alt={title}
            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover/container:scale-105"
          />

          {/* Depth Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

          {/* Hotspot Interactive Pins */}
          {hotspots.map((hs) => (
            <div
              key={hs.id}
              style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
              className="absolute z-40 transform -translate-x-1/2 -translate-y-1/2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setActiveHotspot(activeHotspot?.id === hs.id ? null : hs)}
                onMouseEnter={() => setActiveHotspot(hs)}
                className="relative flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600/90 text-white border border-indigo-300 shadow-xl hover:scale-125 transition-transform"
              >
                <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
                <Sparkles className="w-3 h-3 relative z-10 text-white" />
              </button>

              {activeHotspot?.id === hs.id && (
                <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-60 p-3.5 rounded-xl bg-[#0F0F16]/95 border border-indigo-500/40 text-left shadow-2xl backdrop-blur-xl z-50 animate-fadeIn font-sans text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {hs.tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveHotspot(null)}
                      className="text-zinc-500 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <h5 className="font-bold text-white text-xs mt-1 truncate">{hs.title}</h5>
                  <p className="text-zinc-400 text-[11px] mt-1 leading-relaxed">{hs.description}</p>
                  {hs.metric && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 font-mono text-[10px] text-emerald-400 font-semibold truncate">
                      {hs.metric}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Floating Bottom Info Bar */}
          <div className="absolute bottom-0 inset-x-0 p-4 z-20 flex items-end justify-between gap-3 pointer-events-none min-w-0">
            <div className="min-w-0 flex-1">
              {description && (
                <p className="text-xs text-zinc-300 font-sans line-clamp-2 drop-shadow-md leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <div className="shrink-0 font-mono text-[10px] text-indigo-300 bg-indigo-600/30 px-2.5 py-1 rounded-lg border border-indigo-400/30 backdrop-blur-md flex items-center gap-1 opacity-0 group-hover/container:opacity-100 transition-opacity">
              <ExternalLink className="w-3 h-3" /> 3D View
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
