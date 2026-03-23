import React from 'react';
import { MatchScoutData, PitScoutData } from '../types';

function ValueRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-700/60 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 text-right">{value ?? 'N/A'}</span>
    </div>
  );
}

export function PitDataSection({ pitData }: { pitData: PitScoutData }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Pit Scouting Data</h3>
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
        <ValueRow label="Team Number" value={pitData.teamNumber} />
        <ValueRow label="Can Climb Tower" value={pitData.canClimbTower ? 'Yes' : 'No'} />
        <ValueRow label="Maximum Climb Level" value={pitData.maxClimbLevel || 'N/A'} />
        <ValueRow label="Fuel Hopper Capacity" value={pitData.fuelHopperCapacity} />
        <ValueRow label="Chassis Width" value={pitData.chassisWidth} />
        <ValueRow label="Chassis Length" value={pitData.chassisLength} />
        <ValueRow label="Drive Train Type" value={pitData.driveTrainType || pitData.driveTrainOther || 'N/A'} />
        <ValueRow label="Drive Motors" value={(pitData.driveMotors || []).join(', ') || 'N/A'} />
        <ValueRow label="Can Drive Over Bump" value={pitData.canDriveOverBump ? 'Yes' : 'No'} />
        <ValueRow label="Can Drive Under Trench" value={pitData.canDriveUnderTrench ? 'Yes' : 'No'} />
        <ValueRow label="Intake Position" value={pitData.intakePosition || 'N/A'} />
        <ValueRow label="Shooter Type" value={pitData.shooterType || 'N/A'} />
        <ValueRow label="Has Turret" value={pitData.hasTurret ? 'Yes' : 'No'} />
        <ValueRow label="Can Play Defense" value={pitData.canPlayDefense ? 'Yes' : 'No'} />
        <ValueRow label="Defense Style" value={pitData.defenseStyle || 'N/A'} />
        <ValueRow label="Looks Good" value={pitData.looksGood || 'N/A'} />
        <ValueRow label="Autonomous Description" value={pitData.autoDescription || 'N/A'} />
        <ValueRow label="Vision Setup" value={pitData.visionSetup || 'N/A'} />
        <ValueRow label="Additional Notes" value={pitData.notes || 'N/A'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          { label: 'Shooter', value: pitData.shooterPhoto },
          { label: 'Intake', value: pitData.intakePhoto },
          { label: 'Hopper', value: pitData.hopperPhoto },
          { label: 'Drivetrain', value: pitData.drivetrainPhoto },
        ]).map((photo) => (
          <div key={photo.label} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-300 mb-2">{photo.label}</p>
            {photo.value ? (
              <img src={photo.value} alt={`${photo.label} photo`} className="w-full h-40 rounded-lg border border-slate-700 object-cover" />
            ) : (
              <p className="text-xs text-slate-500">No photo uploaded</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchDataSection({ records }: { records: MatchScoutData[] }) {
  if (records.length === 0) {
    return <div className="text-sm text-slate-400">No match scouting records for this team.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Match Scouting Data</h3>
      {records
        .slice()
        .sort((a, b) => Number(a.matchNumber || 0) - Number(b.matchNumber || 0))
        .map((match) => (
          <div key={`${match.matchNumber}-${match.teamNumber}`} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <h4 className="font-semibold text-blue-300 mb-2">Match {match.matchNumber}</h4>
            <ValueRow label="Team Number" value={match.teamNumber} />
            <ValueRow label="Alliance Color" value={match.allianceColor || 'N/A'} />
            <ValueRow label="Left Starting Zone" value={match.leftStartingZone ? 'Yes' : 'No'} />
            <ValueRow label="Auto Fuel Scored" value={match.autoFuelScored} />
            <ValueRow label="Auto Climb Attempted" value={match.autoClimbAttempted ? 'Yes' : 'No'} />
            <ValueRow label="Auto Climb Result" value={match.autoClimbResult || 'N/A'} />
            <ValueRow label="Teleop Fuel Scored" value={match.teleopFuelScored} />
            <ValueRow label="Avg BPS" value={match.avgBps} />
            <ValueRow label="Shooting Consistency" value={match.shootingConsistency} />
            <ValueRow label="Intake Consistency" value={match.intakeConsistency} />
            <ValueRow label="Drove Over Bump" value={match.droveOverBump ? 'Yes' : 'No'} />
            <ValueRow label="Drove Under Trench" value={match.droveUnderTrench ? 'Yes' : 'No'} />
            <ValueRow label="Played Defense" value={match.playedDefense ? 'Yes' : 'No'} />
            <ValueRow label="Defense Effectiveness" value={match.defenseEffectiveness ?? 'N/A'} />
            <ValueRow label="Defended Against" value={match.defendedAgainst ? 'Yes' : 'No'} />
            <ValueRow label="Hub Scoring Strategy" value={match.hubScoringStrategy || 'N/A'} />
            <ValueRow label="End Game Climb Result" value={match.endGameClimbResult || 'N/A'} />
            <ValueRow label="Climb Time (seconds)" value={match.climbTimeSeconds || 'N/A'} />
            <ValueRow label="Fouls Caused" value={match.foulsCaused} />
            <ValueRow label="Card Received" value={match.cardReceived || 'N/A'} />
            <ValueRow label="Notes" value={match.notes || 'N/A'} />
          </div>
        ))}
    </div>
  );
}
