import { useEffect, useState } from 'react';

import { currentUser as mockUser } from '@/data/mockData';
import { api, type CurrentUserDto } from '@/services/api';

/** Normalised current-user record used by the global profile menu. */
export interface DisplayUser {
  id: string;
  name: string;
  role: string;
  /** Sub-line shown under the name (unit / department / open-mode label). */
  unit: string;
  openMode: boolean;
}

function mapDto(dto: CurrentUserDto): DisplayUser {
  const roleLabel = dto.role ? dto.role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Operator';
  const unit = dto.open_mode
    ? 'Open Access (AUTH disabled)'.concat(dto.role ? ` · ${roleLabel}` : '')
    : (roleLabel || 'Command');
  return {
    id: String(dto.user_id),
    name: dto.full_name || dto.username || 'Operator',
    role: roleLabel,
    unit,
    openMode: Boolean(dto.open_mode),
  };
}

/**
 * Resolve the currently logged-in operator from the existing auth/user state.
 *
 * The backend exposes `/api/auth/me` (and works even in open mode via the
 * implicit principal). When the backend is unreachable we fall back to the
 * existing bundled operator record so the command centre still renders — the
 * same fallback the rest of the dashboard uses.
 */
export function useCurrentUser(): { user: DisplayUser; live: boolean; loading: boolean } {
  const [user, setUser] = useState<DisplayUser>(() => ({
    id: 'local',
    name: mockUser.name,
    role: 'Inspector',
    unit: mockUser.unit,
    openMode: false,
  }));
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getCurrentUser()
      .then((dto) => {
        if (cancelled) return;
        setUser(mapDto(dto));
        setLive(true);
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, live, loading };
}
