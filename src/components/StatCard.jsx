import React from 'react';
import { cn } from '@/lib/utils';

/*
  禅道量化 · 统计数字条单元
  ─────────────────────────────────────
  从彩色大卡改为"古籍表格式"单元：
  · 暖米底色（var(--paper-warm)）
  · 上方大字距 .tag 标签
  · 下方大号 .num 衬线数字
  · 无阴影、无圆角、只靠细线分隔

  API 保持兼容：{ label, value, color, className }
  color 仅用于标签 / 数字色调的点缀（朱砂 / 竹青 / 金 / 墨）
*/

const colorMap = {
  /* 五色映射 —— 数字显示色 */
  blue:   { num: 'var(--ink)',      tag: 'var(--ink-4)' },
  cyan:   { num: 'var(--ink)',      tag: 'var(--ink-4)' },
  green:  { num: 'var(--ink)',      tag: 'var(--ink-4)' },      /* 墨色（常规） */
  teal:   { num: 'var(--bamboo)',   tag: 'var(--bamboo)' },     /* 竹青（盈利 / 次强调） */
  purple: { num: 'var(--gold)',     tag: 'var(--ink-4)' },
  amber:  { num: 'var(--cinnabar)', tag: 'var(--cinnabar)' },   /* 朱砂（关键高亮） */
  rose:   { num: 'var(--cinnabar)', tag: 'var(--cinnabar)' },   /* 朱砂（亏损） */
};

const StatCard = ({ label, value, color = 'green', className }) => {
  const c = colorMap[color] || colorMap.green;

  /* 把 label 按字符拆开加空格，模拟章回体「原 始 组 合」字距 */
  const spacedLabel = typeof label === 'string'
    ? label.trim().split('').join(' ')
    : label;

  return (
    <div
      className={cn(
        'relative py-5 px-4 text-center transition-colors',
        className
      )}
      style={{
        background: 'var(--paper-warm)',
        borderTop:    '1px solid var(--ink-3)',
        borderBottom: '1px solid var(--ink-4)',
      }}
    >
      <div
        className="mb-2.5"
        style={{
          fontSize: '10px',
          letterSpacing: '0.35em',
          color: c.tag,
          fontFamily: 'var(--ff-serif)',
        }}
      >
        {spacedLabel}
      </div>
      <div
        className="num leading-none"
        style={{
          fontSize: '28px',
          color: c.num,
          fontWeight: 500,
        }}
      >
        {value}
      </div>
    </div>
  );
};

export default StatCard;
