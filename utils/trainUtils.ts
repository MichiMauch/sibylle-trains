export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getDelayColor = (delay: number) => {
  if (delay === 0) return 'text-green-400';
  if (delay > 0 && delay <= 3) return 'text-yellow-400';
  return 'text-red-400';
};

export const getDelayText = (delay: number) => {
  if (delay === 0) return 'Pünktlich';
  return `+${delay} Min`;
};

export const getMinutesUntil = (dateString: string) => {
  const now = new Date();
  const departure = new Date(dateString);
  const diffMs = departure.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  return diffMins;
};

export const formatTimeUntilDeparture = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} Min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')} h`;
};

export const getTimeStatus = (minutes: number) => {
  if (minutes < 3) {
    return {
      color: '#DC0018', // SBB Rot
      text: '🚨 Das reicht nicht mehr 🚨',
      textColor: 'white'
    };
  }
  if (minutes < 6) {
    return {
      color: '#FF8C00', // Orange
      text: '🏃‍♂️ Run, Baby, Run 💨',
      textColor: 'white'
    };
  }
  if (minutes < 8) {
    return {
      color: '#F7BA00', // Gelb
      text: '⚡ Jetzt musst du dich aber sputen ⚡',
      textColor: 'black'
    };
  }
  return {
    color: '#2E327B', // SBB Blau
    text: '😌 Das reicht noch locker ✅',
    textColor: 'white'
  };
};
