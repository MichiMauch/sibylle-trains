import SbbClock from '../SbbClock';

interface LoadingScreenProps {
  loading?: boolean;
  error?: string | null;
  hasNoTrains?: boolean;
}

export default function LoadingScreen({ loading, error, hasNoTrains }: LoadingScreenProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#2E327B' }}>
        <div className="text-xl text-red-400">Fehler: {error}</div>
      </div>
    );
  }

  if (hasNoTrains) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#2E327B' }}>
        <div className="text-xl text-white">Keine Züge gefunden</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6" style={{ backgroundColor: '#2E327B' }}>
        <SbbClock size={120} darkBackground={true} fps={30} />
        <div className="text-xl font-medium text-white">
          Lade Abfahrtszeiten...
        </div>
      </div>
    );
  }

  return null;
}
