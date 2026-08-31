/**
 * [INPUT]: GridCoord, LevelData - 引用自 src/types.ts, QueensSolver - 引用自 src/core/solver.ts
 * [OUTPUT]: LevelGenerator 生成器类 (generateUniqueLevel)；失败时交出强制唯一解盘，禁止无解/多解兜底
 * [POS]: 程序化关卡生成器，基于图着色与多源洪泛算法生成保证唯一解的关卡
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { GridCoord, LevelData } from '../types';
import { QueensSolver } from './solver';

export class LevelGenerator {
  /**
   * 基于关卡 ID 确定性伪随机数生成器 (Mulberry32 PRNG)
   * 确保第 N 关在任何时间、任何设备上生成的地图 100% 相同且具有严格唯一正解与逻辑破局点
   */
  public static generateUniqueLevel(levelId: number, size: number = 7, maxAttempts?: number): LevelData {
    const isEarlyTutorial = levelId <= 10; // 1~10 关强制生成 100% 独立单格单色突破口
    const requireAnchor = true;           // 全量关卡标配“破局点生成器”，绝不刁难玩家
    // 前 350 次种子与旧版完全一致，已生成成功的关卡盘面不变；大棋盘追加尝试以免掉进兜底
    const attempts = maxAttempts ?? (size >= 10 ? 1500 : size >= 9 ? 900 : 350);

    for (let attempt = 0; attempt < attempts; attempt++) {
      const seed = (levelId * 10007 + attempt * 269) >>> 0;
      const rng = this.createRNG(seed);

      // 1. 生成满足 8 邻域互斥约束的合法目标牛头分布
      const targetQueens = this.generateValidQueens(size, rng);
      if (!targetQueens) continue;

      // 2. 以牛头为种子进行多源洪泛划分连通区域（注入破局点）
      const regions = this.partitionBoard(size, targetQueens, rng, isEarlyTutorial, requireAnchor);

      // 3. 验证唯一解性 (CSP 约束求解器)
      const solutions = QueensSolver.solve(regions, 2);
      if (solutions.length === 1) {
        return {
          id: levelId,
          size,
          regions,
          solution: solutions[0],
          name: `第 ${levelId} 关`,
          targetCount: size,
          initialTime: Math.min(150 + size * 20, 360)
        };
      }
    }

    return this.getFallbackLevel(levelId, size);
  }

  private static createRNG(seed: number): () => number {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private static generateValidQueens(size: number, rng: () => number): GridCoord[] | null {
    const queens: GridCoord[] = [];
    const cols = Array.from({ length: size }, (_, i) => i);

    function backtrack(row: number): boolean {
      if (row === size) return true;

      const shuffledCols = [...cols].sort(() => rng() - 0.5);

      for (const col of shuffledCols) {
        let safe = true;
        for (const q of queens) {
          if (q.col === col || QueensSolver.isAdjacent(q, { row, col })) {
            safe = false;
            break;
          }
        }
        if (safe) {
          queens.push({ row, col });
          if (backtrack(row + 1)) return true;
          queens.pop();
        }
      }
      return false;
    }

    return backtrack(0) ? queens : null;
  }

  /**
   * 连通区域划分算法：注入“破局点”机制，保证 1~10 关拥有独立单格，高难关卡拥有狭管突破口
   */
  private static partitionBoard(
    size: number,
    seeds: GridCoord[],
    rng: () => number,
    isEarlyTutorial: boolean,
    requireAnchor: boolean
  ): number[][] {
    const regions: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    const queue: { row: number; col: number; region: number }[] = [];

    // 若为 1~10 关，固定第 0 个种子绝不扩散（严格保持 size = 1 单格独占）
    // 若为高级关卡，随机选 1 个种子作为狭管突破口
    const isolatedSeedIdx = isEarlyTutorial ? 0 : (requireAnchor ? Math.floor(rng() * seeds.length) : -1);

    seeds.forEach((seed, regionId) => {
      regions[seed.row][seed.col] = regionId;
      if (regionId !== isolatedSeedIdx) {
        queue.push({ row: seed.row, col: seed.col, region: regionId });
      }
    });

    const dirs = [
      { r: -1, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: -1 },
      { r: 0, c: 1 }
    ];

    while (queue.length > 0) {
      const randIdx = Math.floor(rng() * queue.length);
      const cur = queue.splice(randIdx, 1)[0];

      const shuffledDirs = [...dirs].sort(() => rng() - 0.5);
      for (const d of shuffledDirs) {
        const nr = cur.row + d.r;
        const nc = cur.col + d.c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
          regions[nr][nc] = cur.region;
          queue.push({ row: nr, col: nc, region: cur.region });
        }
      }
    }

    // 洪泛未覆盖的空洞禁止带着 regionId = -1 进入求解器
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] !== -1) continue;
        let filled = false;
        for (const d of dirs) {
          const nr = r + d.r;
          const nc = c + d.c;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] >= 0) {
            regions[r][c] = regions[nr][nc];
            filled = true;
            break;
          }
        }
        if (!filled) regions[r][c] = 0;
      }
    }

    return regions;
  }

  /**
   * 确定性回溯：在无 RNG 打乱时找出一组合法牛头坐标（每行每列 1 个、8 邻域不互邻）
   */
  private static constructValidQueens(size: number): GridCoord[] | null {
    const queens: GridCoord[] = [];
    const usedCols = new Array<boolean>(size).fill(false);

    const backtrack = (row: number): boolean => {
      if (row === size) return true;
      for (let col = 0; col < size; col++) {
        if (usedCols[col]) continue;
        let safe = true;
        for (const q of queens) {
          if (QueensSolver.isAdjacent(q, { row, col })) {
            safe = false;
            break;
          }
        }
        if (!safe) continue;
        usedCols[col] = true;
        queens.push({ row, col });
        if (backtrack(row + 1)) return true;
        queens.pop();
        usedCols[col] = false;
      }
      return false;
    };

    return backtrack(0) ? queens : null;
  }

  /**
   * 强制唯一解构造：第 0 头牛所在区域吞下所有非种子格，其余种子格保持单格区域。
   * n-1 个单格颜色强制占住对应行列，剩余交叉点唯一，因此解集大小恒为 1。
   */
  private static forcedUniqueRegions(size: number, queens: GridCoord[]): number[][] {
    const regions: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    queens.forEach((q, regionId) => {
      regions[q.row][q.col] = regionId;
    });
    return regions;
  }

  /**
   * 生成失败时的保底盘：禁止再交出 (r+c)%n 那种偶边长无解、奇边长多解的废图
   */
  private static getFallbackLevel(id: number, size: number): LevelData {
    let queens: GridCoord[] | null = null;
    for (let i = 0; i < 400; i++) {
      queens = this.generateValidQueens(size, this.createRNG((id * 104729 + i * 9176) >>> 0));
      if (queens) break;
    }
    if (!queens) queens = this.constructValidQueens(size);

    const regions = this.forcedUniqueRegions(size, queens ?? []);
    const solutions = QueensSolver.solve(regions, 2);

    return {
      id,
      size,
      regions,
      solution: solutions[0] ?? queens ?? [],
      name: `第 ${id} 关`,
      targetCount: size,
      initialTime: Math.min(150 + size * 20, 360)
    };
  }
}
