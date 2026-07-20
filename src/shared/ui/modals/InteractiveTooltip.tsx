import React, { ReactElement, useEffect, useRef } from 'react';
import { TOUR_STEPS, TourStep, useAppTourState } from '@/src/shared/stores/appTourStore';

interface Props {
  stepName?: TourStep;
  stepNames?: TourStep[];
  text?: string;
  texts?: string[];
  children: ReactElement<any>;
  allowChildInteraction?: boolean;
  closeOnChildInteraction?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  childrenWrapperStyle?: any;
  useReactNativeModal?: boolean;
  childContentSpacing?: number;
  verticalOffset?: number;
}

export function InteractiveTooltip({
  stepName,
  stepNames,
  children,
}: Props) {
  const { isActive, currentStepIndex, setTargetRect } = useAppTourState();
  const childRef = useRef<any>(null);

  const steps = stepNames ?? (stepName ? [stepName] : []);
  const activeStepName = TOUR_STEPS[currentStepIndex];
  const isStepActive = isActive && steps.includes(activeStepName);

  useEffect(() => {
    if (!isStepActive) return;

    const measureTarget = () => {
      if (!childRef.current) return;

      const targetNode = childRef.current;
      if (typeof targetNode.measureInWindow === 'function') {
        targetNode.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (
            typeof x === 'number' && Number.isFinite(x) &&
            typeof y === 'number' && Number.isFinite(y) &&
            typeof width === 'number' && Number.isFinite(width) && width > 0 &&
            typeof height === 'number' && Number.isFinite(height) && height > 0
          ) {
            setTargetRect({
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height),
            });
          }
        });
      }
    };

    measureTarget();
    const t1 = setTimeout(measureTarget, 150);
    const t2 = setTimeout(measureTarget, 400);
    const t3 = setTimeout(measureTarget, 650);
    const t4 = setTimeout(measureTarget, 900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isStepActive, activeStepName, setTargetRect]);

  if (!React.isValidElement(children)) {
    return children;
  }

  return React.cloneElement(children, { ref: childRef } as any);
}
