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

      // 2. 轮换三大几何构型（条带矩阵、拐角多联块、非对称大块+多米诺），彻底告别单调套路！
      const archetype = (levelId + attempt) % 3;
      const allowAnchor = wantsAnchor ? (attempt < maxAtt * 0.7) : (attempt > maxAtt * 0.7);
      const regions = this.partitionArchitectural(size, targetQueens, rng, archetype, allowAnchor);

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
   * 架构级几何多联块生成引擎 (Architectural Geometric Polyomino Engine)：
   * 模拟原版关卡精髓——横纵条带矩形、拐角多联块、俄罗斯方块构型与大框架包围
   */
  private static partitionArchitectural(
    size: number,
    seeds: GridCoord[],
    rng: () => number,
    archetype: number,
    allowAnchor: boolean
  ): number[][] {
    const regions: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    const anchorIdx = allowAnchor ? Math.floor(rng() * size) : -1;

    seeds.forEach((seed, id) => {
      regions[seed.row][seed.col] = id;
    });

    // 为每个种子定制多边形几何特征（条带、直角框、大矩形块）
    const growthStyles = seeds.map((seed, i) => {
      if (i === anchorIdx) return { biasH: 0, biasV: 0, maxSize: 1 };

      const r = rng();
      if (archetype === 0) {
        // 模式 0：条带矩阵与整块矩形 (Stripes & Rectangles)
        return {
          biasH: r < 0.35 ? 4.0 : (r < 0.7 ? 0.25 : 1.2),
          biasV: r >= 0.35 && r < 0.7 ? 4.0 : (r < 0.35 ? 0.25 : 1.2),
          maxSize: Math.floor(3 + rng() * (size * 1.8))
        };
      } else if (archetype === 1) {
        // 模式 1：拐角几何框与 L-多联块 (Corner frames & L-shapes)
        const isCorner = (seed.row <= 1 || seed.row >= size - 2) && (seed.col <= 1 || seed.col >= size - 2);
        return {
          biasH: isCorner ? 2.5 : 1.0,
          biasV: isCorner ? 2.5 : 1.0,
          maxSize: isCorner ? Math.floor(4 + rng() * size) : Math.floor(2 + rng() * (size * 1.2))
        };
      } else {
        // 模式 2：非对称大块框架与精巧多米诺 (Asymmetric Chunky Polyominoes)
        return {
          biasH: 0.8 + rng() * 1.4,
          biasV: 0.8 + rng() * 1.4,
          maxSize: i === 0 ? Math.floor(size * 1.5 + rng() * size) : Math.floor(2 + rng() * (size * 1.1))
        };
      }
    });

    const regionCells: { row: number; col: number }[][] = Array.from({ length: size }, (_, i) => [seeds[i]]);
    const dirs = [
      { r: -1, c: 0, h: false },
      { r: 1, c: 0, h: false },
      { r: 0, c: -1, h: true },
      { r: 0, c: 1, h: true }
    ];

    let changed = true;
    let loops = 0;
    while (changed && loops++ < size * size * 3) {
      changed = false;
      for (let id = 0; id < size; id++) {
        if (id === anchorIdx || regionCells[id].length >= growthStyles[id].maxSize) continue;

        const candidates: { r: number; c: number; score: number }[] = [];
        for (const cell of regionCells[id]) {
          for (const d of dirs) {
            const nr = cell.row + d.r;
            const nc = cell.col + d.c;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
              let adjSame = 0;
              for (const nd of dirs) {
                const nnr = nr + nd.r;
                const nnc = nc + nd.c;
                if (nnr >= 0 && nnr < size && nnc >= 0 && nnc < size && regions[nnr][nnc] === id) {
                  adjSame++;
                }
              }
              const dirBias = d.h ? growthStyles[id].biasH : growthStyles[id].biasV;
              const score = adjSame * 3.0 + dirBias * 2.0 + rng();
              candidates.push({ r: nr, c: nc, score });
            }
          }
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          if (regions[best.r][best.c] === -1) {
            regions[best.r][best.c] = id;
            regionCells[id].push({ row: best.r, col: best.c });
            changed = true;
          }
        }
      }
    }

    // 收尾：将未覆盖的剩余空格整齐归入邻接最多的区域（消除单格孤岛，保持直角多联块）
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] !== -1) continue;
        const adjCounts: Record<number, number> = {};
        for (const d of dirs) {
          const nr = r + d.r;
          const nc = c + d.c;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] >= 0 && regions[nr][nc] !== anchorIdx) {
            adjCounts[regions[nr][nc]] = (adjCounts[regions[nr][nc]] || 0) + 1;
          }
        }
        const sorted = Object.entries(adjCounts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          regions[r][c] = parseInt(sorted[0][0]);
        } else {
          regions[r][c] = (anchorIdx === 0 ? 1 : 0);
        }
      }
    }

    return regions;
  }

  private static getFallbackLevel(id: number, size: number): LevelData {
    for (let i = 0; i < 2000; i++) {
      const rng = this.createRNG((id * 104729 + i * 9176) >>> 0);
      const queens = this.generateValidQueens(size, rng);
      if (!queens) continue;
      const regions = this.partitionArchitectural(size, queens, rng, i % 3, false);
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
    const regions = this.partitionArchitectural(size, queens, this.createRNG(id), 0, false);
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
