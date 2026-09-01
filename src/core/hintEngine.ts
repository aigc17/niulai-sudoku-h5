/**
 * [INPUT]: GridCoord, CellState - 引用自 src/types.ts, PALETTE - 引用自 src/core/levels.ts, QueensSolver - 引用自 src/core/solver.ts
 * [OUTPUT]: HintEngine 动态推导提示引擎 (analyze, DeductiveHintResult)
 * [POS]: 动态逻辑提示系统核心，提供错误预测诊断、行列区域锁定推导、唯一格定位及快速应用机制
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { GridCoord, CellState } from '../types';
import { PALETTE } from './levels';
import { QueensSolver } from './solver';

export interface DeductiveHintResult {
  type: 'error' | 'row_lock' | 'col_lock' | 'single_candidate' | 'solution_step';
  message: string;
  highlightCells: { row: number; col: number; type: 'focus' | 'target' | 'warning' }[];
  apply: (grid: CellState[][], regions: number[][]) => void;
}

export class HintEngine {
  /**
   * 基于玩家当前棋盘状态与推导上下文，智能生成启发式逻辑推导提示
   */
  public static analyze(
    grid: CellState[][],
    regions: number[][],
    solution: GridCoord[]
  ): DeductiveHintResult | null {
    const size = grid.length;
    const solSet = new Set(solution.map(p => `${p.row},${p.col}`));

    // 1. 错误诊断 1：检查玩家错误放置的牛头（放置在非正解格上）
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === CellState.ANIMAL && !solSet.has(`${r},${c}`)) {
          return {
            type: 'error',
            message: '该位置放入牛头，将导致游戏无解',
            highlightCells: [{ row: r, col: c, type: 'warning' }],
            apply: (g) => {
              g[r][c] = CellState.CROSS;
            }
          };
        }
      }
    }

    // 2. 错误诊断 2：检查玩家错误用 ❌ 排除正解格
    for (const sol of solution) {
      if (grid[sol.row][sol.col] === CellState.CROSS) {
        const colorName = PALETTE[regions[sol.row][sol.col] % PALETTE.length].name;
        return {
          type: 'error',
          message: `第 ${sol.row + 1} 行第 ${sol.col + 1} 列被错误排除，此处实际应为 ${colorName} 牛头！`,
          highlightCells: [{ row: sol.row, col: sol.col, type: 'warning' }],
          apply: (g, regs) => {
            g[sol.row][sol.col] = CellState.ANIMAL;
            const autoCrosses = QueensSolver.getAutoCrossCells(sol.row, sol.col, regs);
            autoCrosses.forEach(p => {
              if (g[p.row][p.col] === CellState.EMPTY) {
                g[p.row][p.col] = CellState.CROSS;
              }
            });
          }
        };
      }
    }

    // 3. 逻辑推导：区域行锁定 / 列锁定 (Row / Column Locking)
    for (let regId = 0; regId < size; regId++) {
      let hasPlacedCow = false;
      const availableCells: GridCoord[] = [];

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === regId) {
            if (grid[r][c] === CellState.ANIMAL) hasPlacedCow = true;
            if (grid[r][c] !== CellState.CROSS) availableCells.push({ row: r, col: c });
          }
        }
      }

      if (hasPlacedCow || availableCells.length <= 1) continue;

      const colorName = PALETTE[regId % PALETTE.length].name;
      const firstRow = availableCells[0].row;
      const isAllSameRow = availableCells.every(pt => pt.row === firstRow);

      if (isAllSameRow) {
        const targets: GridCoord[] = [];
        for (let c = 0; c < size; c++) {
          if (regions[firstRow][c] !== regId && grid[firstRow][c] === CellState.EMPTY) {
            targets.push({ row: firstRow, col: c });
          }
        }
        if (targets.length > 0) {
          const highlights = [
            ...availableCells.map(pt => ({ row: pt.row, col: pt.col, type: 'focus' as const })),
            ...targets.map(pt => ({ row: pt.row, col: pt.col, type: 'target' as const }))
          ];
          return {
            type: 'row_lock',
            message: `${colorName}区域占领了第${firstRow + 1}行，因此该颜色牛头只能在第${firstRow + 1}行，将除了该行的同颜色方块排除`,
            highlightCells: highlights,
            apply: (g) => {
              targets.forEach(pt => { g[pt.row][pt.col] = CellState.CROSS; });
            }
          };
        }
      }

      const firstCol = availableCells[0].col;
      const isAllSameCol = availableCells.every(pt => pt.col === firstCol);

      if (isAllSameCol) {
        const targets: GridCoord[] = [];
        for (let r = 0; r < size; r++) {
          if (regions[r][firstCol] !== regId && grid[r][firstCol] === CellState.EMPTY) {
            targets.push({ row: r, col: firstCol });
          }
        }
        if (targets.length > 0) {
          const highlights = [
            ...availableCells.map(pt => ({ row: pt.row, col: pt.col, type: 'focus' as const })),
            ...targets.map(pt => ({ row: pt.row, col: pt.col, type: 'target' as const }))
          ];
          return {
            type: 'col_lock',
            message: `${colorName}区域占领了第${firstCol + 1}列，因此该颜色牛头只能在第${firstCol + 1}列，将除了该列的同颜色方块排除`,
            highlightCells: highlights,
            apply: (g) => {
              targets.forEach(pt => { g[pt.row][pt.col] = CellState.CROSS; });
            }
          };
        }
      }
    }

    // 4. 逻辑推导：唯一候选格锁定 (Single Candidate)
    for (let regId = 0; regId < size; regId++) {
      let hasCow = false;
      const available: GridCoord[] = [];

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === regId) {
            if (grid[r][c] === CellState.ANIMAL) hasCow = true;
            if (grid[r][c] !== CellState.CROSS) available.push({ row: r, col: c });
          }
        }
      }

      if (!hasCow && available.length === 1) {
        const target = available[0];
        const colorName = PALETTE[regId % PALETTE.length].name;
        return {
          type: 'single_candidate',
          message: `${colorName}区域只剩第${target.row + 1}行第${target.col + 1}列可放置牛头！`,
          highlightCells: [{ row: target.row, col: target.col, type: 'target' }],
          apply: (g, regs) => {
            g[target.row][target.col] = CellState.ANIMAL;
            const autoCrosses = QueensSolver.getAutoCrossCells(target.row, target.col, regs);
            autoCrosses.forEach(p => {
              if (g[p.row][p.col] === CellState.EMPTY) {
                g[p.row][p.col] = CellState.CROSS;
              }
            });
          }
        };
      }
    }

    // 5. 正解推导兜底 (Solution Step)
    for (const sol of solution) {
      if (grid[sol.row][sol.col] !== CellState.ANIMAL) {
        const colorName = PALETTE[regions[sol.row][sol.col] % PALETTE.length].name;
        return {
          type: 'solution_step',
          message: `逻辑推导锁定：第${sol.row + 1}行第${sol.col + 1}列必为${colorName}牛头！`,
          highlightCells: [{ row: sol.row, col: sol.col, type: 'target' }],
          apply: (g, regs) => {
            g[sol.row][sol.col] = CellState.ANIMAL;
            const autoCrosses = QueensSolver.getAutoCrossCells(sol.row, sol.col, regs);
            autoCrosses.forEach(p => {
              if (g[p.row][p.col] === CellState.EMPTY) {
                g[p.row][p.col] = CellState.CROSS;
              }
            });
          }
        };
      }
    }

    return null;
  }
}
