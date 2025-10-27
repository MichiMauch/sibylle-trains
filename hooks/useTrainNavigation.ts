import { useState, useRef, useCallback } from 'react';

export function useTrainNavigation(journeysCount: number) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleNextTrain = useCallback(() => {
    if (isAnimating) return;

    const nextIndex = currentIndex >= journeysCount - 1 ? 0 : currentIndex + 1;

    setPreviousIndex(currentIndex);
    setSlideDirection('left');

    // Small delay to ensure previous card is rendered before starting animation
    setTimeout(() => {
      setIsAnimating(true);
      setCurrentIndex(nextIndex);

      // Clean up after animation
      setTimeout(() => {
        setIsAnimating(false);
        setPreviousIndex(null);
        setSlideDirection(null);
      }, 300);
    }, 10);
  }, [isAnimating, currentIndex, journeysCount]);

  const handlePreviousTrain = useCallback(() => {
    if (isAnimating) return;

    const prevIndex = currentIndex <= 0 ? journeysCount - 1 : currentIndex - 1;

    setPreviousIndex(currentIndex);
    setSlideDirection('right');

    // Small delay to ensure previous card is rendered before starting animation
    setTimeout(() => {
      setIsAnimating(true);
      setCurrentIndex(prevIndex);

      // Clean up after animation
      setTimeout(() => {
        setIsAnimating(false);
        setPreviousIndex(null);
        setSlideDirection(null);
      }, 300);
    }, 10);
  }, [isAnimating, currentIndex, journeysCount]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const swipeThreshold = 50; // minimum swipe distance
    const diff = touchStartX.current - touchEndX.current;

    // Swipe left = next train
    if (diff > swipeThreshold) {
      handleNextTrain();
    }
    // Swipe right = previous train
    else if (diff < -swipeThreshold) {
      handlePreviousTrain();
    }
  }, [handleNextTrain, handlePreviousTrain]);

  const resetIndex = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  return {
    currentIndex,
    previousIndex,
    slideDirection,
    isAnimating,
    handleNextTrain,
    handlePreviousTrain,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetIndex
  };
}
