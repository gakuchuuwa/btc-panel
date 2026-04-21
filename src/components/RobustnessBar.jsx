import React from 'react';

/*
  禅道量化 · 稳健度条
  ─────────────────────────────────────
  用水墨三色分段：
    · 朱砂  （稳健度 < 40%）
    · 墨黄  （40% ~ 70%）
    · 竹青  （≥ 70%，盈利色）

  轨道用淡墨细线，进度用对应色实填。
  数字用 .num（Cormorant Garamond）衬线数字。
*/
const RobustnessBar = ({ score, totalNeighbors, stableNeighbors /* , passedNeighbors */ }) => {
  const pct = Math.round((score || 0) * 100);

  const color =
    pct >= 70 ? 'var(--bamboo)'
    : pct >= 40 ? 'var(--gold-lt)'
    : 'var(--cinnabar)';

  return (
    <div className="flex items-center gap-3">
      {/* 墨轨 */}
      <div
        className="w-24 h-[3px] overflow-hidden"
        style={{ background: 'var(--line-soft)' }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="num text-sm" style={{ color, fontWeight: 500 }}>
          {pct}%
        </span>
        <span className="num text-xs" style={{ color: 'var(--ink-4)' }}>
          ({stableNeighbors}/{totalNeighbors})
        </span>
      </div>
    </div>
  );
};

export default RobustnessBar;
