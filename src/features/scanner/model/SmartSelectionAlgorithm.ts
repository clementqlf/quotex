export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TextElement {
  id?: string;
  text: string;
  rect: Rect;
  originalBlock?: any;
  columnId?: string;
}

export interface TextLine {
  id?: string;
  text: string;
  rect: Rect;
  elements: TextElement[];
}

export interface TextBlock {
  id?: string;
  text: string;
  rect: Rect;
  lines: TextLine[];
  columnId?: string;
}

/**
 * SmartTextSelection implémente l'algorithme "XY-Cut" (Document Layout Analysis).
 * Il permet de déduire l'ordre de lecture logique des blocs de texte, même en présence 
 * de colonnes complexes (comme une image de couverture sur la gauche et du texte sur la droite).
 */
export class SmartTextSelection {
  private blocks: TextBlock[] = [];
  private orderedElements: TextElement[] = [];

  constructor(blocks: TextBlock[]) {
    this.blocks = blocks;
    this.processLayout();
  }

  /**
   * Trie récursivement tous les blocs pour obtenir l'ordre de lecture parfait,
   * puis aplatit tous les mots dans un tableau unidimensionnel.
   */
  private processLayout() {
    // 1. Détecter les colonnes initiales par chaînage vertical (Vertical Flow Tracking)
    const initialColumns = this.detectColumns(this.blocks);

    // 2. Règle de franchissement de colonne (Crossing Column Split) :
    // Si un segment rentre dans une autre colonne active à son niveau vertical que celle
    // à laquelle il appartient, ce segment est scindé et l'autre partie est intégrée à la colonne cible.
    const splitBlocks = this.performCrossingSplit(this.blocks, initialColumns);

    // 3. Détecter les colonnes finales sur les blocs scindés
    const finalColumnsRaw = this.detectColumns(splitBlocks);

    // Mettre à jour this.blocks pour inclure tous les blocs (potentiellement scindés)
    this.blocks = splitBlocks;

    // Règle d'inclusion géométrique : Si les 4 coins d'une colonne sont inclus 
    // à l'intérieur d'autres colonnes (éventuellement différentes), on supprime cette colonne.
    const groupBounds = finalColumnsRaw.map(col => {
      const left = Math.min(...col.map(item => item.rect.left));
      const right = Math.max(...col.map(item => item.rect.right));
      const top = Math.min(...col.map(item => item.rect.top));
      const bottom = Math.max(...col.map(item => item.rect.bottom));
      return { left, right, top, bottom, group: col };
    });

    const groupsToKeep = groupBounds.filter((g, index) => {
      const corners = [
        { x: g.left, y: g.top },
        { x: g.right, y: g.top },
        { x: g.left, y: g.bottom },
        { x: g.right, y: g.bottom }
      ];

      const allCornersIncluded = corners.every(corner => {
        return groupBounds.some((otherG, otherIndex) => {
          if (index === otherIndex) return false;
          // Tolérance stricte (0px) pour préserver les colonnes valides
          const tolerance = 0;
          return (
            corner.x >= otherG.left - tolerance &&
            corner.x <= otherG.right + tolerance &&
            corner.y >= otherG.top - tolerance &&
            corner.y <= otherG.bottom + tolerance
          );
        });
      });

      return !allCornersIncluded;
    });

    const finalColumns = groupsToKeep.map(gb => gb.group);

    // Mettre à jour this.blocks pour n'inclure que les blocs des colonnes conservées
    const keptItems = new Set<TextBlock>();
    finalColumns.forEach(col => {
      col.forEach(item => keptItems.add(item));
    });
    this.blocks = this.blocks.filter(b => keptItems.has(b));

    // Assigner un columnId uniquement aux groupes scindés qui ont > 4 items (les vraies colonnes)
    let colIndex = 1;
    console.log(`[SmartTextSelection] Total final columns detected: ${finalColumns.length}`);
    finalColumns.forEach((col, idx) => {
      const isRealCol = col.length > 4;
      const colId = isRealCol ? `Col ${colIndex++}` : undefined;
      
      console.log(`[SmartTextSelection] Column #${idx + 1}: ${colId || 'None (Orphan)'} | Size: ${col.length} segments`);
      col.forEach(b => {
        const textSample = b.lines.map(l => l.text).join(' ').slice(0, 40);
        console.log(`  - Block ID: "${b.id}" | Left: ${b.rect.left.toFixed(1)} | Top: ${b.rect.top.toFixed(1)} | Text: "${textSample}..."`);
        b.columnId = colId;
      });
    });

    // 2. Continuer avec xyCut standard sur les blocs restants
    const orderedBlocks = this.xyCut(this.blocks);

    this.orderedElements = [];
    for (const block of orderedBlocks) {
      // On s'assure que les lignes sont triées de haut en bas
      const sortedLines = [...block.lines].sort((a, b) => a.rect.top - b.rect.top);
      
      for (const line of sortedLines) {
        // On s'assure que les mots (elements) sont triés de gauche à droite
        const sortedElements = [...line.elements].sort((a, b) => a.rect.left - b.rect.left);
        for (const el of sortedElements) {
          el.columnId = block.columnId;
          this.orderedElements.push(el);
        }
      }
    }
  }

