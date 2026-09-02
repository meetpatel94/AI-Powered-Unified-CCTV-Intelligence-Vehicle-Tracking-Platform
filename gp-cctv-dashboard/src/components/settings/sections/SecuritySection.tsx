import { useRef, useState } from 'react';
import { FileKey2, Globe, KeyRound, Lock, ShieldCheck, Siren } from 'lucide-react';

import { SECTION_META } from '@/data/settingsData';

import { ConfirmModal } from '@/components/settings/ConfirmModal';
import {
  InfoNote,
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSelect,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { SecurityConfig, SettingValue } from '@/types/settings';

interface SecuritySectionProps {
  cfg: SecurityConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
  /** Records a key-rotation event into the change ledger. */
  onRotateKeys: () => void;
  onNotice: (message: string) => void;
}

const p = 'security';

/** Transport security, encryption posture and access defence. */
export function SecuritySection({ cfg, patch, pending, onRotateKeys, onNotice }: SecuritySectionProps) {
  const meta = SECTION_META.security;
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [lastRotation, setLastRotation] = useState('14 days ago · next auto-rotation in 6 days');
  const timer = useRef<number | undefined>(undefined);

  return (
    <SectionPanel
      id="section-security"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={
        <StateChip tone="green">
          <ShieldCheck size={11} /> posture · hardened
        </StateChip>
      }
    >
      <SectionSubhead right="transport & data protection">
        <span className="flex items-center gap-1.5">
          <Lock size={11} />
          Session & encryption
        </span>
      </SectionSubhead>

      <SettingRow
        label="Secure sessions only"
        hint="Refuse plain-HTTP sessions. TLS 1.3 + HSTS + OCSP stapling on every console connection."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SettingToggle
            checked={cfg.secureSessionOnly}
            onChange={(next) => patch(`${p}.secureSessionOnly`, next)}
            label="Secure sessions only"
            caption
          />
          <StateChip tone="cyan">TLS 1.3 · HSTS</StateChip>
        </div>
      </SettingRow>

      <SettingRow label="Encryption in transit" hint="Stream payloads and WebSocket frames are encrypted end-to-end.">
        <SettingToggle
          checked={cfg.encryptionInTransit}
          onChange={(next) => patch(`${p}.encryptionInTransit`, next)}
          label="Encryption in transit"
          caption
        />
      </SettingRow>

      <SettingRow label="Encryption at rest" hint="Evidence and metadata volumes use AES-256-GCM with HSM-backed keys.">
        <div className="flex flex-wrap items-center gap-3">
          <SettingToggle
            checked={cfg.encryptionAtRest}
            onChange={(next) => patch(`${p}.encryptionAtRest`, next)}
            label="Encryption at rest"
            caption
          />
          <StateChip tone="cyan">AES-256-GCM · HSM</StateChip>
        </div>
      </SettingRow>

      <SettingRow label="Encryption keys" hint={lastRotation}>
        <button
          type="button"
          onClick={() => setRotateOpen(true)}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-[#0c1424] px-3 text-[12px] font-semibold text-[#c3cfe2] transition-all hover:border-accent-cyan/60 hover:text-[#a5f3fc]"
        >
          <KeyRound size={13} />
          Rotate encryption keys
        </button>
      </SettingRow>

      <SectionSubhead right="API gateway · v1">
        <span className="flex items-center gap-1.5">
          <Globe size={11} />
          API access
        </span>
      </SectionSubhead>

      <SettingRow
        label="API access level"
        hint="Which networks may call the platform API. Key rotation is a placeholder until the gateway lands."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SettingSelect
            ariaLabel="API access level"
            value={cfg.apiAccessLevel}
            onChange={(next) => patch(`${p}.apiAccessLevel`, next)}
            options={[
              { value: 'internal', label: 'Internal network only' },
              { value: 'vpn', label: 'VPN + trusted partners' },
              { value: 'authenticated', label: 'Authenticated partners' },
              { value: 'public', label: 'Public (staging only)' },
            ]}
          />
          <StateChip tone="amber">
            <FileKey2 size={10} /> key rotation pending
          </StateChip>
        </div>
      </SettingRow>

      <SettingRow
        label="Restrict to registered workstations"
        hint="Only hardware-enrolled consoles (TPM attested) may open the operator console."
      >
        <SettingToggle
          checked={cfg.restrictWorkstations}
          onChange={(next) => patch(`${p}.restrictWorkstations`, next)}
          label="Restrict to registered workstations"
          caption
        />
      </SettingRow>

      <SectionSubhead right="defence-in-depth">
        <span className="flex items-center gap-1.5">
          <Siren size={11} />
          Login protection
        </span>
      </SectionSubhead>

      <SettingRow label="Audit logging" hint="Write every privileged action to the tamper-evident audit ledger.">
        <SettingToggle checked={cfg.auditLogging} onChange={(next) => patch(`${p}.auditLogging`, next)} label="Audit logging" caption />
      </SettingRow>

      <SettingRow label="Login protection" hint="Rate limiting, CAPTCHA challenge and IP reputation checks at the auth boundary.">
        <SettingToggle
          checked={cfg.loginProtection}
          onChange={(next) => patch(`${p}.loginProtection`, next)}
          label="Login protection"
          caption
        />
      </SettingRow>

      <SettingRow
        label="Suspicious-access detection"
        hint="Behavioural flags: impossible travel, tor exit nodes, off-hours admin logins."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SettingToggle
            checked={cfg.suspiciousAccessDetection}
            onChange={(next) => patch(`${p}.suspiciousAccessDetection`, next)}
            label="Suspicious-access detection"
            caption
          />
          <StateChip tone="green">38 IPs quarantined · 24 h</StateChip>
        </div>
      </SettingRow>

      <SettingRow label="Suspicion trigger" hint="Failed-login volume that elevates a source to 'suspicious'.">
        <div className={cfg.suspiciousAccessDetection ? '' : 'pointer-events-none opacity-40'}>
          <SettingSelect
            ariaLabel="Suspicion trigger"
            value={cfg.suspiciousThreshold}
            onChange={(next) => patch(`${p}.suspiciousThreshold`, next)}
            options={[
              { value: '2-failures', label: '2 failed logins / 10 min' },
              { value: '3-failures', label: '3 failed logins / 10 min' },
              { value: '5-failures', label: '5 failed logins / hour' },
              { value: '10-failures', label: '10 failed logins / hour' },
            ]}
          />
        </div>
      </SettingRow>

      <div className="pt-2">
        <InfoNote tone="slate">
          Placeholder notes: geofencing, workstation allow-lists and SIEM forwarding arrive with the authentication service — the
          controls above already write to the change ledger.
        </InfoNote>
      </div>

      <ConfirmModal
        open={rotateOpen}
        tone="warning"
        icon="shield"
        title="Rotate encryption keys"
        message="Issue new data-encryption keys and re-wrap all evidence volumes with the new key set?"
        detail="Existing evidence stays readable (key-wrapping design). Rotation takes ~90 s and briefly pauses new writes. You will be signed out of other sessions."
        confirmLabel="Rotate keys"
        busy={rotating}
        busyLabel="Rotating…"
        onCancel={() => {
          if (!rotating) setRotateOpen(false);
        }}
        onConfirm={() => {
          setRotating(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            setRotating(false);
            setRotateOpen(false);
            setLastRotation('just now · next auto-rotation in 6 days');
            onRotateKeys();
            onNotice('Encryption keys rotated · 14 volumes re-wrapped · other sessions revoked');
          }, 1200);
        }}
      />
    </SectionPanel>
  );
}
