import { useEffect, useRef, useState } from 'react';
import { BellRing, Mail, MessageSquare, Play, Volume2 } from 'lucide-react';

import {
  NUMERIC_META_OF,
  PRIORITY_OPTIONS,
  SECTION_META,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingChips,
  SettingRow,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { NotificationsConfig, SettingValue } from '@/types/settings';

interface NotificationsSectionProps {
  cfg: NotificationsConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
  onTestTone: () => void;
}

const p = 'notifications';

const severityLabel = (value: string) => PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** Dispatch channels, severity routing and the console alert tone. */
export function NotificationsSection({ cfg, patch, pending, onTestTone }: NotificationsSectionProps) {
  const meta = SECTION_META.notifications;
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleTestTone = () => {
    if (playing) return;
    setPlaying(true);
    onTestTone();
    timer.current = window.setTimeout(() => setPlaying(false), 1600);
  };

  return (
    <SectionPanel
      id="section-notifications"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="cyan">dispatch bus healthy</StateChip>}
    >
      <SectionSubhead right="in-console + browser">
        <span className="flex items-center gap-1.5">
          <BellRing size={11} />
          Console alerts
        </span>
      </SectionSubhead>

      <SettingRow
        label="Browser notifications"
        hint="System-level popups for critical alerts even when the tab is in the background."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SettingToggle
            checked={cfg.browserNotifications}
            onChange={(next) => patch(`${p}.browserNotifications`, next)}
            label="Browser notifications"
            caption
          />
          <StateChip tone="green">permission granted</StateChip>
        </div>
      </SettingRow>

      <SettingRow
        label="Dashboard alert feed"
        hint="Show the live alert ticker on the operator dashboard."
      >
        <SettingToggle
          checked={cfg.dashboardAlerts}
          onChange={(next) => patch(`${p}.dashboardAlerts`, next)}
          label="Dashboard alert feed"
          caption
        />
      </SettingRow>

      <SettingRow
        label="Notification severity"
        hint="Only these severity bands produce operator notifications."
      >
        <SettingChips
          ariaLabel="Notification severity"
          value={cfg.severities}
          onChange={(next) => patch(`${p}.severities`, next)}
          options={PRIORITY_OPTIONS}
        />
      </SettingRow>

      <SectionSubhead right="channels below are placeholders">
        <span className="flex items-center gap-1.5">
          <Mail size={11} />
          Email & SMS dispatch
        </span>
      </SectionSubhead>

      <SettingRow label="Email dispatch" hint="Outbound alert digests to duty officers.">
        <div className="flex flex-wrap items-center gap-3">
          <SettingSelect
            ariaLabel="Email dispatch"
            value={cfg.emailNotify}
            onChange={(next) => patch(`${p}.emailNotify`, next)}
            options={[
              { value: 'off', label: 'Disabled' },
              { value: 'critical', label: 'Critical only' },
              { value: 'critical-high', label: 'Critical + high' },
              { value: 'all', label: 'All priorities' },
            ]}
          />
          <StateChip tone="amber">SMTP placeholder</StateChip>
        </div>
      </SettingRow>

      <SettingRow label="SMS dispatch" hint="Text alerts for on-ground units (needs the SMS gateway API key).">
        <div className="flex flex-wrap items-center gap-3">
          <SettingSelect
            ariaLabel="SMS dispatch"
            value={cfg.smsNotify}
            onChange={(next) => patch(`${p}.smsNotify`, next)}
            options={[
              { value: 'off', label: 'Disabled' },
              { value: 'critical', label: 'Critical only' },
              { value: 'critical-high', label: 'Critical + high' },
            ]}
          />
          <StateChip tone="amber">
            <MessageSquare size={10} /> API pending
          </StateChip>
        </div>
      </SettingRow>

      <SectionSubhead right={`alerts → ${cfg.severities.map(severityLabel).join(', ') || 'none'}`}>
        <span className="flex items-center gap-1.5">
          <Volume2 size={11} />
          Audible alert tone
        </span>
      </SectionSubhead>

      <SettingRow label="Notification sound" hint="Master mute for console alert tones.">
        <SettingToggle
          checked={cfg.soundEnabled}
          onChange={(next) => patch(`${p}.soundEnabled`, next)}
          label="Notification sound"
          caption
        />
      </SettingRow>

      <SettingRow label="Alert tone" hint="Pick the console chime profile. Test it with the play button.">
        <div className={cfg.soundEnabled ? '' : 'pointer-events-none opacity-40'}>
          <div className="flex flex-wrap items-center gap-2">
            <SettingSelect
              ariaLabel="Alert tone"
              value={cfg.soundTone}
              onChange={(next) => patch(`${p}.soundTone`, next)}
              width="xl:w-[220px]"
              options={[
                { value: 'command-chime', label: 'Command chime' },
                { value: 'digital-beep', label: 'Digital beep ×3' },
                { value: 'low-siren', label: 'Low siren' },
                { value: 'silent', label: 'Silent' },
              ]}
            />
            <button
              type="button"
              onClick={handleTestTone}
              disabled={!cfg.soundEnabled}
              className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-[#0c1424] px-2.5 text-[12px] font-semibold text-[#c3cfe2] transition-all hover:border-accent-cyan/60 hover:text-[#a5f3fc] disabled:cursor-not-allowed disabled:opacity-40"
              title="Play the selected tone"
            >
              {playing ? (
                <span className="flex items-end gap-[2px]" aria-label="Playing tone">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-sm bg-accent-cyan"
                      style={{ height: 12, animation: `pulseDot 0.5s ease-in-out ${i * 0.14}s infinite` }}
                    />
                  ))}
                </span>
              ) : (
                <Play size={12} />
              )}
              {playing ? 'Playing' : 'Test'}
            </button>
          </div>
        </div>
      </SettingRow>

      <SettingRow label="Alert volume" hint="Console volume applied to every tone.">
        <div className={cfg.soundEnabled ? '' : 'pointer-events-none opacity-40'}>
          <SettingSlider
            ariaLabel="Alert volume"
            value={cfg.volume}
            meta={NUMERIC_META_OF(`${p}.volume`)}
            onChange={(next) => patch(`${p}.volume`, next)}
          />
        </div>
      </SettingRow>
    </SectionPanel>
  );
}
