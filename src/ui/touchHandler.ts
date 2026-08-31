/**
 * [INPUT]: gameState - 引用自 src/core/state.ts, CellState - 引用自 src/types.ts
 * [OUTPUT]: TouchHandler 类 (bind, unbind)
 * [POS]: 移动端手势交互处理器，支持单指精准点击、滑动快速连划 ❌ 划叉与防误触
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { gameState } from '../core/state';
import { CellState } from '../types';

export class TouchHandler {
  private container: HTMLElement;
  private isDragging: boolean = false;
  private startCell: { row: number; col: number } | null = null;
  private dragMode: CellState | null = null;
  private touchedCells = new Set<string>();

  constructor(container: HTMLElement) {
    this.container = container;
    this.bindEvents();
  }

  private bindEvents() {
    // 阻止移动端页面橡皮筋滚动与缩放
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

    // 鼠标桌面端兼容
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private getCellFromPoint(clientX: number, clientY: number): { row: number; col: number } | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cellEl = el.closest('.board-cell') as HTMLElement | null;
    if (!cellEl || cellEl.dataset.row === undefined || cellEl.dataset.col === undefined) return null;

    return {
      row: parseInt(cellEl.dataset.row, 10),
      col: parseInt(cellEl.dataset.col, 10)
    };
  }

  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    const cell = this.getCellFromPoint(touch.clientX, touch.clientY);
    if (!cell) return;

    this.isDragging = true;
    this.startCell = cell;
    this.touchedCells.clear();
    this.touchedCells.add(`${cell.row},${cell.col}`);
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.isDragging || e.touches.length > 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    const cell = this.getCellFromPoint(touch.clientX, touch.clientY);
    if (!cell) return;

    const key = `${cell.row},${cell.col}`;
    if (!this.touchedCells.has(key)) {
      this.touchedCells.add(key);

      // 滑动多选模式：在滑过的空白格上连续填充 ❌
      if (this.dragMode === null) {
        this.dragMode = CellState.CROSS;
      }

      if (gameState.grid[cell.row][cell.col] === CellState.EMPTY) {
        gameState.setCellState(cell.row, cell.col, CellState.CROSS, false);
      }
    }
  }

  private lastTapCell: string | null = null;
  private lastTapTime: number = 0;

  private handleTouchEnd(e: TouchEvent) {
    if (!this.isDragging) return;
    e.preventDefault();

    if (this.touchedCells.size <= 1 && this.startCell) {
      this.processTap(this.startCell.row, this.startCell.col);
    }

    this.isDragging = false;
    this.startCell = null;
    this.dragMode = null;
    this.touchedCells.clear();
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const cell = this.getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    this.isDragging = true;
    this.startCell = cell;
    this.touchedCells.clear();
    this.touchedCells.add(`${cell.row},${cell.col}`);
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const cell = this.getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    const key = `${cell.row},${cell.col}`;
    if (!this.touchedCells.has(key)) {
      this.touchedCells.add(key);
      if (gameState.grid[cell.row][cell.col] === CellState.EMPTY) {
        gameState.setCellState(cell.row, cell.col, CellState.CROSS, false);
      }
    }
  }

  private handleMouseUp() {
    if (!this.isDragging) return;
    if (this.touchedCells.size <= 1 && this.startCell) {
      this.processTap(this.startCell.row, this.startCell.col);
    }
    this.isDragging = false;
    this.startCell = null;
    this.touchedCells.clear();
  }

  private processTap(r: number, c: number) {
    const now = Date.now();
    const key = `${r},${c}`;
    const current = gameState.grid[r][c];

    if (this.lastTapCell === key && now - this.lastTapTime < 300) {
      // Double tap -> Place/Remove Animal
      if (current === CellState.ANIMAL) {
        gameState.setCellState(r, c, CellState.EMPTY);
      } else {
        gameState.setCellState(r, c, CellState.ANIMAL);
        if (gameState.user.settings.autoCross) {
          // hack to trigger auto-cross
          (gameState as any).autoFillCross?.(r, c);
        }
      }
      this.lastTapCell = null;
      this.lastTapTime = 0;
    } else {
      // Single tap -> Toggle Cross
      if (current === CellState.EMPTY) {
        gameState.setCellState(r, c, CellState.CROSS);
      } else if (current === CellState.CROSS) {
        gameState.setCellState(r, c, CellState.EMPTY);
      } else if (current === CellState.ANIMAL) {
        // If it's already an animal, a single tap could either do nothing or remove it.
        // Let's make single tap on animal remove it for better UX, or wait for double tap.
        // For safety, single tap on animal removes it.
        gameState.setCellState(r, c, CellState.EMPTY);
      }
      this.lastTapCell = key;
      this.lastTapTime = now;
    }
  }
}
