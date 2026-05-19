import { GroupedLine } from './lineGrouper';

export interface RectangularBlock {
  id: string;
  lines: GroupedLine[];
  frame: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  cornerPoints: { x: number; y: number }[];
  text: string;
}

export interface BlockGrouperOptions {
  /**
   * Horizontal tolerance for left alignment (in pixels).
   * If not specified, calculated dynamically based on average line height.
   */
  toleranceX?: number;
  /**
   * Maximum vertical gap allowed between consecutive lines in a block (in pixels).
   * If not specified, calculated dynamically based on average line height.
   */
  toleranceY?: number;
  /**
   * Minimum number of lines required to form a block.
   * Default: 1.
   */
  minLines?: number;
}

interface ProjectedLine {
  line: GroupedLine;
  leftX: number;     // Projected left X coordinate (skew-corrected)
  centerY: number;   // Projected center Y coordinate (skew-corrected)
  height: number;    // Line height
  index: number;     // Original index in the sorted list
}

/**
 * Calculates the global skew angle of the lines based on their corner points.
 * Returns the angle in radians.
 */
const calculateLinesSkewAngle = (lines: GroupedLine[]): number => {
  const angles: { angle: number; weight: number }[] = [];
  lines.forEach(line => {
    if (line.cornerPoints && line.cornerPoints.length === 4) {
      const dx = line.cornerPoints[1].x - line.cornerPoints[0].x;
      const dy = line.cornerPoints[1].y - line.cornerPoints[0].y;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(angle) < Math.PI / 4) {
        angles.push({ angle, weight: line.frame?.width ?? 1 });
      }
    }
  });

  const totalWeight = angles.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight > 0
    ? angles.reduce((sum, item) => sum + item.angle * item.weight, 0) / totalWeight
    : 0;
};

/**
 * Projects a point (x, y) using the given rotation angle.
 */
const projectPoint = (x: number, y: number, cosA: number, sinA: number) => {
  const px = x * cosA + y * sinA;
  const py = -x * sinA + y * cosA;
  return { x: px, y: py };
};

/**
 * Groups lines into rectangular blocks, prioritizing the largest blocks with
 * the most consecutive left-aligned lines.
 * 
 * @param lines List of GroupedLines
 * @param options Configuration options for the grouping algorithm
 * @returns Array of RectangularBlocks sorted from top to bottom
 */
