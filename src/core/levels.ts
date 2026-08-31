/**
 * [INPUT]: LevelData, PaletteColor - 引用自 src/types.ts, LevelGenerator - 引用自 src/core/generator.ts
 * [OUTPUT]: PRESET_LEVELS (精选关卡库), PALETTE (马卡龙调色板), getLevelById (按关卡号获取或生成，出口强制唯一解)
 * [POS]: 关卡题库与美学色板中心，包含 100% 复刻原图的第 24 关；getLevelById 对多解/无解盘改走强制唯一解兜底
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { LevelData, PaletteColor } from '../types';
import { LevelGenerator } from './generator';
import { QueensSolver } from './solver';

export const PALETTE: PaletteColor[] = [
  { id: 0, bg: '#F07C68', border: '#E06550', name: '珊瑚橙红', symbol: '●' },
  { id: 1, bg: '#F6BA58', border: '#E5A540', name: '暖金橙黄', symbol: '▲' },
  { id: 2, bg: '#F6A8B8', border: '#E592A3', name: '樱花粉红', symbol: '★' },
  { id: 3, bg: '#D8DE6E', border: '#C2C957', name: '青柠嫩绿', symbol: '■' },
  { id: 4, bg: '#7E98D6', border: '#6882C0', name: '静谧紫蓝', symbol: '◆' },
  { id: 5, bg: '#AFDCF5', border: '#96C8E2', name: '浅天湖蓝', symbol: '✚' },
  { id: 6, bg: '#B3A4D4', border: '#9B8CBE', name: '丁香浅紫', symbol: '⬟' },
  { id: 7, bg: '#80CBC4', border: '#66B2AA', name: '薄荷蓝绿', symbol: '✿' },
  { id: 8, bg: '#FFAB91', border: '#E59278', name: '蜜桃暖粉', symbol: '⬢' },
  { id: 9, bg: '#FFE082', border: '#E5C768', name: '奶油淡黄', symbol: '✦' }
];

export const PRESET_LEVELS: Record<number, LevelData> = {
  // 第 1 关：视频教学同款 (Tutorial - 4x4，单格橙色多米诺极速突破)
  1: {
    id: 1,
    size: 4,
    name: '第 1 关',
    targetCount: 4,
    initialTime: 240,
    solution: [
      { row: 0, col: 1 },
      { row: 1, col: 3 },
      { row: 2, col: 0 },
      { row: 3, col: 2 }
    ],
    regions: [
      [2, 0, 1, 1], // (0, 1) 为独立单格 Region 0，一眼锁定必放牛！
      [2, 3, 1, 1],
      [2, 3, 1, 1],
      [2, 3, 3, 3]
    ]
  },
  // 第 2 关：4x4 极度友好教学 (右上角 (1, 3) 独立单色单格突破口)
  2: {
    id: 2,
    size: 4,
    name: '第 2 关',
    targetCount: 4,
    initialTime: 240,
    solution: [
      { row: 0, col: 1 },
      { row: 1, col: 3 },
      { row: 2, col: 0 },
      { row: 3, col: 2 }
    ],
    regions: [
      [1, 1, 1, 1],
      [2, 3, 3, 0], // (1, 3) 为独立单格 Region 0，一眼锁定必放牛！
      [2, 2, 3, 3],
      [2, 2, 3, 3]
    ]
  },
  // 第 3 关：4x4 进阶巩固 (左下角 (2, 0) 独立单色单格突破口)
  3: {
    id: 3,
    size: 4,
    name: '第 3 关',
    targetCount: 4,
    initialTime: 240,
    solution: [
      { row: 0, col: 1 },
      { row: 1, col: 3 },
      { row: 2, col: 0 },
      { row: 3, col: 2 }
    ],
    regions: [
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [0, 3, 3, 2], // (2, 0) 为独立单格 Region 0，一眼锁定必放牛！
      [3, 3, 3, 3]
    ]
  },
  // 第 10 关：5x5 进阶探索 (经 CSP 严格验证 100% 唯一解)
  10: {
    id: 10,
    size: 5,
    name: '第 10 关',
    targetCount: 5,
    initialTime: 300,
    solution: [
      { row: 0, col: 4 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 3, col: 3 },
      { row: 4, col: 1 }
    ],
    regions: [
      [2, 2, 0, 0, 0],
      [2, 2, 1, 0, 3],
      [2, 2, 2, 3, 3],
      [2, 2, 3, 3, 3],
      [4, 4, 3, 3, 3]
    ]
  },
  // 24 关：100% 还原用户所上传的真机截图关卡！(7x7 唯一解)
  24: {
    id: 24,
    size: 7,
    name: '第 24 关',
    targetCount: 7,
    initialTime: 420,
    solution: [
      { row: 0, col: 1 },
      { row: 1, col: 6 },
      { row: 2, col: 4 },
      { row: 3, col: 0 },
      { row: 4, col: 2 },
      { row: 5, col: 5 },
      { row: 6, col: 3 }
    ],
    regions: [
      [0, 1, 1, 2, 2, 2, 2],
      [0, 0, 1, 3, 3, 2, 2],
      [0, 0, 4, 4, 3, 3, 3],
      [0, 0, 0, 4, 4, 4, 4],
      [0, 0, 5, 4, 4, 4, 4],
      [0, 0, 5, 5, 4, 4, 4],
      [0, 0, 5, 6, 6, 6, 4]
    ]
  }
};

/**
 * 根据关卡 ID 获取关卡数据（严格阶梯难度曲线、科学时限分配与 100% 唯一正解保证）
 */
export function getLevelById(levelId: number): LevelData {
  let level: LevelData;
  if (PRESET_LEVELS[levelId]) {
    level = { ...PRESET_LEVELS[levelId] };
  } else {
    // 严格科学的难度爬升阶梯与合理倒计时分配
    let size = 4;
    let initialTime = 240;
    if (levelId <= 3) {
      size = 4; initialTime = 240; // 1~3 关: 4x4 (4分钟)
    } else if (levelId <= 10) {
      size = 5; initialTime = 300; // 4~10 关: 5x5 (5分钟)
    } else if (levelId <= 23) {
      size = 6; initialTime = 360; // 11~23 关: 6x6 (6分钟)
    } else if (levelId <= 50) {
      size = 7; initialTime = 420; // 24~50 关: 7x7 (7分钟)
    } else if (levelId <= 100) {
      size = 8; initialTime = 480; // 51~100 关: 8x8 (8分钟)
    } else if (levelId <= 250) {
      size = 9; initialTime = 540; // 101~250 关: 9x9 (9分钟)
    } else {
      size = 10; initialTime = 600; // 251+ 关: 10x10 (10分钟)
    }

    level = LevelGenerator.generateUniqueLevel(levelId, size);
    level.initialTime = initialTime;
  }

  const solutions = QueensSolver.solve(level.regions, 2);
  if (solutions.length === 1) {
    level.solution = solutions[0];
    return level;
  }

  // 预置关或多解/无解盘：零次洪泛，直接走生成器的强制唯一解兜底
  const repaired = LevelGenerator.generateUniqueLevel(level.id, level.size, 0);
  repaired.initialTime = level.initialTime ?? repaired.initialTime;
  const repairedSolutions = QueensSolver.solve(repaired.regions, 2);
  if (repairedSolutions.length === 1) {
    repaired.solution = repairedSolutions[0];
  }
  return repaired;
}
