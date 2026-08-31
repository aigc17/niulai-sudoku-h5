/**
 * [INPUT]: None - 核心数据结构与契约定义
 * [OUTPUT]: CellState, GridCoord, LevelData, GameStatus, GameSnapshot, UserProfile
 * [POS]: 全局类型中心，定义游戏实体、棋盘状态、关卡结构与用户配置模型
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export enum CellState {
  EMPTY = 0,
  CROSS = 1,       // ❌ 正常白色排查叉叉
  ANIMAL = 2,      // 🐮 放置正确的小牛
  ERROR_CROSS = 3  // 🔴 选错时自动触发的惩罚性红色叉叉
}

export interface GridCoord {
  row: number;
  col: number;
}

export type ConflictType = 'ROW' | 'COL' | 'REGION' | 'ADJACENT';

export interface ConflictInfo {
  type: ConflictType;
  coords: GridCoord[];
}

export interface LevelData {
  id: number;
  size: number;
  regions: number[][]; // N x N 矩阵，每个格子对应 0 ~ N-1 的颜色区域ID
  solution?: GridCoord[];
  name?: string;
  targetCount?: number;
  initialTime?: number;
}

export type GameStatus = 'PLAYING' | 'WON' | 'LOST' | 'PAUSED';

export interface GameSnapshot {
  grid: CellState[][];
  remainingCount: number;
  timeRemaining: number;
  lives: number;
}

export interface UserProfile {
  level: number;
  coins: number;
  energy: number;
  lives: number;
  streak: number;
  props: {
    detector: number; // 放大镜/探照
    hint: number;     // 灯泡提示
  };
  settings: {
    sound: boolean;
    haptics: boolean;
    colorblind: boolean;
    coordinates: boolean;
    autoCross: boolean; // 放置小马时自动填充周围 X
  };
}

export interface PaletteColor {
  id: number;
  bg: string;
  border: string;
  name: string;
  symbol: string; // 色盲模式下的辅助符号
}