  /**
   * Algorithme XY-Cut : Cherche des espaces vides verticaux ou horizontaux 
   * pour découper l'image en groupes logiques (ex: séparer la colonne de gauche de la colonne de droite).
   */
  private xyCut(blocks: TextBlock[]): TextBlock[] {
    if (blocks.length <= 1) return blocks;

    // 1. Essayer une coupe Verticale (séparer les colonnes de gauche à droite)
    const xIntervals = blocks.map(b => {
      const w = b.rect.right - b.rect.left;
      // Marge de 25% pour ne considérer que le centre du bloc (évite les fusions dues aux chevauchements de bounding boxes)
      const margin = w * 0.25;
      return { start: b.rect.left + margin, end: b.rect.right - margin, item: b };
    });
    
    const vGroups = this.mergeIntervals(xIntervals, true);

    // Si on trouve un espace vertical (comme entre la couverture "Capitaine Conan" et le texte), on coupe !
    if (vGroups.length > 1) {
      return vGroups.flatMap(group => this.xyCut(group.items));
    }

    // 2. Essayer une coupe Horizontale (séparer les paragraphes/headers de haut en bas)
    const yIntervals = blocks.map(b => {
      const h = b.rect.bottom - b.rect.top;
      // Marge de 25% pour isoler le cœur de la ligne
      const margin = h * 0.25;
      return { start: b.rect.top + margin, end: b.rect.bottom - margin, item: b };
    });
    
    const hGroups = this.mergeIntervals(yIntervals, false);

    // Si on trouve un espace horizontal qui traverse toute la page, on coupe !
    if (hGroups.length > 1) {
      return hGroups.flatMap(group => this.xyCut(group.items));
    }

    // 3. Fallback: S'il n'y a pas d'espace net, on trie bêtement de haut en bas, puis de gauche à droite.
    return [...blocks].sort((a, b) => {
      const topDiff = a.rect.top - b.rect.top;
      if (Math.abs(topDiff) > 10) return topDiff;
      return a.rect.left - b.rect.left;
    });
  }

  /**
   * Fonction utilitaire pour fusionner des intervalles qui se chevauchent.
   */
  private mergeIntervals(
    intervals: { start: number; end: number; item: TextBlock }[],
    checkLeftAlignment = false
  ) {
    // Trier les intervalles par leur point de départ
    intervals.sort((a, b) => a.start - b.start);
    const groups: { start: number; end: number; items: TextBlock[] }[] = [];

    for (const interval of intervals) {
      if (groups.length === 0) {
        groups.push({ start: interval.start, end: interval.end, items: [interval.item] });
      } else {
        const lastGroup = groups[groups.length - 1];
        
        let shouldMerge = interval.start <= lastGroup.end;
        
        // Si demandé, on vérifie que les bords gauches sont alignés verticalement
        // pour éviter de fusionner des colonnes décalées qui se chevauchent à cause de la rotation.
        if (shouldMerge && checkLeftAlignment) {
          const avgLeft = lastGroup.items.reduce((sum, item) => sum + item.rect.left, 0) / lastGroup.items.length;
          const currentLeft = interval.item.rect.left;
          const leftDiff = Math.abs(currentLeft - avgLeft);
          
          // Seuil de 40px tolérant pour les paragraphes indentés, mais strict pour séparer les colonnes
          if (leftDiff > 40) {
            shouldMerge = false;
          }
        }

        if (shouldMerge) {
          // Chevauchement : on fusionne l'intervalle et on ajoute l'item
          lastGroup.end = Math.max(lastGroup.end, interval.end);
          lastGroup.items.push(interval.item);
        } else {
          // Espace vide détecté : on crée un nouveau groupe
          groups.push({ start: interval.start, end: interval.end, items: [interval.item] });
        }
      }
    }
    return groups;
  }

