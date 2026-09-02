import { Camera, TriangleAlert, WifiOff } from 'lucide-react';

import { statusColor } from '@/data/cameraMapData';
import type { MapCameraNode, MapCameraStatus } from '@/types/cameraMap';

export interface Cluster {
  key: string;
  x: number;
  y: number;
  cameras: MapCameraNode[];
  dominant: MapCameraStatus;
}

const severity: Record<MapCameraStatus, number> = { critical: 3, warning: 2, offline: 1, online: 0 };

/** Screen-space grid clustering — cheap, stable and good enough for 60+ pins. */
export function buildClusters(
  cameras: MapCameraNode[],
  project: (x: number, y: number) => { x: number; y: number },
  cellPx: number,
): { clusters: Cluster[]; singles: Array<MapCameraNode & { sx: number; sy: number }> } {
  const buckets = new Map<string, Cluster>();

  cameras.forEach((camera) => {
    const p = project(camera.x, camera.y);
    const key = `${Math.floor(p.x / cellPx)}:${Math.floor(p.y / cellPx)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.cameras.push(camera);
      existing.x = (existing.x * (existing.cameras.length - 1) + p.x) / existing.cameras.length;
      existing.y = (existing.y * (existing.cameras.length - 1) + p.y) / existing.cameras.length;
      if (severity[camera.status] > severity[existing.dominant]) existing.dominant = camera.status;
    } else {
      buckets.set(key, { key, x: p.x, y: p.y, cameras: [camera], dominant: camera.status });
    }
  });

  const clusters: Cluster[] = [];
  const singles: Array<MapCameraNode & { sx: number; sy: number }> = [];

  buckets.forEach((bucket) => {
    if (bucket.cameras.length > 1) {
      clusters.push(bucket);
    } else {
      const camera = bucket.cameras[0];
      const p = project(camera.x, camera.y);
      singles.push({ ...camera, sx: p.x, sy: p.y });
    }
  });

  return { clusters, singles };
}

interface MarkerLayerProps {
  clusters: Cluster[];
  singles: Array<MapCameraNode & { sx: number; sy: number }>;
  selectedId?: string;
  onSelect: (camera: MapCameraNode) => void;
  onExpandCluster: (cluster: Cluster) => void;
}

function StatusGlyph({ status }: { status: MapCameraStatus }) {
  if (status === 'offline') return <WifiOff size={10} strokeWidth={2.4} className="text-white/90" />;
  if (status === 'warning') return <TriangleAlert size={10} strokeWidth={2.4} className="text-black/85" />;
  return <Camera size={10} strokeWidth={2.4} className="text-white" />;
}

/** All camera pins + cluster bubbles, positioned in screen space. */
export function CameraMarkerLayer({
  clusters,
  singles,
  selectedId,
  onSelect,
  onExpandCluster,
}: MarkerLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* clusters */}
      {clusters.map((cluster) => {
        const color = statusColor[cluster.dominant];
        const size = cluster.cameras.length > 12 ? 38 : cluster.cameras.length > 6 ? 33 : 28;
        return (
          <button
            key={cluster.key}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onExpandCluster(cluster);
            }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-110"
            style={{ left: cluster.x, top: cluster.y, width: size, height: size }}
            title={`${cluster.cameras.length} cameras — click to expand`}
          >
            <span
              className="absolute inset-0 rounded-full opacity-25"
              style={{ background: color, transform: 'scale(1.45)' }}
            />
            <span
              className="tnum absolute inset-0 grid place-items-center rounded-full border-2 border-white/80 text-[12px] font-bold text-white"
              style={{ background: color, boxShadow: `0 0 14px ${color}aa` }}
            >
              {cluster.cameras.length}
            </span>
          </button>
        );
      })}

      {/* individual cameras */}
      {singles.map((camera) => {
        const color = statusColor[camera.status];
        const isSelected = camera.id === selectedId;
        const isCritical = camera.status === 'critical';

        return (
          <button
            key={camera.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(camera);
            }}
            title={`${camera.id} · ${camera.location}`}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
            style={{ left: camera.sx, top: camera.sy, zIndex: isSelected ? 30 : isCritical ? 20 : 10 }}
          >
            {(isCritical || isSelected) && (
              <span
                className="absolute left-1/2 top-1/2 h-[21px] w-[21px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping2"
                style={{ background: isSelected ? '#3b82f6' : color, opacity: 0.5 }}
              />
            )}
            <span
              className={`relative grid h-[19px] w-[19px] place-items-center rounded-full ${
                isSelected ? 'ring-[2.5px] ring-white' : 'ring-1 ring-black/50'
              }`}
              style={{ background: color, boxShadow: `0 0 9px ${color}b0` }}
            >
              <StatusGlyph status={camera.status} />
            </span>
            <span
              className="absolute left-1/2 top-full -mt-[5px] h-[8px] w-[8px] -translate-x-1/2 rotate-45"
              style={{ background: color }}
            />
          </button>
        );
      })}
    </div>
  );
}
