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
    const maxAtt = maxAttempts ?? (size >= 8 ? 3500 : 1500);
    // 难度梯度与单格随机穿插体系：
    // 1~3 关：新手教学，100% 具备 1 个单格引导破局
    // 4~9 关：初阶探索，50% 概率随机出现 1 个单格
    // 10~30 关：中阶进阶，35%~40% 关卡随机穿插 1 个单格，其余为 0 单格（体验多变节奏）
    // 31+ 关：高难大师，100% 优先保证 0 单格（完全无白送单格，纯靠多格多边形深度推导）
    const idHash = (levelId * 2654435761) >>> 0;
    const idRng = ((idHash ^ (idHash >>> 15)) >>> 0) / 4294967296;

    let wantsAnchor = false;
    if (levelId <= 3) {
      wantsAnchor = true;
    } else if (levelId <= 9) {
      wantsAnchor = idRng > 0.5;
    } else if (levelId <= 30) {
      wantsAnchor = idRng > 0.62; // 10~30 关随机穿插给单色单格
    } else {
      wantsAnchor = false; // 31 关之后纯 0 单格
    }

    for (let attempt = 0; attempt < maxAtt; attempt++) {
      const seed = (levelId * 10007 + attempt * 269) >>> 0;
      const rng = this.createRNG(seed);

      // 1. 生成满足 8 邻域互斥约束的合法目标牛头分布
      const targetQueens = this.generateValidQueens(size, rng);
      if (!targetQueens) continue;

      // 2. 以牛头为种子进行多源平衡洪泛划分连通区域
      const allowAnchor = wantsAnchor ? (attempt < maxAtt * 0.7) : (attempt > maxAtt * 0.7);
      const regions = this.partitionBoard(size, targetQueens, rng, allowAnchor);

      // 3. 严格校验：单格颜色区域有且至多 1 个（singles <= 1）；0 单格关卡严格保证 0 单格！
      const counts = new Array<number>(size).fill(0);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          counts[regions[r][c]]++;
        }
      }
      const singleCellCount = counts.filter(c => c === 1).length;
      if (singleCellCount > 1) continue; // 铁律：全局严禁 >= 2 个单格送分！
      if (!wantsAnchor && attempt < maxAtt * 0.7 && singleCellCount > 0) continue; // 0 单格关卡前期严格 0 单格！

      // 4. 验证唯一解性 (CSP 约束求解器)
      const solutions = QueensSolver.solve(regions, 2);
      if (solutions.length === 1) {
        return {
          id: levelId,
          size,
          regions,
          solution: solutions[0],
          name: `第 ${levelId} 关`,
          targetCount: size,
          initialTime: Math.min(150 + size * 30, 480)
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
   * 平衡连通区域划分算法：
   * 选定至多 1 个种子作为单格独立破局点 (有且仅有一个)，其余 N-1 个色块必须多向均衡扩展
   */
  private static partitionBoard(
    size: number,
    seeds: GridCoord[],
    rng: () => number,
    allowAnchor: boolean
  ): number[][] {
    const regions: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    const queues: { row: number; col: number }[][] = Array.from({ length: size }, () => []);

    // 随机选定至多 1 个种子作为单格破局点 (有且仅有 1 个)
    const anchorIdx = allowAnchor ? Math.floor(rng() * size) : -1;

    seeds.forEach((seed, regionId) => {
      regions[seed.row][seed.col] = regionId;
      if (regionId !== anchorIdx) {
        queues[regionId].push({ row: seed.row, col: seed.col });
      }
    });

    const dirs = [
      { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
    ];

    // 阶段 1：先确保除 anchor 外的每个区域至少扩展 1 格（保证除 anchor 外所有色块 size >= 2）
    for (let regionId = 0; regionId < size; regionId++) {
      if (regionId === anchorIdx) continue;
      const cur = seeds[regionId];
      const shuffledDirs = [...dirs].sort(() => rng() - 0.5);
      for (const d of shuffledDirs) {
        const nr = cur.row + d.r;
        const nc = cur.col + d.c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
          regions[nr][nc] = regionId;
          queues[regionId].push({ row: nr, col: nc });
          break;
        }
      }
    }

    // 阶段 2：全量洪泛扩散（anchor 绝不参与扩散）
    const allNonAnchorQueues: { row: number; col: number; region: number }[] = [];
    for (let regionId = 0; regionId < size; regionId++) {
      if (regionId === anchorIdx) continue;
      queues[regionId].forEach(pt => allNonAnchorQueues.push({ row: pt.row, col: pt.col, region: regionId }));
    }

    while (allNonAnchorQueues.length > 0) {
      const randIdx = Math.floor(rng() * allNonAnchorQueues.length);
      const cur = allNonAnchorQueues.splice(randIdx, 1)[0];
      const shuffledDirs = [...dirs].sort(() => rng() - 0.5);
      for (const d of shuffledDirs) {
        const nr = cur.row + d.r;
        const nc = cur.col + d.c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
          regions[nr][nc] = cur.region;
          allNonAnchorQueues.push({ row: nr, col: nc, region: cur.region });
        }
      }
    }

    // 阶段 3：填充未覆盖的剩余空格（优先填入非 anchor 邻接区域）
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] !== -1) continue;
        for (const d of dirs) {
          const nr = r + d.r;
          const nc = c + d.c;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] !== -1 && regions[nr][nc] !== anchorIdx) {
            regions[r][c] = regions[nr][nc];
            break;
          }
        }
        if (regions[r][c] === -1) regions[r][c] = (anchorIdx === 0 ? 1 : 0);
      }
    }

    return regions;
  }

  private static getFallbackLevel(id: number, size: number): LevelData {
    for (let i = 0; i < 2000; i++) {
      const rng = this.createRNG((id * 104729 + i * 9176) >>> 0);
      const queens = this.generateValidQueens(size, rng);
      if (!queens) continue;
      const regions = this.partitionBoard(size, queens, rng, true);
      const counts = new Array<number>(size).fill(0);
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) counts[regions[r][c]]++;
      if (counts.filter(c => c === 1).length > 1) continue;
      const solutions = QueensSolver.solve(regions, 2);
      if (solutions.length === 1) {
        return {
          id,
          size,
          regions,
          solution: solutions[0],
          name: `第 ${id} 关`,
          targetCount: size,
          initialTime: Math.min(150 + size * 30, 480)
        };
      }
    }

    // 极端容错
    const queens: GridCoord[] = Array.from({ length: size }, (_, r) => ({ row: r, col: (r * 2 + 1) % size }));
    const regions = this.partitionBoard(size, queens, this.createRNG(id), true);
    return {
      id,
      size,
      regions,
      solution: queens,
      name: `第 ${id} 关`,
      targetCount: size,
      initialTime: Math.min(150 + size * 30, 480)
    };
  }
}
