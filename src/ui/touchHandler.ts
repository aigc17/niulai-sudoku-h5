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
  private isPointerDown: boolean = false;
  private startPoint: { x: number; y: number } | null = null;
  private startCell: { row: number; col: number } | null = null;
  private dragMode: CellState | null = null;
  private isDragging: boolean = false;
  private touchedCells = new Set<string>();

  private lastTapCell: string | null = null;
  private lastTapTime: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bindEvents();
  }

  private bindEvents() {
    // 触控事件严格限定在棋盘容器内部，绝不污染全局 window（保障顶部 HUD 与弹窗 100% 原生清脆触发）
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.container.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

    // 鼠标桌面端兼容
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private getCellFromPoint(clientX: number, clientY: number): { row: number; col: number } | null {
    // 1. DOM 树快速命中
    const el = document.elementFromPoint(clientX, clientY);
    if (el) {
      const cellEl = el.closest('.board-cell') as HTMLElement | null;
      if (cellEl && cellEl.dataset.row !== undefined && cellEl.dataset.col !== undefined) {
        return {
          row: parseInt(cellEl.dataset.row, 10),
          col: parseInt(cellEl.dataset.col, 10)
        };
      }
    }

    // 2. 物理几何坐标兜底（连线解锁般 100% 极速定位）
    const gridEl = this.container.querySelector('.board-grid') as HTMLElement;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      const size = gameState.currentLevel.size;
      const col = Math.floor(((clientX - rect.left) / rect.width) * size);
      const row = Math.floor(((clientY - rect.top) / rect.height) * size);
      if (row >= 0 && row < size && col >= 0 && col < size) {
        return { row, col };
      }
    }

    return null;
  }

  private startInteraction(clientX: number, clientY: number) {
    const cell = this.getCellFromPoint(clientX, clientY);
    if (!cell) return;

    this.isPointerDown = true;
    this.isDragging = false;
    this.startPoint = { x: clientX, y: clientY };
    this.startCell = cell;
    this.touchedCells.clear();
    this.touchedCells.add(`${cell.row},${cell.col}`);

    const curState = gameState.grid[cell.row][cell.col];
    if (curState === CellState.EMPTY || curState === CellState.ANIMAL) {
      this.dragMode = CellState.CROSS; // 滑动模式：一划批量打叉 ❌
    } else if (curState === CellState.CROSS || curState === CellState.ERROR_CROSS) {
      this.dragMode = CellState.EMPTY; // 滑动模式：一划批量擦除叉叉
    }
  }

  private moveInteraction(clientX: number, clientY: number) {
    if (!this.isPointerDown || !this.startPoint || !this.startCell) return;

    const dist = Math.hypot(clientX - this.startPoint.x, clientY - this.startPoint.y);
    if (dist > 5) {
      if (!this.isDragging) {
        this.isDragging = true;
        // 进入连线解锁式滑动状态：立即对起始格子生效
        if (this.dragMode !== null && gameState.grid[this.startCell.row][this.startCell.col] !== CellState.ANIMAL) {
          gameState.setCellState(this.startCell.row, this.startCell.col, this.dragMode);
        }
      }
    }

    if (this.isDragging && this.dragMode !== null) {
      const cell = this.getCellFromPoint(clientX, clientY);
      if (!cell) return;

      const key = `${cell.row},${cell.col}`;
      if (!this.touchedCells.has(key)) {
        this.touchedCells.add(key);
        // 滑过区域批量快速打叉或清除（保护已有牛头）
        if (gameState.grid[cell.row][cell.col] !== CellState.ANIMAL) {
          gameState.setCellState(cell.row, cell.col, this.dragMode);
        }
      }
    }
  }

  private endInteraction() {
    if (!this.isPointerDown) return;

    if (!this.isDragging && this.startCell) {
      // 纯点击手势：精准触发单点画叉或双击放牛
      this.processTap(this.startCell.row, this.startCell.col);
    }

    this.isPointerDown = false;
    this.isDragging = false;
    this.startPoint = null;
    this.startCell = null;
    this.dragMode = null;
    this.touchedCells.clear();
  }

  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) return;
    const touch = e.touches[0];
    const cell = this.getCellFromPoint(touch.clientX, touch.clientY);
    if (!cell) return; // 触点不在棋盘格内，绝不拦截！让顶部 HUD 与其他按钮正常触发！
    e.preventDefault();
    this.startInteraction(touch.clientX, touch.clientY);
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.isPointerDown || e.touches.length > 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    this.moveInteraction(touch.clientX, touch.clientY);
  }

  private handleTouchEnd(e: TouchEvent) {
    if (!this.isPointerDown) return; // 非棋盘滑动，绝不拦截！保障全屏所有按钮点击即开！
    e.preventDefault();
    this.endInteraction();
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    this.startInteraction(e.clientX, e.clientY);
  }

  private handleMouseMove(e: MouseEvent) {
    this.moveInteraction(e.clientX, e.clientY);
  }

  private handleMouseUp() {
    this.endInteraction();
  }

  private processTap(r: number, c: number) {
    const now = Date.now();
    const key = `${r},${c}`;
    const current = gameState.grid[r][c];

    if (this.lastTapCell === key && now - this.lastTapTime < 350) {
      // 双击：在 (r, c) 放置牛头（严格校验正解）
      if (current === CellState.ANIMAL) {
        gameState.setCellState(r, c, CellState.EMPTY);
      } else {
        gameState.handlePlaceAnimal(r, c);
        if (gameState.user.settings.autoCross && gameState.grid[r][c] === CellState.ANIMAL) {
          gameState.autoFillCross(r, c);
        }
      }
      this.lastTapCell = null;
      this.lastTapTime = 0;
    } else {
      // 单击：排查画叉 / 清除
      if (current === CellState.EMPTY) {
        gameState.setCellState(r, c, CellState.CROSS);
      } else if (current === CellState.CROSS || current === CellState.ERROR_CROSS) {
        gameState.setCellState(r, c, CellState.EMPTY);
      } else if (current === CellState.ANIMAL) {
        gameState.setCellState(r, c, CellState.EMPTY);
      }
      this.lastTapCell = key;
      this.lastTapTime = now;
    }
  }
}
