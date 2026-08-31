/**
 * [INPUT]: LevelData, PaletteColor - 引用自 src/types.ts, LevelGenerator - 引用自 src/core/generator.ts
 * [OUTPUT]: PRESET_LEVELS (精选关卡库), PALETTE (马卡龙调色板), getLevelById (按关卡号获取或生成)
 * [POS]: 关卡题库与美学色板中心，包含 100% 复刻原图的第 24 关与全套阶梯式闯关数据
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
    initialTime: 300,
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
    initialTime: 300,
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
    initialTime: 280,
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
    initialTime: 240,
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
    initialTime: 209,
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
 * 根据关卡 ID 获取关卡数据（严格阶梯难度曲线与 100% 唯一正解保证）
 */
export function getLevelById(levelId: number): LevelData {
  let level: LevelData;
  if (PRESET_LEVELS[levelId]) {
    level = { ...PRESET_LEVELS[levelId] };
  } else {
    // 严格科学的难度爬升阶梯
    let size = 4;
    if (levelId <= 3) {
      size = 4; // 1~3 关: 4x4 新手入门
    } else if (levelId <= 12) {
      size = 5; // 4~12 关: 5x5 初级进阶
    } else if (levelId <= 23) {
      size = 6; // 13~23 关: 6x6 中级推理
    } else if (levelId <= 50) {
      size = 7; // 24~50 关: 7x7 高级挑战 (含第 24 关真机名局)
    } else if (levelId <= 100) {
      size = 8; // 51~100 关: 8x8 专家大师
    } else {
      size = 9; // 101+ 关: 9x9 巅峰地狱
    }

    level = LevelGenerator.generateUniqueLevel(levelId, size);
  }

  if (!level.solution || level.solution.length === 0) {
    const solved = QueensSolver.solve(level.regions);
    if (solved.length > 0) {
      level.solution = solved[0];
    }
  }

  return level;
}
