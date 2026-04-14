import React, { useMemo, useState } from 'react';
import { FieldHeatmap } from '../../../components/FieldHeatmap';
import {
  AUTON_FIELD_HEIGHT,
  AUTON_FIELD_OVERLAY_SRC,
  AUTON_FIELD_WIDTH,
  STRIP_ORDER,
} from '../constants';
import { StripKey, StripSummary, TeamDisplay } from '../types';
import { AutonPathOverlayMap, STRIP_PATH_COLORS } from './AutonPathOverlayMap';
import { SectionCard } from './RawDataPrimitives';

type AutonTendenciesSectionProps = {
  selectedTeamDisplay: TeamDisplay;
  stripSummaries: StripSummary[];
};

export const AutonTendenciesSection = React.memo(function AutonTendenciesSection({
  selectedTeamDisplay,
  stripSummaries,
}: AutonTendenciesSectionProps) {
  const [visibleStrips, setVisibleStrips] = useState<Record<StripKey, boolean>>({
    top: true,
    middle: true,
    bottom: true,
  });

  const stripRunCounts = useMemo(() => {
    return stripSummaries.reduce(
      (counts, summary) => {
        counts[summary.key] = summary.runCount;
        return counts;
      },
      { top: 0, middle: 0, bottom: 0 } as Record<StripKey, number>,
    );
  }, [stripSummaries]);

  const selectedStripSummaries = useMemo(() => {
    return stripSummaries.filter((summary) => visibleStrips[summary.key]);
  }, [stripSummaries, visibleStrips]);

  const overlayRuns = useMemo(() => {
    return selectedStripSummaries.flatMap((summary) => {
      return summary.pathRuns.map((run) => ({
        key: `${summary.key}:${run.key}:${run.matchNumber}`,
        strip: summary.key,
        trajectory: run.trajectory,
      }));
    });
  }, [selectedStripSummaries]);

  const selectedRunCount = useMemo(() => {
    return selectedStripSummaries.reduce((total, summary) => total + summary.runCount, 0);
  }, [selectedStripSummaries]);

  const toggleStrip = (strip: StripKey) => {
    setVisibleStrips((current) => {
      const enabledCount = Object.values(current).filter(Boolean).length;
      if (current[strip] && enabledCount === 1) {
        return current;
      }

      return {
        ...current,
        [strip]: !current[strip],
      };
    });
  };

  return (
    <SectionCard title="Autonomous Tendencies (Overlaid)">
      <p className="text-xs text-slate-400">
        Every recorded path is drawn directly so outliers stay visible. Areas with many runs naturally darken from overlap.
        Toggle top, middle, and bottom strips to compare one, two, or all three lanes on the same map.
      </p>

      <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100">Shared Path Overlay Map</p>
          <p className="text-xs text-slate-400">
            Team {selectedTeamDisplay.teamNumber} | Runs shown: {selectedRunCount}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STRIP_ORDER.map((stripConfig) => {
            const active = visibleStrips[stripConfig.key];
            return (
              <button
                key={stripConfig.key}
                type="button"
                onClick={() => toggleStrip(stripConfig.key)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  active
                    ? 'text-slate-100 bg-slate-800/90'
                    : 'text-slate-400 border-slate-700 bg-slate-900/60 hover:bg-slate-800/80'
                }`}
                style={
                  active
                    ? {
                        borderColor: STRIP_PATH_COLORS[stripConfig.key],
                        boxShadow: `inset 0 0 0 1px ${STRIP_PATH_COLORS[stripConfig.key]}40`,
                      }
                    : undefined
                }
              >
                {stripConfig.label} ({stripRunCounts[stripConfig.key]})
              </button>
            );
          })}
        </div>

        <AutonPathOverlayMap
          runs={overlayRuns}
          width={AUTON_FIELD_WIDTH}
          height={AUTON_FIELD_HEIGHT}
          overlaySrc={AUTON_FIELD_OVERLAY_SRC}
          showHorizontalThirds
          emptyMessage="No autonomous paths captured for the selected strip filters yet."
        />

        {Object.values(visibleStrips).filter(Boolean).length === 1 && (
          <p className="text-xs text-slate-500">
            At least one strip stays enabled so the shared map always has context.
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {stripSummaries.map((summary) => (
          <div key={`${summary.key}-heat`} className="rounded-xl border border-slate-700 bg-slate-950/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">{summary.label} Raw Shot Map</p>
              <p className="text-xs text-slate-400">Shots: {summary.totalShots}</p>
            </div>

            <FieldHeatmap
              points={summary.shotPoints}
              totalShots={summary.totalShots}
              width={AUTON_FIELD_WIDTH}
              height={AUTON_FIELD_HEIGHT}
              overlaySrc={AUTON_FIELD_OVERLAY_SRC}
              color="#f43f5e"
              showHorizontalThirds
              emptyMessage="No autonomous shots captured from this start strip yet."
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
});

AutonTendenciesSection.displayName = 'AutonTendenciesSection';
