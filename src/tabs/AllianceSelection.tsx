import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { getProfileTeams } from '../lib/competitionProfiles';
import { statbotics, StatboticsTeamEvent } from '../lib/statbotics';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { tba } from '../lib/tba';
import { MatchScoutData, PitScoutData, SyncRecord, TBARanking, TBARankings, TBATeam } from '../types';

type AllianceSelectionProps = {
  eventKey: string;
  profileId: string | null;
};

type TeamNoteSummary = {
  pitNote: string | null;
  aiNotes: string[];
  rawMatchNotes: string[];
  noteCount: number;
  driveTrainType: string | null;
  driveTrainOther: string | null;
  driveMotors: string[];
  canDriveOverBump: boolean | null;
  canDriveUnderTrench: boolean | null;
  canClimbTower: boolean | null;
  maxClimbLevel: string | null;
  fuelHopperCapacity: number | null;
  chassisWidth: number | null;
  chassisLength: number | null;
  intakePosition: string | null;
  looksGood: string | null;
  autoDescription: string | null;
  visionSetup: string | null;
  shooterType: string | null;
  hasTurret: boolean | null;
  canPlayDefense: boolean | null;
  defenseStyle: string | null;
};

type AllianceBoardRow = {
  teamNumber: number;
  teamName: string;
  tbaRank: number | null;
  epaTotal: number | null;
  epaAuto: number | null;
  epaTeleop: number | null;
  epaEndgame: number | null;
  notes: TeamNoteSummary;
};

type MatchNoteLine = {
  teamNumber: number;
  text: string;
  updatedAt: number;
};

type PitSnapshot = {
  updatedAt: number;
  note: string | null;
  driveTrainType: string | null;
  driveTrainOther: string | null;
  driveMotors: string[];
  canDriveOverBump: boolean | null;
  canDriveUnderTrench: boolean | null;
  canClimbTower: boolean | null;
  maxClimbLevel: string | null;
  fuelHopperCapacity: number | null;
  chassisWidth: number | null;
  chassisLength: number | null;
  intakePosition: string | null;
  looksGood: string | null;
  autoDescription: string | null;
  visionSetup: string | null;
  shooterType: string | null;
  hasTurret: boolean | null;
  canPlayDefense: boolean | null;
  defenseStyle: string | null;
};

type RankingMode = 'draft' | 'combined_epa' | 'auto_epa' | 'total_epa' | 'tba_rank';
type BooleanFilter = 'any' | 'yes' | 'no';

type PitFilterState = {
  driveTrainType: string;
  driveTrainOther: string;
  driveMotor: string;
  canDriveOverBump: BooleanFilter;
  canDriveUnderTrench: BooleanFilter;
  canClimbTower: BooleanFilter;
  maxClimbLevel: string;
  fuelHopperMin: string;
  fuelHopperMax: string;
  chassisWidthMin: string;
  chassisWidthMax: string;
  chassisLengthMin: string;
  chassisLengthMax: string;
  intakePosition: string;
  looksGood: string;
  autoDescription: string;
  visionSetup: string;
  shooterType: string;
  hasTurret: BooleanFilter;
  canPlayDefense: BooleanFilter;
  defenseStyle: string;
  notes: string;
};

