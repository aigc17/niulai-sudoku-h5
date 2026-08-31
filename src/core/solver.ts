/**
 * [INPUT]: GridCoord, CellState, ConflictInfo, ConflictType - 引用自 src/types.ts
 * [OUTPUT]: QueensSolver 求解器类 (solve, isUnique, findConflicts, getSmartHint, getAutoCrossCells)
 * [POS]: 核心数学求解器与规则引擎，提供 CSP 回溯推理、冲突检测及唯一解判定
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { GridCoord, CellState, ConflictInfo } from '../types';

export class QueensSolver {
  /**
   * 检查两个位置是否 8-邻域相邻 (包含对角线)
   */
  public static isAdjacent(a: GridCoord, b: GridCoord): boolean {
    return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;
  }

  /**
   * 检查当前棋盘上所有已放置小马的冲突 (行、列、颜色区域、8邻域相邻)
   */
  public static findConflicts(grid: CellState[][], regions: number[][]): ConflictInfo[] {
    const size = grid.length;
    const placed: GridCoord[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === CellState.ANIMAL) {
          placed.push({ row: r, col: c });
        }
      }
    }

    const conflicts: ConflictInfo[] = [];

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const p1 = placed[i];
        const p2 = placed[j];

        // 1. 同行冲突
        if (p1.row === p2.row) {
          conflicts.push({ type: 'ROW', coords: [p1, p2] });
        }
        // 2. 同列冲突
        if (p1.col === p2.col) {
          conflicts.push({ type: 'COL', coords: [p1, p2] });
        }
        // 3. 同颜色区域冲突
        if (regions[p1.row][p1.col] === regions[p2.row][p2.col]) {
          conflicts.push({ type: 'REGION', coords: [p1, p2] });
        }
        // 4. 8邻域相邻冲突
        if (this.isAdjacent(p1, p2)) {
          conflicts.push({ type: 'ADJACENT', coords: [p1, p2] });
        }
      }
    }

    return conflicts;
  }

  /**
   * CSP 回溯求解器：查找所有有效解
   * @param regions 颜色区域矩阵
   * @param maxSolutions 查找到指定数量解后提前返回 (用于快速判定多解/唯一解)
   */
  public static solve(regions: number[][], maxSolutions: number = 2): GridCoord[][] {
    const size = regions.length;
    const solutions: GridCoord[][] = [];
    const queens: GridCoord[] = [];

    const usedCols = new Array<boolean>(size).fill(false);
    const usedRegions = new Array<boolean>(size).fill(false);

    function isSafe(r: number, c: number): boolean {
      if (usedCols[c]) return false;
      const reg = regions[r][c];
      if (usedRegions[reg]) return false;

      // 检查是否与已放置的皇后 8 邻域冲突 (只需检查上一行及对角)
      for (const q of queens) {
        if (QueensSolver.isAdjacent(q, { row: r, col: c })) {
          return false;
        }
      }
      return true;
    }

    function backtrack(row: number) {
      if (row === size) {
        solutions.push([...queens]);
        return;
      }

      for (let col = 0; col < size; col++) {
        if (isSafe(row, col)) {
          const reg = regions[row][col];
          usedCols[col] = true;
          usedRegions[reg] = true;
          queens.push({ row, col });

          backtrack(row + 1);

          queens.pop();
          usedCols[col] = false;
          usedRegions[reg] = false;

          if (solutions.length >= maxSolutions) {
            return;
          }
        }
      }
    }

    backtrack(0);
    return solutions;
  }

  /**
   * 判定关卡是否有且仅有唯一解
   */
  public static isUnique(regions: number[][]): boolean {
    const solutions = this.solve(regions, 2);
    return solutions.length === 1;
  }

  /**
   * 当在 (r, c) 放置小马后，计算需要自动标记为 ❌ 的影响格子
   */
  public static getAutoCrossCells(r: number, c: number, regions: number[][]): GridCoord[] {
    const size = regions.length;
    const myRegion = regions[r][c];
    const crossMap = new Set<string>();

    // 1. 同行
    for (let col = 0; col < size; col++) {
      if (col !== c) crossMap.add(`${r},${col}`);
    }
    // 2. 同列
    for (let row = 0; row < size; row++) {
      if (row !== r) crossMap.add(`${row},${c}`);
    }
    // 3. 同颜色区域
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (row === r && col === c) continue;
        if (regions[row][col] === myRegion) {
          crossMap.add(`${row},${col}`);
        }
      }
    }
    // 4. 8 邻域
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !(nr === r && nc === c)) {
          crossMap.add(`${nr},${nc}`);
        }
      }
    }

    return Array.from(crossMap).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  }

  /**
   * 智能提示道具 (💡)：返回正解中尚未被填入的小马坐标
   */
  public static getSmartHint(grid: CellState[][], regions: number[][]): GridCoord | null {
    const solutions = this.solve(regions, 1);
    if (solutions.length === 0) return null;

    const solution = solutions[0];
    // 寻找未放置小马的正解格
    for (const pos of solution) {
      if (grid[pos.row][pos.col] !== CellState.ANIMAL) {
        return pos;
      }
    }
    return null;
  }

  /**
   * 探照排查道具 (🔍)：自动排查并找出可以安全填入 ❌ 的逻辑确定格
   */
  public static getDetectorExclusions(grid: CellState[][], regions: number[][]): GridCoord[] {
    const solutions = this.solve(regions, 1);
    if (solutions.length === 0) return [];

    const solution = solutions[0];
    const solutionSet = new Set(solution.map(p => `${p.row},${p.col}`));
    const size = regions.length;
    const candidates: GridCoord[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === CellState.EMPTY && !solutionSet.has(`${r},${c}`)) {
          candidates.push({ row: r, col: c });
        }
      }
    }

    // 取前 3~5 个安全排除格
    return candidates.slice(0, Math.min(candidates.length, 4));
  }
}
