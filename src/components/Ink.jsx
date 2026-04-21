/*
  禅道 · 水墨 SVG 装饰元素
  ─────────────────────────────────────
  全部用 path / stroke 画，不使用位图，避免"AI 插画味"。
  按需 import：  import Ink from './Ink';  <Ink.Mountains />
*/
import React from 'react';

const Ink = {};

/* 远山水平线 —— 三层浓淡，用作页眉背景 */
Ink.Mountains = ({ className = '', style }) => (
  <svg viewBox="0 0 800 120" className={className} style={style} preserveAspectRatio="none">
    <path
      d="M0,95 C80,70 140,80 210,72 C290,63 340,85 420,78 C500,71 560,60 640,68 C720,76 760,82 800,75 L800,120 L0,120 Z"
      fill="rgba(26,20,10,0.06)"
    />
    <path
      d="M0,105 C100,88 180,92 260,86 C360,78 420,96 520,90 C600,85 680,80 800,88 L800,120 L0,120 Z"
      fill="rgba(26,20,10,0.09)"
    />
    <path
      d="M0,113 C120,105 240,108 360,104 C500,100 620,106 800,102 L800,120 L0,120 Z"
      fill="rgba(26,20,10,0.13)"
    />
  </svg>
);

/* 远山单峰（竖）—— 空态 / 左下角意境 */
Ink.DistantPeak = ({ className = '', style }) => (
  <svg viewBox="0 0 320 200" className={className} style={style}>
    <path
      d="M0,180 C40,160 70,150 110,130 C140,115 160,95 185,100 C210,106 230,130 260,140 C280,147 300,155 320,160 L320,200 L0,200 Z"
      fill="rgba(26,20,10,0.07)"
    />
    <path
      d="M0,190 C60,175 100,170 140,160 C180,150 210,155 250,165 C280,172 300,178 320,180 L320,200 L0,200 Z"
      fill="rgba(26,20,10,0.11)"
    />
  </svg>
);

/* 柳枝 —— 从顶部垂下 · 带细叶 · 微摆动画 */
Ink.Willow = ({ className = '', style }) => (
  <svg viewBox="0 0 120 320" className={className} style={style}>
    <g className="willow-sway">
      {/* 主枝 */}
      <path
        d="M60,0 C58,40 62,80 56,120 C52,160 58,200 50,240 C46,270 52,295 48,320"
        stroke="rgba(26,20,10,0.55)" strokeWidth="0.8" fill="none" strokeLinecap="round"
      />
      {/* 侧枝 */}
      <path d="M58,60 C50,80 42,95 36,120"   stroke="rgba(26,20,10,0.4)"  strokeWidth="0.6" fill="none" />
      <path d="M60,110 C68,130 74,150 78,175" stroke="rgba(26,20,10,0.4)"  strokeWidth="0.6" fill="none" />
      <path d="M54,170 C44,190 38,210 32,235" stroke="rgba(26,20,10,0.4)"  strokeWidth="0.6" fill="none" />
      <path d="M52,220 C58,245 64,270 60,295" stroke="rgba(26,20,10,0.35)" strokeWidth="0.5" fill="none" />
      {/* 细叶 */}
      {[
        [36, 118, -35], [40, 130, -30], [44, 142, -25],
        [78, 175,  40], [76, 188,  35], [74, 200,  30],
        [32, 235, -30], [28, 248, -28], [34, 258, -25],
        [60, 295,  10], [62, 275,  15], [58, 262,   8],
        [50,  85, -20], [56,  95,  15], [62,  45,  10],
      ].map(([cx, cy, rot], i) => (
        <ellipse
          key={i} cx={cx} cy={cy} rx="1.2" ry="5.5"
          transform={`rotate(${rot} ${cx} ${cy})`}
          fill="rgba(26,20,10,0.4)"
        />
      ))}
    </g>
  </svg>
);

/* 莲花 —— 俯视留白，仅一朵 */
Ink.Lotus = ({ className = '', style, size = 120 }) => (
  <svg viewBox="0 0 120 120" className={className} style={style} width={size} height={size}>
    <g stroke="rgba(26,20,10,0.45)" strokeWidth="0.7" fill="none" strokeLinecap="round">
      {/* 外层花瓣 · 五片 */}
      {[0, 72, 144, 216, 288].map((r) => (
        <path key={`o-${r}`} d="M60,60 C48,30 52,22 60,18 C68,22 72,30 60,60"
          transform={`rotate(${r} 60 60)`} />
      ))}
      {/* 内层花瓣 · 五片 */}
      {[36, 108, 180, 252, 324].map((r) => (
        <path key={`i-${r}`} d="M60,60 C52,40 56,34 60,32 C64,34 68,40 60,60"
          transform={`rotate(${r} 60 60)`} opacity="0.75" />
      ))}
      {/* 莲心 */}
      <circle cx="60" cy="60" r="3" fill="rgba(139,58,47,0.6)" stroke="none" />
      <circle cx="60" cy="60" r="7" />
    </g>
  </svg>
);

