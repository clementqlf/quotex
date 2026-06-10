/**
 * QuoteDetailTourProvider (features/app-tour)
 *
 * Wraps the QuoteDetailModal with a scoped CopilotProvider and handles
 * the tour auto-start logic triggered by navigation params (fromTour, resumeStep).
 *
 * FSD: features can import entities, shared, and third-party libs. ✅
 */
import React from 'react';
import { CopilotProvider, useCopilot } from 'react-native-copilot';
import { useLocalSearchParams } from 'expo-router';
// CustomTooltip with cross-screen navigation logic (same feature slice ✅)
import CustomTooltip from './CustomTooltip';
import QuoteDetailModal from '@/src/entities/quote/ui/QuoteDetailModal';

// Inner component: has access to the local CopilotProvider context
function QuoteDetailTourInner() {
  const { fromTour, resumeStep } = useLocalSearchParams<{
    fromTour?: string;
    resumeStep?: string;
  }>();
  const { start: startTour } = useCopilot();

  const startTourRef = React.useRef(startTour);
  React.useEffect(() => {
    startTourRef.current = startTour;
  }, [startTour]);

  const hasStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (fromTour !== 'true' || hasStartedRef.current) return;

    const step = resumeStep || undefined;
    const timer = setTimeout(() => {
      hasStartedRef.current = true;
      startTourRef.current(step).catch((err) =>
        console.log('[QuoteDetailTourProvider] startTour error:', err)
      );
    }, 600);

    return () => clearTimeout(timer);
  }, [fromTour, resumeStep]);

  return <QuoteDetailModal />;
}

// Exported component: provides the scoped CopilotProvider for the modal screen
export default function QuoteDetailTourProvider() {
  return (
    <CopilotProvider
      overlay="svg"
      animated={true}
      tooltipComponent={CustomTooltip}
      stepNumberComponent={() => null}
      verticalOffset={0}
      tooltipStyle={{
        backgroundColor: 'transparent',
        borderRadius: 18,
        padding: 0,
        width: 290,
        overflow: 'visible',
      }}
    >
      <QuoteDetailTourInner />
    </CopilotProvider>
  );
}
