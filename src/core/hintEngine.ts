/**
 * [INPUT]: GridCoord, CellState - 引用自 src/types.ts, PALETTE - 引用自 src/core/levels.ts, QueensSolver - 引用自 src/core/solver.ts
 * [OUTPUT]: HintEngine 动态推导提示引擎 (analyze, DeductiveHintResult)
 * [POS]: 动态逻辑提示系统核心，提供错误预测诊断、行列区域锁定推导、唯一格定位、反证排查及快速应用机制
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
   * 基于玩家当前棋盘状态与推导上下文，智能生成深度逻辑推导与原因剖析提示
   */
  public static analyze(
    grid: CellState[][],
    regions: number[][],
    solution: GridCoord[]
  ): DeductiveHintResult | null {
    const size = grid.length;
    const solSet = new Set(solution.map(p => `${p.row},${p.col}`));

    // ─────────────────────────────────────────────────────────
    // 1. 错误诊断 1：错放牛头检测 (Placed wrong animal)
    // ─────────────────────────────────────────────────────────
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === CellState.ANIMAL && !solSet.has(`${r},${c}`)) {
          const colorName = PALETTE[regions[r][c] % PALETTE.length].name;
          return {
            type: 'error',
            message: `第 ${r + 1} 行第 ${c + 1} 列放入${colorName}小牛导致冲突/无解，建议移除或改打 ❌`,
            highlightCells: [{ row: r, col: c, type: 'warning' }],
            apply: (g) => {
              g[r][c] = CellState.CROSS;
            }
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 2. 错误诊断 2：误判排除检测 (Wrong cross on solution cow)
    // ─────────────────────────────────────────────────────────
    for (const sol of solution) {
      if (grid[sol.row][sol.col] === CellState.CROSS) {
        const colorName = PALETTE[regions[sol.row][sol.col] % PALETTE.length].name;
        return {
          type: 'error',
          message: `第 ${sol.row + 1} 行第 ${sol.col + 1} 列被误判排除，实际上此处正是 ${colorName} 牛头的正解位置！`,
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

    // ─────────────────────────────────────────────────────────
    // 3. 已有牛头的未排除邻域/行列快速排查 (Exclusions around placed cows)
    // ─────────────────────────────────────────────────────────
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === CellState.ANIMAL) {
          const uncrossedAffected = QueensSolver.getAutoCrossCells(r, c, regions).filter(
            p => grid[p.row][p.col] === CellState.EMPTY
          );
          if (uncrossedAffected.length > 0) {
            return {
              type: 'row_lock',
              message: `第 ${r + 1} 行第 ${c + 1} 列已有牛头，其同行、同列、同色及 8 邻域不可再放牛，一并排除 ❌`,
              highlightCells: [
                { row: r, col: c, type: 'focus' },
                ...uncrossedAffected.map(p => ({ row: p.row, col: p.col, type: 'target' as const }))
              ],
              apply: (g) => {
                uncrossedAffected.forEach(p => { g[p.row][p.col] = CellState.CROSS; });
              }
            };
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 4. 区域行列锁定指向性推导 (Row / Column Locking Deduction)
    // ─────────────────────────────────────────────────────────
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
            message: `${colorName}区域全部位于第 ${firstRow + 1} 行，因此该行其余异色方块无法再放牛头，全部排除 ❌`,
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
            message: `${colorName}区域全部位于第 ${firstCol + 1} 列，因此该列其余异色方块无法再放牛头，全部排除 ❌`,
            highlightCells: highlights,
            apply: (g) => {
              targets.forEach(pt => { g[pt.row][pt.col] = CellState.CROSS; });
            }
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 5. 唯一剩余候选格推导 (Single Candidate in Region / Row / Col)
    // ─────────────────────────────────────────────────────────
    // 5.1 色块区域唯一格
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
          message: `${colorName}区域目前仅剩第 ${target.row + 1} 行第 ${target.col + 1} 列未被排除，此处必放牛头！`,
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

    // 5.2 整行唯一格
    for (let r = 0; r < size; r++) {
      let hasCow = false;
      const available: GridCoord[] = [];
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === CellState.ANIMAL) hasCow = true;
        if (grid[r][c] !== CellState.CROSS) available.push({ row: r, col: c });
      }
      if (!hasCow && available.length === 1) {
        const target = available[0];
        const colorName = PALETTE[regions[target.row][target.col] % PALETTE.length].name;
        return {
          type: 'single_candidate',
          message: `第 ${r + 1} 行目前仅剩第 ${target.col + 1} 列一个空格，根据每行必有一头牛的规则，此处必放 ${colorName} 牛头！`,
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

    // 5.3 整列唯一格
    for (let c = 0; c < size; c++) {
      let hasCow = false;
      const available: GridCoord[] = [];
      for (let r = 0; r < size; r++) {
        if (grid[r][c] === CellState.ANIMAL) hasCow = true;
        if (grid[r][c] !== CellState.CROSS) available.push({ row: r, col: c });
      }
      if (!hasCow && available.length === 1) {
        const target = available[0];
        const colorName = PALETTE[regions[target.row][target.col] % PALETTE.length].name;
        return {
          type: 'single_candidate',
          message: `第 ${c + 1} 列目前仅剩第 ${target.row + 1} 行一个空格，根据每列必有一头牛的规则，此处必放 ${colorName} 牛头！`,
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

    // ─────────────────────────────────────────────────────────
    // 6. 假设反证排查与深层逻辑归纳 (Hypothesis Contradiction & Deep Deduction)
    // ─────────────────────────────────────────────────────────
    for (const sol of solution) {
      if (grid[sol.row][sol.col] === CellState.ANIMAL) continue;
      const regId = regions[sol.row][sol.col];
      const colorName = PALETTE[regId % PALETTE.length].name;

      // 寻找该色块中除正解外的其他未排除候选点
      const otherCandidates: GridCoord[] = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === regId && (r !== sol.row || c !== sol.col) && grid[r][c] !== CellState.CROSS) {
            otherCandidates.push({ row: r, col: c });
          }
        }
      }

      // 尝试模拟放入其他候选点，找出为何会导致矛盾
      for (const other of otherCandidates) {
        const testGrid = grid.map(row => [...row]);
        testGrid[other.row][other.col] = CellState.ANIMAL;
        const autoCrosses = QueensSolver.getAutoCrossCells(other.row, other.col, regions);
        autoCrosses.forEach(p => { testGrid[p.row][p.col] = CellState.CROSS; });

        // 检查是否导致某行/某列无处落子
        for (let r = 0; r < size; r++) {
          let rowHasValid = false;
          for (let c = 0; c < size; c++) {
            if (testGrid[r][c] !== CellState.CROSS) rowHasValid = true;
          }
          if (!rowHasValid) {
            return {
              type: 'solution_step',
              message: `在${colorName}区域中，若在第 ${other.row + 1} 行第 ${other.col + 1} 列放牛，会导致第 ${r + 1} 行无处落子；因此正解必须是第 ${sol.row + 1} 行第 ${sol.col + 1} 列！`,
              highlightCells: [
                { row: other.row, col: other.col, type: 'warning' },
                { row: sol.row, col: sol.col, type: 'target' }
              ],
              apply: (g, regs) => {
                g[sol.row][sol.col] = CellState.ANIMAL;
                const autoX = QueensSolver.getAutoCrossCells(sol.row, sol.col, regs);
                autoX.forEach(p => {
                  if (g[p.row][p.col] === CellState.EMPTY) g[p.row][p.col] = CellState.CROSS;
                });
              }
            };
          }
        }

        // 检查是否导致某列无处落子
        for (let c = 0; c < size; c++) {
          let colHasValid = false;
          for (let r = 0; r < size; r++) {
            if (testGrid[r][c] !== CellState.CROSS) colHasValid = true;
          }
          if (!colHasValid) {
            return {
              type: 'solution_step',
              message: `在${colorName}区域中，若在第 ${other.row + 1} 行第 ${other.col + 1} 列放牛，会导致第 ${c + 1} 列无处落子；因此正解必须是第 ${sol.row + 1} 行第 ${sol.col + 1} 列！`,
              highlightCells: [
                { row: other.row, col: other.col, type: 'warning' },
                { row: sol.row, col: sol.col, type: 'target' }
              ],
              apply: (g, regs) => {
                g[sol.row][sol.col] = CellState.ANIMAL;
                const autoX = QueensSolver.getAutoCrossCells(sol.row, sol.col, regs);
                autoX.forEach(p => {
                  if (g[p.row][p.col] === CellState.EMPTY) g[p.row][p.col] = CellState.CROSS;
                });
              }
            };
          }
        }
      }

      // 宏观行列与色块综合排查说明
      return {
        type: 'solution_step',
        message: `【行列排查】${colorName}区域经行、列与色块排查，仅在第 ${sol.row + 1} 行第 ${sol.col + 1} 列落子时能同时满足不相邻与全局唯一解约束！`,
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

    return null;
  }
}