/* 涟漪 —— 上传 / 加载 */
Ink.Ripple = ({ className = '', style }) => (
  <svg viewBox="0 0 200 200" className={className} style={style}>
    <g fill="none" stroke="rgba(26,20,10,0.4)" strokeWidth="0.7">
      <circle cx="100" cy="100" r="20" className="ripple"           style={{ transformOrigin: '100px 100px' }} />
      <circle cx="100" cy="100" r="20" className="ripple ripple-2"  style={{ transformOrigin: '100px 100px' }} />
      <circle cx="100" cy="100" r="20" className="ripple ripple-3"  style={{ transformOrigin: '100px 100px' }} />
    </g>
    {/* 水面中心墨点 */}
    <circle cx="100" cy="100" r="2.5" fill="rgba(26,20,10,0.6)" />
  </svg>
);

/* 水纹 —— 横向流水线（页脚 / 区块间） */
Ink.Water = ({ className = '', style }) => (
  <svg viewBox="0 0 800 40" className={className} style={style} preserveAspectRatio="none">
    <g fill="none" stroke="rgba(26,20,10,0.25)" strokeWidth="0.5">
      <path d="M0,10 Q50,4 100,10 T200,10 T300,10 T400,10 T500,10 T600,10 T700,10 T800,10" />
      <path d="M0,22 Q40,16 80,22 T160,22 T240,22 T320,22 T400,22 T480,22 T560,22 T640,22 T720,22 T800,22" opacity="0.6" />
      <path d="M0,32 Q60,28 120,32 T240,32 T360,32 T480,32 T600,32 T720,32 T800,32" opacity="0.4" />
    </g>
  </svg>
);

/* 朱砂方印 · Logo */
Ink.Seal = ({ className = '', style, size = 56, chars = ['禅', '道'] }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style}>
    <rect x="4" y="4" width="92" height="92" fill="#8b3a2f" />
    <rect x="8" y="8" width="84" height="84" fill="none" stroke="#f2ece0" strokeWidth="1.2" />
    <text x="50" y="44" textAnchor="middle" fontFamily="Noto Serif SC, serif" fontSize="30" fontWeight="700" fill="#f2ece0">{chars[0]}</text>
    <text x="50" y="80" textAnchor="middle" fontFamily="Noto Serif SC, serif" fontSize="30" fontWeight="700" fill="#f2ece0">{chars[1]}</text>
  </svg>
);

/* 小圆印（副印） */
Ink.RoundSeal = ({ className = '', style, ch = '智', size = 36 }) => (
  <svg viewBox="0 0 60 60" width={size} height={size} className={className} style={style}>
    <circle cx="30" cy="30" r="26" fill="#8b3a2f" />
    <circle cx="30" cy="30" r="22" fill="none" stroke="#f2ece0" strokeWidth="0.8" />
    <text x="30" y="39" textAnchor="middle" fontFamily="Noto Serif SC, serif" fontSize="22" fontWeight="700" fill="#f2ece0">{ch}</text>
  </svg>
);

/* 墨点 */
Ink.InkDot = ({ className = '', style, size = 8 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} className={className} style={style}>
    <circle cx="10" cy="10" r="5"   fill="rgba(26,20,10,0.7)" />
    <circle cx="10" cy="10" r="7.5" fill="rgba(26,20,10,0.2)" />
  </svg>
);

/* 竖向章纹（分隔线） */
Ink.VerticalRule = ({ className = '', style }) => (
  <svg viewBox="0 0 8 200" className={className} style={style} preserveAspectRatio="none">
    <line x1="4" y1="0" x2="4" y2="200" stroke="rgba(26,20,10,0.18)" strokeWidth="0.5" />
  </svg>
);

/* 一枝梅（备用装饰） */
Ink.Plum = ({ className = '', style }) => (
  <svg viewBox="0 0 120 80" className={className} style={style}>
    <path
      d="M0,60 C30,48 50,42 75,36 C90,32 105,28 120,22"
      stroke="rgba(26,20,10,0.55)" strokeWidth="1.1" fill="none" strokeLinecap="round"
    />
    <path d="M45,45 C52,38 58,40 60,48" stroke="rgba(26,20,10,0.45)" strokeWidth="0.6" fill="none" />
    {[[30, 52], [62, 40], [95, 28]].map(([cx, cy], i) => (
      <g key={i} transform={`translate(${cx} ${cy})`}>
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-2.5" rx="1.5" ry="2.5" fill="rgba(168,90,75,0.75)" transform={`rotate(${r})`} />
        ))}
        <circle r="0.7" fill="rgba(26,20,10,0.8)" />
      </g>
    ))}
  </svg>
);

export default Ink;