export const groupLinesIntoLeftAlignedBlocks = (
  lines: GroupedLine[],
  options: BlockGrouperOptions = {}
): RectangularBlock[] => {
  if (!lines || lines.length === 0) return [];

  // 1. Sort lines from top to bottom by their Y-coordinate first (as a baseline)
  const sortedLines = [...lines].sort((a, b) => {
    const aY = a.projectedY ?? a.frame?.top ?? 0;
    const bY = b.projectedY ?? b.frame?.top ?? 0;
    return aY - bY;
  });

  // 2. Calculate the global skew angle and average line height
  const skewAngleRad = calculateLinesSkewAngle(sortedLines);
  const cosA = Math.cos(skewAngleRad);
  const sinA = Math.sin(skewAngleRad);

  const lineHeights = sortedLines
    .map(l => l.frame?.height)
    .filter((h): h is number => h !== undefined && h > 0);
  const avgLineHeight = lineHeights.length > 0
    ? lineHeights.reduce((sum, h) => sum + h, 0) / lineHeights.length
    : 15;

  // 3. Set default tolerances if not provided
  const toleranceX = options.toleranceX ?? Math.max(20, avgLineHeight * 0.8);
  const toleranceY = options.toleranceY ?? avgLineHeight * 1.8;
  const minLines = options.minLines ?? 1;

  // 4. Project coordinates for skew-correction
  const projectedLines: ProjectedLine[] = sortedLines.map((line, idx) => {
    let lx = 0;
    let ly = 0;
    let cx = 0;
    let cy = 0;

    if (line.cornerPoints && line.cornerPoints.length === 4) {
      // Use the average of the left points (top-left and bottom-left) for left alignment
      lx = (line.cornerPoints[0].x + line.cornerPoints[3].x) / 2;
      ly = (line.cornerPoints[0].y + line.cornerPoints[3].y) / 2;
      
      cx = (line.cornerPoints[0].x + line.cornerPoints[1].x + line.cornerPoints[2].x + line.cornerPoints[3].x) / 4;
      cy = (line.cornerPoints[0].y + line.cornerPoints[1].y + line.cornerPoints[2].y + line.cornerPoints[3].y) / 4;
    } else if (line.frame) {
      lx = line.frame.left;
      ly = line.frame.top + line.frame.height / 2;
      cx = line.frame.left + line.frame.width / 2;
      cy = line.frame.top + line.frame.height / 2;
    }

    const projectedLeft = projectPoint(lx, ly, cosA, sinA);
    const projectedCenter = projectPoint(cx, cy, cosA, sinA);

    return {
      line,
      leftX: projectedLeft.x,
      centerY: projectedCenter.y,
      height: line.frame?.height ?? avgLineHeight,
      index: idx
    };
  });

  // Sort projected lines based on their unskewed Y-coordinates
  projectedLines.sort((a, b) => a.centerY - b.centerY);

  // 5. Greedy extraction of the largest blocks
  const availableIndices = new Set<number>(projectedLines.map((_, idx) => idx));
  const blocks: RectangularBlock[] = [];
  let blockCounter = 0;

  while (availableIndices.size > 0) {
    let bestStart = -1;
    let bestEnd = -1;
    let bestLineCount = 0;
    let bestArea = 0;
    let bestTextLength = 0;

    // Search all possible consecutive ranges [i, j]
    for (let i = 0; i < projectedLines.length; i++) {
      if (!availableIndices.has(i)) continue;

      let currentLefts: number[] = [];
      let lastCenterY = -1;
      let lastHeight = 0;
      let isValidRange = true;

      for (let j = i; j < projectedLines.length; j++) {
        if (!availableIndices.has(j)) {
          // Range interrupted by already-assigned line
          break;
        }

        const currentLine = projectedLines[j];

        // Check vertical continuity with the previous line in the range
        if (j > i) {
          // Vertical gap = (distance between centers) - (half-height of both lines)
          const gapY = (currentLine.centerY - lastCenterY) - (lastHeight / 2 + currentLine.height / 2);
          if (gapY > toleranceY) {
            // Gap is too big, cannot extend this range further
            break;
          }
        }

        // Check left-alignment
        currentLefts.push(currentLine.leftX);
        const minLeft = Math.min(...currentLefts);
        const maxLeft = Math.max(...currentLefts);

        if (maxLeft - minLeft > toleranceX) {
          // Left boundary deviation is too large, cannot include this line
          break;
        }

        // Save current line coordinates for the next iteration's gap check
        lastCenterY = currentLine.centerY;
        lastHeight = currentLine.height;

        // Calculate candidate block properties
        const lineCount = j - i + 1;
        
        // Calculate bounding box of lines in range [i, j]
        const rangeLines = projectedLines.slice(i, j + 1).map(pl => pl.line);
        const left = Math.min(...rangeLines.map(l => l.frame?.left ?? 0));
        const top = Math.min(...rangeLines.map(l => l.frame?.top ?? 0));
        const right = Math.max(...rangeLines.map(l => (l.frame?.left ?? 0) + (l.frame?.width ?? 0)));
        const bottom = Math.max(...rangeLines.map(l => (l.frame?.top ?? 0) + (l.frame?.height ?? 0)));
        const area = (right - left) * (bottom - top);
        const textLength = rangeLines.reduce((sum, l) => sum + l.text.length, 0);

        // Score comparison:
        // 1. Maximize number of consecutive lines
        // 2. Tie-breaker: Maximize bounding area
        // 3. Tie-breaker: Maximize text length
        let isBetter = false;
        if (lineCount > bestLineCount) {
          isBetter = true;
        } else if (lineCount === bestLineCount) {
          if (area > bestArea) {
            isBetter = true;
          } else if (Math.abs(area - bestArea) < 1e-3) {
            if (textLength > bestTextLength) {
              isBetter = true;
            }
          }
        }

        if (isBetter) {
          bestStart = i;
          bestEnd = j;
          bestLineCount = lineCount;
          bestArea = area;
          bestTextLength = textLength;
        }
      }
    }

    // If we couldn't find any valid block meeting the minLines requirement, stop grouping
    if (bestLineCount < minLines) {
      break;
    }

    // Extract the best block
    const blockLines = projectedLines.slice(bestStart, bestEnd + 1).map(pl => pl.line);
    const left = Math.min(...blockLines.map(l => l.frame?.left ?? 0));
    const top = Math.min(...blockLines.map(l => l.frame?.top ?? 0));
    const right = Math.max(...blockLines.map(l => (l.frame?.left ?? 0) + (l.frame?.width ?? 0)));
    const bottom = Math.max(...blockLines.map(l => (l.frame?.top ?? 0) + (l.frame?.height ?? 0)));

    let cornerPoints: { x: number; y: number }[] = [];
    const firstLine = blockLines[0];
    const lastLine = blockLines[blockLines.length - 1];

    if (firstLine?.cornerPoints && lastLine?.cornerPoints && firstLine.cornerPoints.length === 4 && lastLine.cornerPoints.length === 4) {
      cornerPoints = [
        { x: firstLine.cornerPoints[0].x, y: firstLine.cornerPoints[0].y },
        { x: firstLine.cornerPoints[1].x, y: firstLine.cornerPoints[1].y },
        { x: lastLine.cornerPoints[2].x, y: lastLine.cornerPoints[2].y },
        { x: lastLine.cornerPoints[3].x, y: lastLine.cornerPoints[3].y }
      ];
    } else {
      cornerPoints = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom }
      ];
    }

    const text = blockLines.map(l => l.text).join('\n');

    blocks.push({
      id: `grouped-block-${blockCounter++}`,
      lines: blockLines,
      frame: { left, top, width: right - left, height: bottom - top },
      cornerPoints,
      text
    });

    // Remove the extracted line indices from the available set
    for (let k = bestStart; k <= bestEnd; k++) {
      availableIndices.delete(k);
    }
  }

  // Sort blocks by their Y-coordinate (top to bottom)
  return blocks.sort((a, b) => a.frame.top - b.frame.top);
};