  /**
   * Distance Euclidienne entre un point et un rectangle.
   */
  private getDistanceToRect(x: number, y: number, rect: Rect): number {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Trouve l'index du mot (element) le plus proche d'une coordonnée tactile (x, y).
   */
  public getNearestElementIndex(x: number, y: number): number {
    if (this.orderedElements.length === 0) return -1;

    let minDistance = Infinity;
    let bestIndex = -1;

    for (let i = 0; i < this.orderedElements.length; i++) {
      const dist = this.getDistanceToRect(x, y, this.orderedElements[i].rect);
      if (dist < minDistance) {
        minDistance = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  /**
   * Retourne tous les mots sélectionnés entre les deux points tactiles (les "poignées").
   * Grâce au XY-Cut, l'ordre logique est respecté et le texte de couverture est naturellement ignoré.
   */
  public getSelection(startPoint: Point, endPoint: Point): TextElement[] {
    const startIndex = this.getNearestElementIndex(startPoint.x, startPoint.y);
    const endIndex = this.getNearestElementIndex(endPoint.x, endPoint.y);

    if (startIndex === -1 || endIndex === -1) return [];

    const minIdx = Math.min(startIndex, endIndex);
    const maxIdx = Math.max(startIndex, endIndex);

    return this.orderedElements.slice(minIdx, maxIdx + 1);
  }

  /**
   * Retourne la chaîne de caractères concaténée de la sélection.
   */
  public getSelectionText(startPoint: Point, endPoint: Point): string {
    return this.getSelection(startPoint, endPoint)
      .map(e => e.text)
      .join(' ');
  }

  /**
   * Utile pour afficher des highlights dans l'UI avec React Native.
   */
  public getOrderedElements(): TextElement[] {
    return this.orderedElements;
  }

  /**
   * Helper bottom-up pour détecter les colonnes géométriques par alignement vertical gauche
   */
  private detectColumns(blocks: TextBlock[]): TextBlock[][] {
    const columns: TextBlock[][] = [];
    const visited = new Set<TextBlock>();
    const sortedBlocks = [...blocks].sort((a, b) => a.rect.top - b.rect.top);

    sortedBlocks.forEach(block => {
      if (visited.has(block)) return;

      const currentColumn = [block];
      visited.add(block);

      let current = block;
      while (true) {
        let bestSuccessor: TextBlock | null = null;
        let minDistanceY = Infinity;
        const currentHeight = current.rect.bottom - current.rect.top;

        sortedBlocks.forEach(candidate => {
          if (visited.has(candidate)) return;

          const gapY = candidate.rect.top - current.rect.bottom;
          if (gapY < -15) return;

          if (gapY > currentHeight * 1.6) return;

          const leftDiff = Math.abs(candidate.rect.left - block.rect.left);
          if (leftDiff > 30) return;

          if (gapY < minDistanceY) {
            minDistanceY = gapY;
            bestSuccessor = candidate;
          }
        });

        if (bestSuccessor) {
          currentColumn.push(bestSuccessor);
          visited.add(bestSuccessor);
          current = bestSuccessor;
        } else {
          break;
        }
      }

      columns.push(currentColumn);
    });

    return columns;
  }

  private computeRectFromElements(elements: TextElement[]): Rect {
    const left = Math.min(...elements.map(e => e.rect.left));
    const right = Math.max(...elements.map(e => e.rect.right));
    const top = Math.min(...elements.map(e => e.rect.top));
    const bottom = Math.max(...elements.map(e => e.rect.bottom));
    return { left, right, top, bottom };
  }

  private computeRectFromLines(lines: TextLine[]): Rect {
    const left = Math.min(...lines.map(l => l.rect.left));
    const right = Math.max(...lines.map(l => l.rect.right));
    const top = Math.min(...lines.map(l => l.rect.top));
    const bottom = Math.max(...lines.map(l => l.rect.bottom));
    return { left, right, top, bottom };
  }

  /**
   * Identifie et scinde génériquement les blocs qui franchissent les frontières de colonnes actives
   */
  private performCrossingSplit(blocks: TextBlock[], columns: TextBlock[][]): TextBlock[] {
    const refinedBlocks: TextBlock[] = [];

    // Métadonnées sur les axes et hauteurs des colonnes détectées
    const columnMeta = columns.map(col => {
      const lefts = col.map(b => b.rect.left);
      const avgLeft = lefts.reduce((a, b) => a + b, 0) / lefts.length;
      const top = Math.min(...col.map(b => b.rect.top));
      const bottom = Math.max(...col.map(b => b.rect.bottom));
      return {
        avgLeft,
        top,
        bottom,
        blocks: col
      };
    });

    blocks.forEach(block => {
      const midY = (block.rect.top + block.rect.bottom) / 2;
      
      let splitAxis: number | null = null;

      for (const col of columnMeta) {
        // La colonne cible doit être active à la hauteur de ce bloc
        const isColumnActive = midY >= col.top - 15 && midY <= col.bottom + 15;
        if (!isColumnActive) continue;

        // Le bloc franchit-il la ligne de départ de cette colonne ?
        const isCrossing = block.rect.left < col.avgLeft - 25 && block.rect.right > col.avgLeft + 25;
        if (isCrossing) {
          splitAxis = col.avgLeft;
          break;
        }
      }

      if (splitAxis !== null) {
        // Récupérer et trier de gauche à droite tous les éléments du bloc
        const allElements: TextElement[] = [];
        block.lines.forEach(line => {
          line.elements.forEach(el => allElements.push(el));
        });
        allElements.sort((a, b) => a.rect.left - b.rect.left);

        // Trouver le mot s'alignant au plus proche de l'axe de split
        let targetIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < allElements.length; i++) {
          const diff = Math.abs(allElements[i].rect.left - splitAxis!);
          if (diff < minDiff && diff < 25) {
            minDiff = diff;
            targetIdx = i;
          }
        }

        if (targetIdx > 0) {
          const splitElement = allElements[targetIdx];
          const splitX = splitElement.rect.left;

          const leftLines: TextLine[] = [];
          const rightLines: TextLine[] = [];

          block.lines.forEach(line => {
            const leftElements = line.elements.filter(el => el.rect.left < splitX);
            const rightElements = line.elements.filter(el => el.rect.left >= splitX);

            if (leftElements.length > 0) {
              leftLines.push({
                ...line,
                elements: leftElements,
                rect: this.computeRectFromElements(leftElements),
                text: leftElements.map(e => e.text).join(' ')
              });
            }
            if (rightElements.length > 0) {
              rightLines.push({
                ...line,
                elements: rightElements,
                rect: this.computeRectFromElements(rightElements),
                text: rightElements.map(e => e.text).join(' ')
              });
            }
          });

          if (leftLines.length > 0 && rightLines.length > 0) {
            const leftId = `${block.id}-L`;
            const rightId = `${block.id}-R`;

            const leftBlock: TextBlock = {
              id: leftId,
              text: leftLines.map(l => l.text).join(' '),
              rect: this.computeRectFromLines(leftLines),
              lines: leftLines
            };

            const rightBlock: TextBlock = {
              id: rightId,
              text: rightLines.map(l => l.text).join(' '),
              rect: this.computeRectFromLines(rightLines),
              lines: rightLines
            };

            // Mettre à jour les blockId et parentScreenRect des mots originaux pour l'UI
            leftLines.forEach(line => {
              line.elements.forEach(el => {
                if (el.originalBlock) {
                  el.originalBlock.blockId = leftId;
                  el.originalBlock.parentScreenRect = leftBlock.rect;
                }
              });
            });

            rightLines.forEach(line => {
              line.elements.forEach(el => {
                if (el.originalBlock) {
                  el.originalBlock.blockId = rightId;
                  el.originalBlock.parentScreenRect = rightBlock.rect;
                }
              });
            });

            console.log(`[SmartTextSelection] Crossing Split: "${block.id}" successfully split at splitX=${splitX.toFixed(1)}px (left: "${leftBlock.text.slice(0, 25)}", right: "${rightBlock.text.slice(0, 25)}")`);
            refinedBlocks.push(leftBlock, rightBlock);
            return;
          }
        }
      }

      refinedBlocks.push(block);
    });

    return refinedBlocks;
  }
}