const REFRESH_INTERVAL_MS = 45000;
const BOOLEAN_FILTER_OPTIONS: Array<{ value: BooleanFilter; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const DRIVE_TRAIN_OPTIONS = ['Tank', 'Swerve', 'Mecanum', 'H-Drive', 'Other'];
const DRIVE_MOTOR_OPTIONS = ['Falcon 500 / Kraken X60', 'NEO', 'NEO Vortex', 'CIM', 'MiniCIM', 'Other'];
const CLIMB_LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3'];
const INTAKE_POSITION_OPTIONS = ['Over the bumper', 'Under the bumper', 'Both'];
const SHOOTER_TYPE_OPTIONS = ['Single shooter', 'Multi-shooter'];
const LOOKS_GOOD_OPTIONS = ['Yes', 'No', 'Mid'];
const INITIAL_PIT_FILTERS: PitFilterState = {
  driveTrainType: '',
  driveTrainOther: '',
  driveMotor: '',
  canDriveOverBump: 'any',
  canDriveUnderTrench: 'any',
  canClimbTower: 'any',
  maxClimbLevel: '',
  fuelHopperMin: '',
  fuelHopperMax: '',
  chassisWidthMin: '',
  chassisWidthMax: '',
  chassisLengthMin: '',
  chassisLengthMax: '',
  intakePosition: '',
  looksGood: '',
  autoDescription: '',
  visionSetup: '',
  shooterType: '',
  hasTurret: 'any',
  canPlayDefense: 'any',
  defenseStyle: '',
  notes: '',
};

function normalizeEventKey(value: string): string {
  return value.trim().toLowerCase();
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizePayload(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseTeamKey(teamKey: unknown): number | null {
  if (typeof teamKey !== 'string') {
    return null;
  }

  const match = teamKey.trim().toLowerCase().match(/^frc(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractTeamNumber(row: StatboticsTeamEvent): number | null {
  const parsed = toFiniteNumber(row.team_number ?? row.team);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getPayloadEventKey(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const value = (payload as { eventKey?: unknown }).eventKey;
  return typeof value === 'string' ? normalizeEventKey(value) : '';
}

function matchesBooleanFilter(value: boolean | null, filter: BooleanFilter): boolean {
  if (filter === 'any') {
    return true;
  }

  if (value === null) {
    return false;
  }

  return filter === 'yes' ? value : !value;
}

function containsMatch(value: string | null, needle: string): boolean {
  if (!needle.trim()) {
    return true;
  }

  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(needle.trim().toLowerCase());
}

function equalsMatch(value: string | null, selected: string): boolean {
  if (!selected) {
    return true;
  }

  return value === selected;
}

function withinRange(value: number | null, minText: string, maxText: string): boolean {
  const min = minText.trim() ? Number(minText) : null;
  const max = maxText.trim() ? Number(maxText) : null;

  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
    return true;
  }

  if (min === null && max === null) {
    return true;
  }

  if (value === null) {
    return false;
  }

  if (min !== null && value < min) {
    return false;
  }

  if (max !== null && value > max) {
    return false;
  }

  return true;
}

function calculateNonAutoEpa(row: AllianceBoardRow): number | null {
  const teleop = row.epaTeleop;
  const endgame = row.epaEndgame;

  if (teleop === null && endgame === null) {
    return null;
  }

  return (teleop ?? 0) + (endgame ?? 0);
}

function matchesNonAutoEpaMax(row: AllianceBoardRow, maxText: string): boolean {
  if (!maxText.trim()) {
    return true;
  }

  const max = Number(maxText);
  if (!Number.isFinite(max)) {
    return true;
  }

  const value = calculateNonAutoEpa(row);
  if (value === null) {
    return false;
  }

  return value <= max;
}

function matchesPitFilters(row: AllianceBoardRow, filters: PitFilterState): boolean {
  const notes = row.notes;

  return (
    equalsMatch(notes.driveTrainType, filters.driveTrainType)
    && containsMatch(notes.driveTrainOther, filters.driveTrainOther)
    && (!filters.driveMotor || notes.driveMotors.includes(filters.driveMotor))
    && matchesBooleanFilter(notes.canDriveOverBump, filters.canDriveOverBump)
    && matchesBooleanFilter(notes.canDriveUnderTrench, filters.canDriveUnderTrench)
    && matchesBooleanFilter(notes.canClimbTower, filters.canClimbTower)
    && equalsMatch(notes.maxClimbLevel, filters.maxClimbLevel)
    && withinRange(notes.fuelHopperCapacity, filters.fuelHopperMin, filters.fuelHopperMax)
    && withinRange(notes.chassisWidth, filters.chassisWidthMin, filters.chassisWidthMax)
    && withinRange(notes.chassisLength, filters.chassisLengthMin, filters.chassisLengthMax)
    && equalsMatch(notes.intakePosition, filters.intakePosition)
    && equalsMatch(notes.looksGood, filters.looksGood)
    && containsMatch(notes.autoDescription, filters.autoDescription)
    && containsMatch(notes.visionSetup, filters.visionSetup)
    && equalsMatch(notes.shooterType, filters.shooterType)
    && matchesBooleanFilter(notes.hasTurret, filters.hasTurret)
    && matchesBooleanFilter(notes.canPlayDefense, filters.canPlayDefense)
    && containsMatch(notes.defenseStyle, filters.defenseStyle)
    && containsMatch(notes.pitNote, filters.notes)
  );
}

function buildPickedStorageKey(eventKey: string): string {
  return `allianceSelection:picked:${eventKey}`;
}

function readPickedTeams(key: string): number[] {
  const stored = storage.get<number[]>(key);
  if (!Array.isArray(stored)) {
    return [];
  }

  return Array.from(
    new Set(
      stored
        .map((value) => toFiniteNumber(value))
        .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0),
    ),
  ).sort((a, b) => a - b);
}

function summarizeMatchNoteLines(lines: MatchNoteLine[]): { aiNotes: Map<number, string[]>; rawNotes: Map<number, string[]> } {
  const grouped = new Map<number, MatchNoteLine[]>();

  lines.forEach((line) => {
    const existing = grouped.get(line.teamNumber) || [];
    existing.push(line);
    grouped.set(line.teamNumber, existing);
  });

  const aiSummary = new Map<number, string[]>();
  const rawSummary = new Map<number, string[]>();

  grouped.forEach((items, teamNumber) => {
    const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    const unique = new Set<string>();
    const dedupedNotes = sorted
      .map((item) => item.text)
      .filter((text) => {
        if (unique.has(text)) {
          return false;
        }
        unique.add(text);
        return true;
      });

    aiSummary.set(teamNumber, dedupedNotes.slice(0, 3));
    rawSummary.set(teamNumber, sorted.map((item) => item.text));
  });

  return {
    aiNotes: aiSummary,
    rawNotes: rawSummary,
  };
}

async function buildTeamNoteSummaryMap(eventKey: string, profileId: string | null): Promise<Map<number, TeamNoteSummary>> {
  const normalizedEventKey = normalizeEventKey(eventKey);

  const pitByTeam = new Map<number, PitSnapshot>();
  const matchLines: MatchNoteLine[] = [];

  const localPitPrefix = profileId ? `pitScout:${profileId}:` : 'pitScout:';

  const localPitRecords = storage
    .getAllKeys()
    .filter((key) => key.startsWith(localPitPrefix))
    .map((key) => storage.get<SyncRecord<PitScoutData>>(key))
    .filter((record): record is SyncRecord<PitScoutData> => Boolean(record));

  localPitRecords.forEach((record) => {
    const payload = record.data;
    const payloadEventKey = getPayloadEventKey(payload);
    if (payloadEventKey && payloadEventKey !== normalizedEventKey) {
      return;
    }

    const teamNumber = toFiniteNumber(payload?.teamNumber);
    if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
      return;
    }

    const note = normalizeText(payload?.notes) || null;
    const driveTrainType = normalizeText(payload?.driveTrainType) || null;
    const driveTrainOther = normalizeText(payload?.driveTrainOther) || null;
    const driveMotors = normalizeStringArray(payload?.driveMotors);
    const canDriveOverBump = typeof payload?.canDriveOverBump === 'boolean' ? payload.canDriveOverBump : null;
    const autoDescription = normalizeText(payload?.autoDescription) || null;
    const visionSetup = normalizeText(payload?.visionSetup) || null;
    const shooterType = normalizeText(payload?.shooterType) || null;
    const hasTurret = typeof payload?.hasTurret === 'boolean' ? payload.hasTurret : null;
    const canPlayDefense = typeof payload?.canPlayDefense === 'boolean' ? payload.canPlayDefense : null;
    const defenseStyle = normalizeText(payload?.defenseStyle) || null;
    const canDriveUnderTrench = typeof payload?.canDriveUnderTrench === 'boolean' ? payload.canDriveUnderTrench : null;
    const canClimbTower = typeof payload?.canClimbTower === 'boolean' ? payload.canClimbTower : null;
    const maxClimbLevel = normalizeText(payload?.maxClimbLevel) || null;
    const fuelHopperCapacity = toFiniteNumber(payload?.fuelHopperCapacity);
    const chassisWidth = toFiniteNumber(payload?.chassisWidth);
    const chassisLength = toFiniteNumber(payload?.chassisLength);
    const intakePosition = normalizeText(payload?.intakePosition) || null;
    const looksGood = normalizeText(payload?.looksGood) || null;
    const existing = pitByTeam.get(teamNumber);
    if (!existing || record.timestamp >= existing.updatedAt) {
      pitByTeam.set(teamNumber, {
        updatedAt: record.timestamp,
        note,
        driveTrainType,
        driveTrainOther,
        driveMotors,
        canDriveOverBump,
        canDriveUnderTrench,
        canClimbTower,
        maxClimbLevel,
        fuelHopperCapacity,
        chassisWidth,
        chassisLength,
        intakePosition,
        looksGood,
        autoDescription,
        visionSetup,
        shooterType,
        hasTurret,
        canPlayDefense,
        defenseStyle,
      });
    }
  });

  const localMatchRecords = storage
    .getAllKeys()
    .filter((key) => key.startsWith('matchScout:'))
    .map((key) => storage.get<SyncRecord<MatchScoutData>>(key))
    .filter((record): record is SyncRecord<MatchScoutData> => Boolean(record));

  localMatchRecords.forEach((record) => {
    const payload = record.data;
    if (getPayloadEventKey(payload) !== normalizedEventKey) {
      return;
    }

    const teamNumber = toFiniteNumber(payload?.teamNumber);
    if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
      return;
    }

    const lines = [
      normalizeText(payload?.autonNotes) ? `Auto: ${normalizeText(payload?.autonNotes)}` : '',
      normalizeText(payload?.defenseNotes) ? `Defense: ${normalizeText(payload?.defenseNotes)}` : '',
      normalizeText(payload?.notes),
    ].filter((line) => line.length > 0);

    lines.forEach((text) => {
      matchLines.push({
        teamNumber,
        text,
        updatedAt: record.timestamp,
      });
    });
  });

  const [remotePitResult, remoteMatchResult] = await Promise.all([
    supabase
      .from('pit_scouts')
      .select('team_number, event_key, data, updated_at')
      .eq('event_key', normalizedEventKey),
    supabase
      .from('match_scouts')
      .select('team_number, event_key, data, updated_at')
      .eq('event_key', normalizedEventKey),
  ]);

  if (!remotePitResult.error) {
    (remotePitResult.data || []).forEach((row: any) => {
      const payload = normalizePayload(row.data) as Partial<PitScoutData>;
      const teamNumber = toFiniteNumber(row.team_number ?? payload?.teamNumber);
      if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
        return;
      }

      const note = normalizeText(payload?.notes) || null;
      const driveTrainType = normalizeText(payload?.driveTrainType) || null;
      const driveTrainOther = normalizeText(payload?.driveTrainOther) || null;
      const driveMotors = normalizeStringArray(payload?.driveMotors);
      const canDriveOverBump = typeof payload?.canDriveOverBump === 'boolean' ? payload.canDriveOverBump : null;
      const autoDescription = normalizeText(payload?.autoDescription) || null;
      const visionSetup = normalizeText(payload?.visionSetup) || null;
      const shooterType = normalizeText(payload?.shooterType) || null;
      const hasTurret = typeof payload?.hasTurret === 'boolean' ? payload.hasTurret : null;
      const canPlayDefense = typeof payload?.canPlayDefense === 'boolean' ? payload.canPlayDefense : null;
      const defenseStyle = normalizeText(payload?.defenseStyle) || null;
      const canDriveUnderTrench = typeof payload?.canDriveUnderTrench === 'boolean' ? payload.canDriveUnderTrench : null;
      const canClimbTower = typeof payload?.canClimbTower === 'boolean' ? payload.canClimbTower : null;
      const maxClimbLevel = normalizeText(payload?.maxClimbLevel) || null;
      const fuelHopperCapacity = toFiniteNumber(payload?.fuelHopperCapacity);
      const chassisWidth = toFiniteNumber(payload?.chassisWidth);
      const chassisLength = toFiniteNumber(payload?.chassisLength);
      const intakePosition = normalizeText(payload?.intakePosition) || null;
      const looksGood = normalizeText(payload?.looksGood) || null;
      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const existing = pitByTeam.get(teamNumber);
      if (!existing || updatedAt >= existing.updatedAt) {
        pitByTeam.set(teamNumber, {
          updatedAt,
          note,
          driveTrainType,
          driveTrainOther,
          driveMotors,
          canDriveOverBump,
          canDriveUnderTrench,
          canClimbTower,
          maxClimbLevel,
          fuelHopperCapacity,
          chassisWidth,
          chassisLength,
          intakePosition,
          looksGood,
          autoDescription,
          visionSetup,
          shooterType,
          hasTurret,
          canPlayDefense,
          defenseStyle,
        });
      }
    });
  }

  if (!remoteMatchResult.error) {
    (remoteMatchResult.data || []).forEach((row: any) => {
      const payload = normalizePayload(row.data) as Partial<MatchScoutData>;
      if (getPayloadEventKey(payload) !== normalizedEventKey) {
        return;
      }

      const teamNumber = toFiniteNumber(row.team_number ?? payload?.teamNumber);
      if (!teamNumber || !Number.isInteger(teamNumber) || teamNumber <= 0) {
        return;
      }

      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const lines = [
        normalizeText(payload?.autonNotes) ? `Auto: ${normalizeText(payload?.autonNotes)}` : '',
        normalizeText(payload?.defenseNotes) ? `Defense: ${normalizeText(payload?.defenseNotes)}` : '',
        normalizeText(payload?.notes),
      ].filter((line) => line.length > 0);

      lines.forEach((text) => {
        matchLines.push({
          teamNumber,
          text,
          updatedAt,
        });
      });
    });
  }

  const { aiNotes, rawNotes } = summarizeMatchNoteLines(matchLines);
  const teamNumbers = new Set<number>([
    ...Array.from(pitByTeam.keys()),
    ...Array.from(aiNotes.keys()),
    ...Array.from(rawNotes.keys()),
  ]);

  const summary = new Map<number, TeamNoteSummary>();

  teamNumbers.forEach((teamNumber) => {
    const pit = pitByTeam.get(teamNumber);
    const summarizedNotes = aiNotes.get(teamNumber) || [];
    const allMatchNotes = rawNotes.get(teamNumber) || [];
    summary.set(teamNumber, {
      pitNote: pit?.note || null,
      aiNotes: summarizedNotes,
      rawMatchNotes: allMatchNotes,
      noteCount: (pit?.note ? 1 : 0) + allMatchNotes.length,
      driveTrainType: pit?.driveTrainType || null,
      driveTrainOther: pit?.driveTrainOther || null,
      driveMotors: pit?.driveMotors || [],
      canDriveOverBump: pit?.canDriveOverBump ?? null,
      canDriveUnderTrench: pit?.canDriveUnderTrench ?? null,
      canClimbTower: pit?.canClimbTower ?? null,
      maxClimbLevel: pit?.maxClimbLevel || null,
      fuelHopperCapacity: pit?.fuelHopperCapacity ?? null,
      chassisWidth: pit?.chassisWidth ?? null,
      chassisLength: pit?.chassisLength ?? null,
      intakePosition: pit?.intakePosition || null,
      looksGood: pit?.looksGood || null,
      autoDescription: pit?.autoDescription || null,
      visionSetup: pit?.visionSetup || null,
      shooterType: pit?.shooterType || null,
      hasTurret: pit?.hasTurret ?? null,
      canPlayDefense: pit?.canPlayDefense ?? null,
      defenseStyle: pit?.defenseStyle || null,
    });
  });

  return summary;
}

function buildRankMap(payload: TBARankings | null): Map<number, number> {
  const rankMap = new Map<number, number>();

  const rankings = Array.isArray(payload?.rankings) ? payload.rankings : [];
  rankings.forEach((ranking: TBARanking) => {
    const teamNumber = parseTeamKey(ranking.team_key);
    const rank = toFiniteNumber(ranking.rank);
    if (!teamNumber || !rank || !Number.isInteger(rank) || rank <= 0) {
      return;
    }

    rankMap.set(teamNumber, rank);
  });

  return rankMap;
}

function compareByDraftValue(a: AllianceBoardRow, b: AllianceBoardRow): number {
  const aEpa = a.epaTotal;
  const bEpa = b.epaTotal;

  if (aEpa !== null && bEpa !== null && aEpa !== bEpa) {
    return bEpa - aEpa;
  }

  if (aEpa !== null && bEpa === null) {
    return -1;
  }

  if (aEpa === null && bEpa !== null) {
    return 1;
  }

  if (a.tbaRank !== null && b.tbaRank !== null && a.tbaRank !== b.tbaRank) {
    return a.tbaRank - b.tbaRank;
  }

  if (a.tbaRank !== null && b.tbaRank === null) {
    return -1;
  }

  if (a.tbaRank === null && b.tbaRank !== null) {
    return 1;
  }

  return a.teamNumber - b.teamNumber;
}

function getValueOrFallback(value: number | null, fallback: number): number {
  return value === null ? fallback : value;
}

function compareByRankingMode(a: AllianceBoardRow, b: AllianceBoardRow, rankingMode: RankingMode): number {
  if (rankingMode === 'combined_epa') {
    const aCombined = getValueOrFallback(a.epaTotal, -1) + getValueOrFallback(a.epaAuto, -1);
    const bCombined = getValueOrFallback(b.epaTotal, -1) + getValueOrFallback(b.epaAuto, -1);
    if (aCombined !== bCombined) {
      return bCombined - aCombined;
    }
  }

  if (rankingMode === 'auto_epa') {
    const aAuto = getValueOrFallback(a.epaAuto, -1);
    const bAuto = getValueOrFallback(b.epaAuto, -1);
    if (aAuto !== bAuto) {
      return bAuto - aAuto;
    }
  }

  if (rankingMode === 'total_epa') {
    const aTotal = getValueOrFallback(a.epaTotal, -1);
    const bTotal = getValueOrFallback(b.epaTotal, -1);
    if (aTotal !== bTotal) {
      return bTotal - aTotal;
    }
  }

  if (rankingMode === 'tba_rank') {
    const aRank = a.tbaRank ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.tbaRank ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
  }

  return compareByDraftValue(a, b);
}

function formatEpa(value: number | null): string {
  return value === null ? '--' : value.toFixed(1);
}

export function AllianceSelection({ eventKey, profileId }: AllianceSelectionProps) {
  const normalizedEventKey = useMemo(() => normalizeEventKey(eventKey), [eventKey]);
  const pickedStorageKey = useMemo(() => (normalizedEventKey ? buildPickedStorageKey(normalizedEventKey) : ''), [normalizedEventKey]);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rows, setRows] = useState<AllianceBoardRow[]>([]);
  const [pickedTeamNumbers, setPickedTeamNumbers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [rankingMode, setRankingMode] = useState<RankingMode>('draft');
  const [expandedRawNotesTeams, setExpandedRawNotesTeams] = useState<Set<number>>(new Set());
  const [pitFilters, setPitFilters] = useState<PitFilterState>(INITIAL_PIT_FILTERS);
  const [nonAutoEpaMax, setNonAutoEpaMax] = useState('');

  useEffect(() => {
    if (!pickedStorageKey) {
      setPickedTeamNumbers([]);
      return;
    }

    setPickedTeamNumbers(readPickedTeams(pickedStorageKey));
  }, [pickedStorageKey]);

  useEffect(() => {
    if (!pickedStorageKey) {
      return;
    }

    const deduped = Array.from(new Set<number>(pickedTeamNumbers)).sort((a, b) => a - b);
    storage.set<number[]>(pickedStorageKey, deduped);
  }, [pickedStorageKey, pickedTeamNumbers]);

  useEffect(() => {
    if (!pickedStorageKey) {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== pickedStorageKey) {
        return;
      }
      setPickedTeamNumbers(readPickedTeams(pickedStorageKey));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [pickedStorageKey]);

  useEffect(() => {
    if (!normalizedEventKey) {
      setRows([]);
      setError('Select an event profile in Home to use alliance selection.');
      return;
    }

    let cancelled = false;

    const loadBoard = async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const [rankingsResult, statboticsResult, teamsResult, notesMap] = await Promise.all([
          tba.fetchRankings(normalizedEventKey),
          statbotics.fetchEventTeams(normalizedEventKey),
          tba.fetchTeams(normalizedEventKey),
          buildTeamNoteSummaryMap(normalizedEventKey, profileId),
        ]);

        const rankMap = buildRankMap(rankingsResult);

        const teamNameMap = new Map<number, string>();
        const assignTeamNames = (teams: TBATeam[]) => {
          teams.forEach((team) => {
            if (!Number.isInteger(team.team_number) || team.team_number <= 0) {
              return;
            }

            teamNameMap.set(
              team.team_number,
              team.nickname || team.name || `Team ${team.team_number}`,
            );
          });
        };

        if (Array.isArray(teamsResult)) {
          assignTeamNames(teamsResult);
        }

        if (profileId) {
          assignTeamNames(getProfileTeams(profileId));
        }

        const statMap = new Map<number, StatboticsTeamEvent>();
        if (Array.isArray(statboticsResult)) {
          statboticsResult.forEach((row) => {
            const teamNumber = extractTeamNumber(row);
            if (!teamNumber) {
              return;
            }
            statMap.set(teamNumber, row);

            if (!teamNameMap.has(teamNumber)) {
              const fallbackName = typeof row.team_name === 'string' && row.team_name.trim()
                ? row.team_name.trim()
                : `Team ${teamNumber}`;
              teamNameMap.set(teamNumber, fallbackName);
            }
          });
        }

        const allTeamNumbers = new Set<number>([
          ...Array.from(teamNameMap.keys()),
          ...Array.from(rankMap.keys()),
          ...Array.from(statMap.keys()),
          ...Array.from(notesMap.keys()),
        ]);

        const nextRows = Array.from(allTeamNumbers)
          .map((teamNumber) => {
            const statRow = statMap.get(teamNumber) || null;
            const notes = notesMap.get(teamNumber) || {
              pitNote: null,
              aiNotes: [],
              rawMatchNotes: [],
              noteCount: 0,
              driveTrainType: null,
              driveTrainOther: null,
              driveMotors: [],
              canDriveOverBump: null,
              canDriveUnderTrench: null,
              canClimbTower: null,
              maxClimbLevel: null,
              fuelHopperCapacity: null,
              chassisWidth: null,
              chassisLength: null,
              intakePosition: null,
              looksGood: null,
              autoDescription: null,
              visionSetup: null,
              shooterType: null,
              hasTurret: null,
              canPlayDefense: null,
              defenseStyle: null,
            };

            return {
              teamNumber,
              teamName: teamNameMap.get(teamNumber) || `Team ${teamNumber}`,
              tbaRank: rankMap.get(teamNumber) ?? null,
              epaTotal: statRow ? toFiniteNumber(statRow.epa?.total_points ?? statRow.norm_epa) : null,
              epaAuto: statRow ? toFiniteNumber(statRow.epa?.auto_points) : null,
              epaTeleop: statRow ? toFiniteNumber(statRow.epa?.teleop_points) : null,
              epaEndgame: statRow ? toFiniteNumber(statRow.epa?.endgame_points) : null,
              notes,
            } as AllianceBoardRow;
          })
          .sort(compareByDraftValue);

        if (!cancelled) {
          setRows(nextRows);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([]);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load alliance board data.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void loadBoard(refreshToken > 0);

    const refresh = () => {
      void loadBoard(true);
    };

    const onStorageChange = (event: Event) => {
      const storageEvent = event as StorageEvent;
      const changedKey = storageEvent.key;

      if (!changedKey) {
        refresh();
        return;
      }

      if (
        changedKey === pickedStorageKey
        || changedKey.startsWith('matchScout:')
        || changedKey.startsWith('pitScout:')
      ) {
        refresh();
      }
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('sync-success', refresh);
    window.addEventListener('team-import-success', refresh);
    window.addEventListener('storage', onStorageChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('sync-success', refresh);
      window.removeEventListener('team-import-success', refresh);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [normalizedEventKey, pickedStorageKey, profileId, refreshToken]);

  const pickedSet = useMemo(() => new Set(pickedTeamNumbers), [pickedTeamNumbers]);

  const availableRows = useMemo(() => {
    return rows
      .filter((row) => !pickedSet.has(row.teamNumber))
      .filter((row) => matchesPitFilters(row, pitFilters))
      .filter((row) => matchesNonAutoEpaMax(row, nonAutoEpaMax))
      .sort((a, b) => compareByRankingMode(a, b, rankingMode));
  }, [nonAutoEpaMax, pickedSet, pitFilters, rankingMode, rows]);

  const pickedRows = useMemo(() => {
    return rows
      .filter((row) => pickedSet.has(row.teamNumber))
      .sort((a, b) => compareByRankingMode(a, b, rankingMode));
  }, [pickedSet, rankingMode, rows]);

  const topAvailable = availableRows[0] || null;

  const markPicked = (teamNumber: number) => {
    setPickedTeamNumbers((previous) => {
      if (previous.includes(teamNumber)) {
        return previous;
      }
      return [...previous, teamNumber].sort((a, b) => a - b);
    });
  };

  const unmarkPicked = (teamNumber: number) => {
    setPickedTeamNumbers((previous) => previous.filter((value) => value !== teamNumber));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Alliance Selection Board</h2>
            <p className="text-sm text-slate-400 mt-1">
              Best remaining teams are ranked by event EPA. TBA rank is shown for context.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Event: <span className="font-mono uppercase">{normalizedEventKey || 'N/A'}</span>
            </p>
          </div>

          <button
            onClick={() => {
              setRefreshToken((previous) => previous + 1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Available</p>
            <p className="text-2xl font-mono text-white">{availableRows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Picked</p>
            <p className="text-2xl font-mono text-white">{pickedRows.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-900/20 px-4 py-3">
            <p className="text-xs text-emerald-200 uppercase tracking-wide">Top Remaining</p>
            <p className="text-lg font-mono text-emerald-100">
              {topAvailable ? topAvailable.teamNumber : '--'}
            </p>
            <p className="text-xs text-emerald-200/80 truncate">
              {topAvailable ? `${topAvailable.teamName} (${formatEpa(topAvailable.epaTotal)} EPA)` : 'No teams remaining'}
            </p>
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3" open>
          <summary className="cursor-pointer text-sm font-medium text-slate-200">
            Pit Scouting Filters (for 3rd-pick screening)
          </summary>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Drive Train Type</span>
              <select
                value={pitFilters.driveTrainType}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, driveTrainType: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Any</option>
                {DRIVE_TRAIN_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Drive Train Other (contains)</span>
              <input
                type="text"
                value={pitFilters.driveTrainOther}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, driveTrainOther: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Drive Motor Includes</span>
              <select
                value={pitFilters.driveMotor}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, driveMotor: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Any</option>
                {DRIVE_MOTOR_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Can Drive Over Bump</span>
              <select
                value={pitFilters.canDriveOverBump}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, canDriveOverBump: event.target.value as BooleanFilter }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                {BOOLEAN_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Can Drive Under Trench</span>
              <select
                value={pitFilters.canDriveUnderTrench}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, canDriveUnderTrench: event.target.value as BooleanFilter }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                {BOOLEAN_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Can Climb Tower</span>
              <select
                value={pitFilters.canClimbTower}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, canClimbTower: event.target.value as BooleanFilter }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                {BOOLEAN_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Maximum Climb Level</span>
              <select
                value={pitFilters.maxClimbLevel}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, maxClimbLevel: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Any</option>
                {CLIMB_LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Fuel Hopper Min</span>
              <input
                type="number"
                value={pitFilters.fuelHopperMin}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, fuelHopperMin: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Fuel Hopper Max</span>
              <input
                type="number"
                value={pitFilters.fuelHopperMax}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, fuelHopperMax: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Chassis Width Min (in)</span>
              <input
                type="number"
                value={pitFilters.chassisWidthMin}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, chassisWidthMin: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Chassis Width Max (in)</span>
              <input
                type="number"
                value={pitFilters.chassisWidthMax}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, chassisWidthMax: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Chassis Length Min (in)</span>
              <input
                type="number"
                value={pitFilters.chassisLengthMin}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, chassisLengthMin: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Chassis Length Max (in)</span>
              <input
                type="number"
                value={pitFilters.chassisLengthMax}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, chassisLengthMax: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Intake Position</span>
              <select
                value={pitFilters.intakePosition}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, intakePosition: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Any</option>
                {INTAKE_POSITION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Shooter Type</span>
              <select
                value={pitFilters.shooterType}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, shooterType: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Any</option>
                {SHOOTER_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Has Turret</span>
              <select
                value={pitFilters.hasTurret}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, hasTurret: event.target.value as BooleanFilter }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                {BOOLEAN_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Can Play Defense</span>
              <select
                value={pitFilters.canPlayDefense}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, canPlayDefense: event.target.value as BooleanFilter }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                {BOOLEAN_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Looks Good</span>
              <select
                value={pitFilters.looksGood}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, looksGood: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Any</option>
                {LOOKS_GOOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Autonomous Description (contains)</span>
              <input
                type="text"
                value={pitFilters.autoDescription}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, autoDescription: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Vision Setup (contains)</span>
              <input
                type="text"
                value={pitFilters.visionSetup}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, visionSetup: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Defense Style (contains)</span>
              <input
                type="text"
                value={pitFilters.defenseStyle}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, defenseStyle: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-400">Pit Additional Notes (contains)</span>
              <input
                type="text"
                value={pitFilters.notes}
                onChange={(event) => setPitFilters((previous) => ({ ...previous, notes: event.target.value }))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Showing {availableRows.length} available teams after filters.
            </p>
            <button
              type="button"
              onClick={() => setPitFilters(INITIAL_PIT_FILTERS)}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              Clear Pit Filters
            </button>
          </div>
        </details>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-8 flex items-center gap-3 text-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading rankings, EPA, and scouting notes...
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 text-rose-200">
          {error}
        </div>
      )}

      {!isLoading && !error && availableRows.length === 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          No available teams found. If the draft is complete, use the picked list below to restore teams as needed.
        </div>
      )}

      {!isLoading && !error && availableRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3">
            <p className="text-sm text-slate-300">Ranking mode</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Non-Auto EPA Max
                <input
                  type="number"
                  value={nonAutoEpaMax}
                  onChange={(event) => setNonAutoEpaMax(event.target.value)}
                  placeholder="Any"
                  className="w-28 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>
              <select
                value={rankingMode}
                onChange={(event) => setRankingMode(event.target.value as RankingMode)}
                className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="draft">Draft Value</option>
                <option value="combined_epa">Combined EPA (Total + Auto)</option>
                <option value="total_epa">Total EPA</option>
                <option value="auto_epa">Auto EPA</option>
                <option value="tba_rank">TBA Rank</option>
              </select>
            </div>
          </div>

          {availableRows.map((row, index) => {
            const hasMatchNotes = row.notes.aiNotes.length > 0;
            const hasPitNote = Boolean(row.notes.pitNote);
            const hasRawMatchNotes = row.notes.rawMatchNotes.length > 0;
            const showRawNotes = expandedRawNotesTeams.has(row.teamNumber);

            return (
              <div
                key={row.teamNumber}
                className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 shadow-lg"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-600/20 px-2 py-1 text-xs font-semibold text-emerald-200">
                        Remaining #{index + 1}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                        TBA #{row.tbaRank ?? '--'}
                      </span>
                    </div>

                    <p className="mt-2 text-xl font-mono text-white">{row.teamNumber}</p>
                    <p className="text-sm text-slate-300">{row.teamName}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[260px]">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">EPA Total</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaTotal)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Auto</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaAuto)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Teleop</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaTeleop)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Endgame</p>
                      <p className="text-lg font-mono text-white">{formatEpa(row.epaEndgame)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Drive Type</p>
                    <p className="text-sm font-semibold text-white">{row.notes.driveTrainType || '--'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Under Trench</p>
                    <p className="text-sm font-semibold text-white">
                      {row.notes.canDriveUnderTrench === null
                        ? '--'
                        : row.notes.canDriveUnderTrench
                          ? 'Yes'
                          : 'No'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Autonomous</p>
                    <p className="text-sm text-slate-200 line-clamp-2">{row.notes.autoDescription || 'No pit auton details.'}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Scouting Notes ({row.notes.noteCount})</p>

                  {hasPitNote && (
                    <p className="mt-2 text-sm text-slate-200">
                      <span className="text-slate-400">Pit:</span> {row.notes.pitNote}
                    </p>
                  )}

                  {hasMatchNotes && (
                    <div className="mt-2 space-y-1">
                      {row.notes.aiNotes.map((note, noteIndex) => (
                        <p key={`${row.teamNumber}-match-note-${noteIndex}`} className="text-sm text-slate-200">
                          <span className="text-slate-400">Match:</span> {note}
                        </p>
                      ))}
                    </div>
                  )}

                  {!hasPitNote && !hasMatchNotes && (
                    <p className="mt-2 text-sm text-slate-500">No scouting notes recorded yet.</p>
                  )}

                  {hasRawMatchNotes && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedRawNotesTeams((previous) => {
                          const next = new Set(previous);
                          if (next.has(row.teamNumber)) {
                            next.delete(row.teamNumber);
                          } else {
                            next.add(row.teamNumber);
                          }
                          return next;
                        });
                      }}
                      className="mt-3 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      {showRawNotes ? 'Hide Raw Match Notes' : 'Expand Raw Match Notes'}
                    </button>
                  )}

                  {showRawNotes && hasRawMatchNotes && (
                    <div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
                      {row.notes.rawMatchNotes.map((note, noteIndex) => (
                        <p key={`${row.teamNumber}-raw-note-${noteIndex}`} className="text-sm text-slate-300">
                          <span className="text-slate-500">Raw:</span> {note}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => markPicked(row.teamNumber)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Picked
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !error && pickedRows.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="text-lg font-semibold text-white">Picked Teams</h3>
          <p className="text-xs text-slate-400">Picked teams are removed from the live remaining board.</p>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {pickedRows.map((row) => (
              <div key={`picked-${row.teamNumber}`} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-mono text-white">{row.teamNumber} - {row.teamName}</p>
                    <p className="text-xs text-slate-400">
                      EPA {formatEpa(row.epaTotal)} | TBA #{row.tbaRank ?? '--'}
                    </p>
                  </div>

                  <button
                    onClick={() => unmarkPicked(row.teamNumber)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