/**
 * Finds and returns the single largest left-aligned block from a list of GroupedLines.
 * 
 * @param lines List of GroupedLines
 * @param options Configuration options
 * @returns The largest RectangularBlock, or null if none found
 */
export const findLargestLeftAlignedBlock = (
  lines: GroupedLine[],
  options: BlockGrouperOptions = {}
): RectangularBlock | null => {
  const blocks = groupLinesIntoLeftAlignedBlocks(lines, options);
  if (blocks.length === 0) return null;

  // Since groupLinesIntoLeftAlignedBlocks extracts blocks greedily (starting with the absolute best/largest),
  // the first block in the greedy extraction process was the absolute best according to our scoring criteria.
  // Wait, but groupLinesIntoLeftAlignedBlocks sorts the final array of blocks from top to bottom.
  // So we should find the one with the maximum lines / area from the resulting blocks.
  let bestBlock = blocks[0];
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i];
    const b = bestBlock;
    
    let isBetter = false;
    if (a.lines.length > b.lines.length) {
      isBetter = true;
    } else if (a.lines.length === b.lines.length) {
      const aArea = a.frame.width * a.frame.height;
      const bArea = b.frame.width * b.frame.height;
      if (aArea > bArea) {
        isBetter = true;
      } else if (Math.abs(aArea - bArea) < 1e-3) {
        if (a.text.length > b.text.length) {
          isBetter = true;
        }
      }
    }
    
    if (isBetter) {
      bestBlock = a;
    }
  }

  return bestBlock;
};
