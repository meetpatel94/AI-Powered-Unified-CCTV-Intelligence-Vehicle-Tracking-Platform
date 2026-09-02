import { Cctv, Cloud, Radio, ServerCog, Settings2, Zap, type LucideIcon } from 'lucide-react';

import { sectionLabelOf } from '@/data/settingsData';

/** One stage in the live-apply runbook. */
export interface ApplyStepDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Builds the runbook for a live configuration push, keeping only the
 * stages relevant to the subsystems that actually changed.
 */
export function buildApplySteps(subsystems: string[]): ApplyStepDef[] {
  const steps: ApplyStepDef[] = [
    {
      id: 'validate',
      label: 'Validate configuration draft',
      description: 'Bounds, required fields and cross-section rules checked',
      icon: Settings2,
    },
    {
      id: 'persist',
      label: 'Persist configuration snapshot',
      description: 'Draft committed to the configuration store with a version bump',
      icon: Cloud,
    },
    {
      id: 'gateway',
      label: 'Push stream-gateway profile',
      description: 'RTSP timeouts · codecs · WebRTC/HLS transport · session caps',
      icon: Cctv,
    },
    {
      id: 'ai',
      label: 'Hot-reload AI & ANPR engine',
      description: 'Detection classes · confidence floors · OCR policies',
      icon: Zap,
    },
    {
      id: 'services',
      label: 'Reconfigure auxiliary services',
      description: 'Map layers · notification routes · retention scheduler',
      icon: ServerCog,
    },
    {
      id: 'confirm',
      label: 'Confirm live status',
      description: 'Health checks across gateway, AI engine and database',
      icon: Radio,
    },
  ];
  return steps.filter(
    (step) =>
      step.id === 'validate' || step.id === 'persist' || step.id === 'confirm' || subsystems.some((name) => stepMatches(step.id, name)),
  );
}

function stepMatches(stepId: string, subsystem: string): boolean {
  const label = sectionLabelOf(subsystem).toLowerCase();
  switch (stepId) {
    case 'gateway':
      return label.includes('camera') || label.includes('stream');
    case 'ai':
      return (
        label.includes('ai') ||
        label.includes('anpr') ||
        label.includes('detect') ||
        label.includes('track') ||
        label.includes('watchlist')
      );
    case 'services':
      return (
        label.includes('map') ||
        label.includes('gis') ||
        label.includes('notification') ||
        label.includes('general') ||
        label.includes('user') ||
        label.includes('storage') ||
        label.includes('performance') ||
        label.includes('security') ||
        label.includes('audit') ||
        label.includes('maintenance')
      );
    default:
      return false;
  }
}
