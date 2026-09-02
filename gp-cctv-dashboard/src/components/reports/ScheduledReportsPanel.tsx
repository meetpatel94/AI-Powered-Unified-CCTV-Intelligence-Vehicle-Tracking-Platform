import { CalendarClock, Play, UserRound } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { frequencyLabel, reportTypeById } from '@/data/reportsData';
import type { ScheduledReport } from '@/types/reports';

interface ScheduledReportsPanelProps {
  schedules: ScheduledReport[];
  onToggle: (id: string) => void;
  onRunNow: (schedule: ScheduledReport) => void;
  onAdd: () => void;
}

const th =
  'whitespace-nowrap border-b border-edge bg-panel-head px-2.5 py-2 text-left text-2xs font-semibold uppercase tracking-[0.09em] text-[#8ea1c0]';

function ActiveToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      title={active ? 'Schedule active — click to pause' : 'Schedule paused — click to activate'}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`relative h-[18px] w-[34px] rounded-full border transition-colors ${
        active ? 'border-accent-green/60 bg-accent-green/25' : 'border-edge bg-[#111c30]'
      }`}
    >
      <span
        className={`absolute top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full transition-all duration-200 ${
          active
            ? 'left-[18px] bg-accent-green shadow-[0_0_8px_rgba(34,197,94,0.8)]'
            : 'left-[3px] bg-[#4a5c7d]'
        }`}
      />
    </button>
  );
}

/** SCHEDULED REPORTS · recurring jobs registered on the report engine. */
export function ScheduledReportsPanel({ schedules, onToggle, onRunNow, onAdd }: ScheduledReportsPanelProps) {
  const activeCount = schedules.filter((schedule) => schedule.active).length;

  return (
    <Panel
      title="Scheduled Reports"
      tools={
        <>
          <span className="tnum text-2xs uppercase tracking-[0.1em] text-ink-faint">
            {activeCount} of {schedules.length} active · engine nominal
          </span>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-[4px] border border-accent-cyan/45 bg-accent-cyan/10 px-2 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-[#8ff0ff] transition-colors hover:border-accent-cyan hover:bg-accent-cyan/20"
          >
            <CalendarClock size={12} />
            New Schedule
          </button>
        </>
      }
      bodyClassName="overflow-x-auto"
    >
      <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className={th}>Report Name</th>
            <th className={th}>Frequency</th>
            <th className={th}>Next Run</th>
            <th className={th}>Last Run</th>
            <th className={th}>Recipient / Role</th>
            <th className={th}>Format</th>
            <th className={`${th} text-right`}>Active</th>
            <th className={`${th} text-right`}>Run</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const type = reportTypeById(schedule.type);
            const Icon = type.icon;
            return (
              <tr
                key={schedule.id}
                className={`border-b border-edge-soft transition-colors hover:bg-panel-hover/60 ${
                  schedule.active ? '' : 'opacity-55'
                }`}
              >
                <td className="px-2.5 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[4px] border"
                      style={{ borderColor: `${type.color}40`, backgroundColor: `${type.color}12`, color: type.color }}
                    >
                      <Icon size={12} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{schedule.name}</span>
                      <span className="tnum block font-mono text-3xs text-ink-faint">
                        {schedule.id} · {type.short}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span className="block text-[12px] font-semibold text-[#9fc7ff]">
                    {frequencyLabel[schedule.frequency]}
                  </span>
                  <span className="block text-3xs text-ink-faint">{schedule.cadence}</span>
                </td>
                <td className="tnum whitespace-nowrap px-2.5 py-2 font-mono text-[11.5px]">
                  <span className={schedule.active ? 'text-[#6fe0b0]' : 'text-ink-faint'}>{schedule.nextRun}</span>
                </td>
                <td className="tnum whitespace-nowrap px-2.5 py-2 font-mono text-[11.5px] text-[#9fb0cc]">
                  {schedule.lastRun}
                </td>
                <td className="max-w-[240px] px-2.5 py-2">
                  <span className="flex items-center gap-1.5">
                    <UserRound size={12} className="shrink-0 text-ink-faint" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-[#c3cfe2]">{schedule.recipient}</span>
                      <span className="block text-3xs uppercase tracking-[0.08em] text-ink-faint">
                        {schedule.recipientRole}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span className="rounded-[3px] border border-edge bg-panel-alt px-1.5 py-px font-mono text-3xs font-semibold text-[#9fb0cc]">
                    {schedule.format}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right">
                  <ActiveToggle active={schedule.active} onToggle={() => onToggle(schedule.id)} />
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right">
                  <button
                    type="button"
                    title={schedule.active ? 'Trigger this schedule now' : 'Activate the schedule to run it'}
                    disabled={!schedule.active}
                    onClick={() => onRunNow(schedule)}
                    className="grid h-[26px] w-[26px] place-items-center rounded-[4px] border border-edge text-[#8ea3c4] transition-colors hover:border-accent-green/60 hover:text-[#6fe0b0] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Play size={12} strokeWidth={2.4} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
