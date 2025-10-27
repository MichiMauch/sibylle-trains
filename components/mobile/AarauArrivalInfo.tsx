import { formatTime } from '@/utils/trainUtils';
import PlatformBadge from '../PlatformBadge';

interface AarauArrivalInfoProps {
  aarauArrival?: string;
  aarauPlatform?: string | null;
  aarauPrognosisPlatform?: string | null;
}

export default function AarauArrivalInfo({
  aarauArrival,
  aarauPlatform,
  aarauPrognosisPlatform
}: AarauArrivalInfoProps) {
  if (!aarauArrival) return null;

  return (
    <div className="border-t border-gray-600 pt-4 mb-4">
      <div className="text-sm text-gray-400 mb-2">Ankunft in Aarau</div>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-white">
          {formatTime(aarauArrival)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white text-sm">Gleis</span>
          <PlatformBadge platform={aarauPrognosisPlatform || aarauPlatform} />
        </div>
      </div>
      {aarauPlatform && aarauPrognosisPlatform &&
       aarauPlatform !== aarauPrognosisPlatform && (
        <div className="flex items-center gap-1 mt-2">
          <img
            src="/icons/platform-change.svg"
            alt="Gleisänderung Aarau"
            className="h-5 w-auto"
          />
          <span className="text-xs text-gray-300">Gleisänderung in Aarau</span>
        </div>
      )}
    </div>
  );
}
