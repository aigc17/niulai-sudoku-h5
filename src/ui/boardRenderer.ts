/**
 * [INPUT]: CellState, GridCoord, ConflictInfo - 引用自 src/types.ts
 *          PALETTE - 引用自 src/core/levels.ts, gameState - 引用自 src/core/state.ts
 * [OUTPUT]: BoardRenderer 类 (render, update, getCellElement)
 * [POS]: 棋盘渲染子系统，负责 DOM 网格绘制、颜色区域圆角融合、小马/小牛SVG及高亮冲突特效
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { CellState } from '../types';
import { PALETTE } from '../core/levels';
import { gameState } from '../core/state';

export class BoardRenderer {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * 完整渲染整个棋盘网格与坐标系
   */
  public render() {
    const level = gameState.currentLevel;
    const size = level.size;
    const isColorblind = gameState.user.settings.colorblind;
    const showCoordinates = gameState.user.settings.coordinates;

    this.container.innerHTML = '';
    this.container.style.setProperty('--grid-size', size.toString());

    // 冲突坐标集合
    const conflictSet = new Set<string>();
    gameState.conflicts.forEach(c => {
      c.coords.forEach(p => conflictSet.add(`${p.row},${p.col}`));
    });

    const gridEl = document.createElement('div');
    gridEl.className = `board-grid ${showCoordinates ? 'with-coordinates' : ''}`;

    // 渲染列坐标标签 (A, B, C...)
    if (showCoordinates) {
      const topRuler = document.createElement('div');
      topRuler.className = 'coord-ruler top-ruler';
      topRuler.appendChild(document.createElement('div')); // 占位左上角
      for (let c = 0; c < size; c++) {
        const label = document.createElement('div');
        label.className = 'coord-label';
        label.innerText = String.fromCharCode(65 + c);
        topRuler.appendChild(label);
      }
      this.container.appendChild(topRuler);
    }

    const mainArea = document.createElement('div');
    mainArea.className = 'board-main-area';

    // 渲染行坐标标签 (1, 2, 3...)
    if (showCoordinates) {
      const leftRuler = document.createElement('div');
      leftRuler.className = 'coord-ruler left-ruler';
      for (let r = 0; r < size; r++) {
        const label = document.createElement('div');
        label.className = 'coord-label';
        label.innerText = (r + 1).toString();
        leftRuler.appendChild(label);
      }
      mainArea.appendChild(leftRuler);
    }

    // 渲染格子主体
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        const regionId = level.regions[r][c];
        const color = PALETTE[regionId % PALETTE.length];
        const state = gameState.grid[r][c];
        const isConflict = conflictSet.has(`${r},${c}`);

        cell.className = 'board-cell';
        cell.dataset.row = r.toString();
        cell.dataset.col = c.toString();
        cell.style.backgroundColor = color.bg;

        // 计算当前格子与周围区域的边界连通性
        this.applyRegionBorders(cell, r, c, level.regions, size);

        if (isConflict) {
          cell.classList.add('cell-conflict');
        }

        // 色盲模式几何符号水印
        if (isColorblind) {
          const symEl = document.createElement('span');
          symEl.className = 'cell-symbol';
          symEl.innerText = color.symbol;
          cell.appendChild(symEl);
        }

        // 格子内容：空 / ❌ (可爱纯白圆角叉) / 🐮 (红色牛头贴纸)
        if (state === CellState.CROSS) {
          const crossEl = document.createElement('div');
          crossEl.className = 'cell-cross pop-in-cross';
          crossEl.innerHTML = `
            <svg class="cute-cross-svg" viewBox="0 0 48 48" fill="none">
              <path d="M14 14 L34 34 M34 14 L14 34" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          cell.appendChild(crossEl);
        } else if (state === CellState.ANIMAL) {
          const animalEl = document.createElement('div');
          animalEl.className = 'cell-animal bounce-in';
          animalEl.innerHTML = `<img src="/bull.png" class="bull-sticker-img" alt="牛头" />`;
          cell.appendChild(animalEl);
        }

        gridEl.appendChild(cell);
      }
    }

    mainArea.appendChild(gridEl);
    this.container.appendChild(mainArea);
  }

  /**
   * 为相邻不同颜色的区域赋予更显著的隔断边框
   */
  private applyRegionBorders(cell: HTMLElement, r: number, c: number, regions: number[][], size: number) {
    const curRegion = regions[r][c];
    if (r > 0 && regions[r - 1][c] !== curRegion) cell.classList.add('border-top-diff');
    if (r < size - 1 && regions[r + 1][c] !== curRegion) cell.classList.add('border-bottom-diff');
    if (c > 0 && regions[r][c - 1] !== curRegion) cell.classList.add('border-left-diff');
    if (c < size - 1 && regions[r][c + 1] !== curRegion) cell.classList.add('border-right-diff');
  }
}
