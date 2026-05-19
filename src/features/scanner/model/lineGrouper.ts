import { TextElement } from '@react-native-ml-kit/text-recognition';

export interface GroupedLine {
  id: string;
  text: string;
  elements: TextElement[];
  frame?: { left: number; top: number; width: number; height: number };
  cornerPoints?: readonly { x: number, y: number }[];
  projectedY?: number; // Pour le tri final de haut en bas
}

/**
 * Regroupe géométriquement les mots individuels (TextElement) en lignes physiques de lecture,
 * en compensant la rotation (un-skewing) et en séparant dynamiquement les colonnes de texte
 * par analyse des marges gauches des lignes réelles.
 * 
 * @param elements Liste plate des mots détectés
 * @returns Tableau de lignes regroupées triées du haut vers le bas
 */
export const groupElementsIntoLines = (elements: TextElement[]): GroupedLine[] => {
  if (!elements || elements.length === 0) return [];

  // 1. Calculer l'angle d'inclinaison global moyen (en radians)
  const angles: { angle: number; weight: number }[] = [];
  elements.forEach(el => {
    if (el.cornerPoints && el.cornerPoints.length === 4) {
      const dx = el.cornerPoints[1].x - el.cornerPoints[0].x;
      const dy = el.cornerPoints[1].y - el.cornerPoints[0].y;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(angle) < Math.PI / 4) {
        angles.push({ angle, weight: el.frame?.width ?? 1 });
      }
    }
  });
  
  const totalWeight = angles.reduce((sum, item) => sum + item.weight, 0);
  const globalAngleRad = totalWeight > 0
    ? angles.reduce((sum, item) => sum + item.angle * item.weight, 0) / totalWeight
    : 0;

  const cosA = Math.cos(globalAngleRad);
  const sinA = Math.sin(globalAngleRad);

  // 2. Déterminer la position redressée (projetée) de chaque mot et son bord gauche (leftX)
  const positionedElements = elements.map((element, idx) => {
    let cx = 0;
    let cy = 0;
    if (element.cornerPoints && element.cornerPoints.length === 4) {
      cx = (element.cornerPoints[0].x + element.cornerPoints[1].x + element.cornerPoints[2].x + element.cornerPoints[3].x) / 4;
      cy = (element.cornerPoints[0].y + element.cornerPoints[1].y + element.cornerPoints[2].y + element.cornerPoints[3].y) / 4;
    } else if (element.frame) {
      cx = element.frame.left + element.frame.width / 2;
      cy = element.frame.top + element.frame.height / 2;
    }
    
    const projectedX = cx * cosA + cy * sinA;
    const projectedY = -cx * sinA + cy * cosA;
    
    const width = element.frame?.width ?? 0;
    const height = element.frame?.height ?? 15;
    const leftX = projectedX - width / 2;

    return { element, projectedX, projectedY, leftX, width, height, index: idx };
  });

  const totalHeight = positionedElements.reduce((sum, el) => sum + el.height, 0);
  const avgHeight = totalHeight / positionedElements.length;
  const toleranceY = avgHeight * 0.55; 

  // 3. Regroupement temporaire en lignes horizontales pour analyser les marges de départ
  const tempLines: { minLeftX: number }[] = [];
  const sortedByY = [...positionedElements].sort((a, b) => a.projectedY - b.projectedY);
  
  let currentLineLefts: number[] = [];
  let currentLineCenterY = sortedByY[0]?.projectedY || 0;

  sortedByY.forEach(item => {
    if (Math.abs(item.projectedY - currentLineCenterY) > toleranceY) {
      if (currentLineLefts.length > 0) {
        tempLines.push({ minLeftX: Math.min(...currentLineLefts) });
      }
      currentLineLefts = [item.leftX];
      currentLineCenterY = item.projectedY;
    } else {
      currentLineLefts.push(item.leftX);
    }
  });
  if (currentLineLefts.length > 0) {
    tempLines.push({ minLeftX: Math.min(...currentLineLefts) });
  }

  // 4. Détecter si un saut horizontal majeur existe entre les débuts de lignes
  const lineStarts = tempLines.map(l => l.minLeftX).sort((a, b) => a - b);
  let maxColumnGap = 0;
  let columnSplitX = -1;

  for (let i = 1; i < lineStarts.length; i++) {
    const gap = lineStarts[i] - lineStarts[i - 1];
    if (gap > maxColumnGap) {
      maxColumnGap = gap;
      columnSplitX = (lineStarts[i] + lineStarts[i - 1]) / 2;
    }
  }

  // Seuil horizontal de détection de colonne (2.5x la hauteur de texte, min 70px)
  const columnDetectionThreshold = Math.max(avgHeight * 2.5, 70);
  const hasMultipleColumns = maxColumnGap > columnDetectionThreshold;

  console.log(`[lineGrouper] Analyse marges de lignes : maxColumnGap = ${maxColumnGap.toFixed(1)}px (seuil = ${columnDetectionThreshold.toFixed(1)}px). Colonnes multiples ? ${hasMultipleColumns ? 'OUI (coupure à X = ' + columnSplitX.toFixed(1) + 'px)' : 'NON'}`);

  // 5. Répartition finale et regroupement
  const finalGroupedLines: GroupedLine[] = [];
  let lineCounter = 0;

  if (hasMultipleColumns) {
    const leftColElements = positionedElements.filter(el => el.leftX < columnSplitX);
    const rightColElements = positionedElements.filter(el => el.leftX >= columnSplitX);

    groupAndAppendLines(leftColElements);
    groupAndAppendLines(rightColElements);
  } else {
    groupAndAppendLines(positionedElements);
  }

  function groupAndAppendLines(elementsInColumn: typeof positionedElements) {
    if (elementsInColumn.length === 0) return;

    const rawLines: { centerY: number; items: typeof positionedElements }[] = [];
    const sortedByY = [...elementsInColumn].sort((a, b) => a.projectedY - b.projectedY);

    sortedByY.forEach(item => {
      let line = rawLines.find(l => Math.abs(l.centerY - item.projectedY) < toleranceY);
      if (!line) {
        line = { centerY: item.projectedY, items: [] };
        rawLines.push(line);
      } else {
        line.centerY = (line.centerY * line.items.length + item.projectedY) / (line.items.length + 1);
      }
      line.items.push(item);
    });

    rawLines.forEach(line => {
      line.items.sort((a, b) => a.projectedX - b.projectedX);

      // Scission d'écart horizontal de sécurité au sein d'une même colonne
      const splitThresholdX = avgHeight * 1.0;
      let currentSubLine: typeof line.items = [];

      line.items.forEach((item, itemIdx) => {
        if (itemIdx === 0) {
          currentSubLine.push(item);
        } else {
          const prevItem = line.items[itemIdx - 1];
          const prevProjectedEnd = prevItem.projectedX + prevItem.width / 2;
          const currProjectedStart = item.projectedX - item.width / 2;
          const gap = currProjectedStart - prevProjectedEnd;

          if (gap > splitThresholdX) {
            commitSubLine(currentSubLine);
            currentSubLine = [item];
          } else {
            currentSubLine.push(item);
          }
        }
      });

      if (currentSubLine.length > 0) {
        commitSubLine(currentSubLine);
      }
    });
  }

  function commitSubLine(subLine: typeof positionedElements) {
    const sortedElements = subLine.map(item => item.element);
    const lineText = sortedElements.map(e => e.text).join(' ');

    const left = Math.min(...sortedElements.map(e => e.frame?.left ?? 0));
    const top = Math.min(...sortedElements.map(e => e.frame?.top ?? 0));
    const right = Math.max(...sortedElements.map(e => (e.frame?.left ?? 0) + (e.frame?.width ?? 0)));
    const bottom = Math.max(...sortedElements.map(e => (e.frame?.top ?? 0) + (e.frame?.height ?? 0)));

    let cornerPoints: { x: number; y: number }[] = [];
    const firstEl = sortedElements[0];
    const lastEl = sortedElements[sortedElements.length - 1];
    
    if (firstEl?.cornerPoints && lastEl?.cornerPoints && firstEl.cornerPoints.length === 4 && lastEl.cornerPoints.length === 4) {
      cornerPoints = [
        { x: firstEl.cornerPoints[0].x, y: firstEl.cornerPoints[0].y },
        { x: lastEl.cornerPoints[1].x, y: lastEl.cornerPoints[1].y },
        { x: lastEl.cornerPoints[2].x, y: lastEl.cornerPoints[2].y },
        { x: firstEl.cornerPoints[3].x, y: firstEl.cornerPoints[3].y }
      ];
    } else {
      cornerPoints = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom }
      ];
    }

    const lineProjectedY = subLine.reduce((sum, item) => sum + item.projectedY, 0) / subLine.length;

    finalGroupedLines.push({
      id: `grouped-line-${lineCounter++}`,
      text: lineText,
      elements: sortedElements,
      frame: { left, top, width: right - left, height: bottom - top },
      cornerPoints,
      projectedY: lineProjectedY,
    });
  }



  if (hasMultipleColumns) {
    return finalGroupedLines;
  }
  return finalGroupedLines.sort((a, b) => (a.projectedY ?? 0) - (b.projectedY ?? 0));
};
