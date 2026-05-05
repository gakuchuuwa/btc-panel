import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Upload, Filter, Award, Shield, ArrowUpRight, Activity, CheckCircle, XCircle,
} from 'lucide-react';
import { parseCSV, prepareStepNeighborMeta } from '../utils/csvParser';
import StatCard from './StatCard';
import DataTable from './DataTable';
import RobustnessBar from './RobustnessBar';
import Ink from './Ink';

const AnalysisDashboard = () => {
  /* ═══════════════════════════════════════════════
     ── 业务状态（原封不动 · 严禁改动） ──
  ═══════════════════════════════════════════════ */
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    minTrades: 20,
    minProfitFactor: 1.2,
    maxSingleLossPct: 15,
    maxDrawdown: 30,
    minSharpe: 0,
    minSortino: 0.8,
    minWinRate: 25,
    minWinLossRatio: 2.0,
  });
  const [scoreWeights, setScoreWeights] = useState({
    calmar: 0.30, sortino: 0.20, profitFactor: 0.20, sharpe: 0.05, netReturn: 0.25
  });
  const [robustnessWeight, setRobustnessWeight] = useState(0.40);
  const [showParetoOnly, setShowParetoOnly] = useState(false);
  const [allTableSort, setAllTableSort] = useState({ key: 'combinedScore', direction: 'desc' });
  const [recommendSort, setRecommendSort] = useState({ key: null, direction: 'desc' });
  const [uploadLog, setUploadLog] = useState('');
  const [showAlgoInfo, setShowAlgoInfo] = useState(false);
  const [robustnessData, setRobustnessData] = useState({});
  const [robustnessProgress, setRobustnessProgress] = useState(0);
  const robustnessAbortRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        if (parsed.length === 0) {
          setUploadLog('❌ 未读取到数据，请确认首行是表头');
          return;
        }
        setData(parsed);
        setUploadLog(`✅ 成功加载 ${parsed.length} 行数据`);
      } catch (error) {
        setUploadLog('❌ 文件解析失败: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const processedData = useMemo(() => data.map((row, idx) => {
    const getVal = (row, ...keys) => {
      for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
      return 0;
    };

    const initialCapital = getVal(row, 'Initial Capital: All', 'Initial Capital', 'Initial capital') || 10000;
    const percentProfit = getVal(row, 'Percent profitable: All', 'Percent Profitable', 'Win Rate');
    const grossProfit = getVal(row, 'Gross profit: All', 'Gross Profit');
    const grossLoss = Math.abs(getVal(row, 'Gross loss: All', 'Gross Loss'));
    const maxDD = Math.abs(getVal(row, 'Max equity drawdown', 'Max Drawdown'));
    const maxDDPct = Math.abs(getVal(row, 'Max equity drawdown %', 'Max Drawdown %'));
    const totalTrades = getVal(row, 'Total trades: All', 'Total Trades');
    const netProfit = getVal(row, 'Net profit: All', 'Net Profit', 'Net P&L: All', 'Total P&L');
    const netProfitPct = getVal(row, 'Net profit %: All', 'Net Profit %', 'Net P&L %: All', 'Total P&L %');
    const netPnlLong = getVal(row, 'Net P&L: Long', 'Net profit: Long');
    const netPnlShort = getVal(row, 'Net P&L: Short', 'Net profit: Short');
    const netPnlPctLong = getVal(row, 'Net P&L %: Long', 'Net profit %: Long');
    const netPnlPctShort = getVal(row, 'Net P&L %: Short', 'Net profit %: Short');
    const winningTrades = getVal(row, 'Winning trades: All', 'Winning Trades');
    const losingTrades = getVal(row, 'Losing trades: All', 'Losing Trades');
    const avgWin = getVal(row, 'Avg winning trade: All', 'Avg Trade');
    const avgLoss = Math.abs(getVal(row, 'Avg losing trade: All', 'Avg Trade'));
    const largestLoss = Math.abs(getVal(row, 'Largest losing trade: All', 'Largest Losing Trade'));
    const largestLossPct = Math.abs(getVal(row, 'Largest losing trade percent: All', 'Largest Losing Trade %'));
    const sharpe = getVal(row, 'Sharpe ratio', 'Sharpe Ratio');
    const sortino = getVal(row, 'Sortino ratio', 'Sortino Ratio');
    const profitFactor = getVal(row, 'Profit factor: All', 'Profit Factor');
    const marginCalls = getVal(row, 'Margin calls: All', 'Margin Calls', 'Margin calls');
    const totalTradesLong = getVal(row, 'Total trades: Long') || 0;
    const totalTradesShort = getVal(row, 'Total trades: Short') || 0;

    let finalAvgWin = avgWin, finalAvgLoss = avgLoss;
    if (finalAvgWin === 0 && winningTrades > 0 && grossProfit > 0) finalAvgWin = grossProfit / winningTrades;
    if (finalAvgLoss === 0 && losingTrades > 0 && grossLoss > 0) finalAvgLoss = grossLoss / losingTrades;

    const p = percentProfit > 1 ? percentProfit / 100 : percentProfit;
    const winRate = percentProfit;
    const E = p * finalAvgWin - (1 - p) * finalAvgLoss;
    const ddPct = maxDDPct || (maxDD / initialCapital) * 100;
    const returnPct = netProfitPct;
    const calmarRatio = ddPct > 0 ? returnPct / ddPct : 0;
    const R = finalAvgLoss > 0 ? finalAvgWin / finalAvgLoss : 0;

    let kellyFraction = 0;
    if (finalAvgLoss === 0 && finalAvgWin > 0 && winningTrades > 0) {
      kellyFraction = 1.0;
    } else if (R > 0) {
      kellyFraction = Math.min(1.0, (p * R - (1 - p)) / R);
    }
    const singleLossPct = largestLossPct || (largestLoss / initialCapital) * 100;

    const strategyParams = {};
    Object.keys(row).forEach(key => {
      if (key.startsWith('__')) strategyParams[key.replace(/^__/, '')] = row[key];
    });

    return {
      ...row, originalIndex: idx + 2,
      E, ddPct, returnPct, calmarRatio, winRate, winLossRatio: R,
      kellyFraction, singleLossPct, adjustedSharpe: sharpe, totalExpectation: netProfit,
      initialCapital, percentProfit, grossProfit, grossLoss, maxDD, totalTrades,
      winningTrades, losingTrades, netProfit, netProfitPct, netPnlLong, netPnlShort,
      netPnlPctLong, netPnlPctShort, sharpe, sortino, profitFactor, marginCalls,
      avgWin, avgLoss: finalAvgLoss, totalTradesLong, totalTradesShort, strategyParams
    };
  }), [data]);

  const deduplicatedData = useMemo(() => {
    const seen = new Set();
    return processedData.filter(row => {
      const key = [row.netProfit?.toFixed(2), row.ddPct?.toFixed(2), row.totalTrades,
                   row.profitFactor?.toFixed(3), row.sharpe?.toFixed(3)].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [processedData]);

  const getFilterReasons = (row) => {
    const reasons = [];
    if (row.netProfit <= 0) reasons.push('亏损');
    if (row.E <= 0) reasons.push('期望为负');
    if (row.profitFactor < filters.minProfitFactor) reasons.push(`盈利因子<${filters.minProfitFactor}`);
    if (row.totalTrades < filters.minTrades) reasons.push(`交易数<${filters.minTrades}`);
    if (row.marginCalls > 0) reasons.push('有爆仓');
    if (row.singleLossPct > filters.maxSingleLossPct) reasons.push(`单笔亏损>${filters.maxSingleLossPct}%`);

    if (reasons.length === 0) {
      if (row.ddPct > filters.maxDrawdown) reasons.push(`回撤>${filters.maxDrawdown}%`);
      if (row.sharpe < filters.minSharpe) reasons.push(`夏普<${filters.minSharpe}`);
      if (row.sortino < filters.minSortino) reasons.push(`索提诺<${filters.minSortino}`);
      if (row.winRate < filters.minWinRate) reasons.push(`胜率<${filters.minWinRate}%`);
      if (row.winLossRatio < filters.minWinLossRatio) reasons.push(`盈亏比<${filters.minWinLossRatio}`);
    }
    return reasons;
  };

  const filteredData = useMemo(() => deduplicatedData.map(row => {
    const reasons = getFilterReasons(row);
    return { ...row, filterReasons: reasons, passed: reasons.length === 0 };
  }).filter(r => r.passed), [deduplicatedData, filters]);

  const scoredData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const N = filteredData.length;
    const pLow = N < 50 ? 0.0 : 0.05, pHigh = N < 50 ? 1.0 : 0.95;
    const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length-1, Math.floor(s.length*p))] || 0; };
    const allDDs = filteredData.map(d => d.ddPct).sort((a, b) => a - b);
    const calmarFloor = Math.max(allDDs[Math.floor(allDDs.length/2)] || 5.0, 2.0);
    const recalc = filteredData.map(r => ({ ...r, calmarRatio: r.returnPct / Math.max(r.ddPct, calmarFloor) }));
    const dynNorm = (v, min, max) => max === min ? 0.5 : Math.max(0, Math.min(1, (v-min)/(max-min)));
    const ranges = {
      calmar: { min: pct(recalc.map(d=>d.calmarRatio), pLow), max: pct(recalc.map(d=>d.calmarRatio), pHigh) },
      sharpe: { min: pct(recalc.map(d=>d.adjustedSharpe), pLow), max: pct(recalc.map(d=>d.adjustedSharpe), pHigh) },
      sortino: { min: pct(recalc.map(d=>d.sortino), pLow), max: pct(recalc.map(d=>d.sortino), pHigh) },
      profitFactor:{ min: pct(recalc.map(d=>d.profitFactor), pLow), max: pct(recalc.map(d=>d.profitFactor), pHigh) },
      netReturn: { min: pct(recalc.map(d=>d.returnPct), pLow), max: pct(recalc.map(d=>d.returnPct), pHigh) },
    };
    return recalc.map(row => ({
      ...row,
      finalScore:
        dynNorm(row.calmarRatio, ranges.calmar.min, ranges.calmar.max) * scoreWeights.calmar +
        dynNorm(row.adjustedSharpe, ranges.sharpe.min, ranges.sharpe.max) * scoreWeights.sharpe +
        dynNorm(row.sortino, ranges.sortino.min, ranges.sortino.max) * scoreWeights.sortino +
        dynNorm(row.profitFactor, ranges.profitFactor.min, ranges.profitFactor.max) * scoreWeights.profitFactor +
        dynNorm(row.returnPct, ranges.netReturn.min, ranges.netReturn.max) * (scoreWeights.netReturn || 0)
    }));
  }, [filteredData, scoreWeights]);

  const paretoFront = useMemo(() => {
    if (scoredData.length === 0) return [];
    const dims = ['calmarRatio', 'returnPct', 'sortino', 'profitFactor'];
    return scoredData.filter((item, i) =>
      !scoredData.some((other, j) => i !== j &&
        dims.every(d => other[d] >= item[d]) && dims.some(d => other[d] > item[d]))
    );
  }, [scoredData]);

  const isPareto = (row) => paretoFront.some(p => p.originalIndex === row.originalIndex);

  const enrichedScoredData = useMemo(() => {
    if (scoredData.length === 0) return [];
    return scoredData.map(row => {
      const stabilityCoeff = row.totalTrades >= 80 ? 1.03 : row.totalTrades >= 50 ? 1.01 : 1.0;
      let riskProximityPenalty = 0;
      const safeMaxDD = Math.max(0.0001, filters.maxDrawdown);
      const safeMaxLoss = Math.max(0.0001, filters.maxSingleLossPct);
      const ddProx = row.ddPct / safeMaxDD;
      if (ddProx > 0.85) riskProximityPenalty += 0.15 * (ddProx - 0.85) / 0.15;
      const lossProx = row.singleLossPct / safeMaxLoss;
      if (lossProx > 0.8) riskProximityPenalty += 0.1 * (lossProx - 0.8) / 0.2;

      let longShortPenalty = 0;
      const isBidi = (row.totalTradesLong||0) > 0 && (row.totalTradesShort||0) > 0;
      if (isBidi) {
        const l = row.netPnlLong||0, s = row.netPnlShort||0, tot = Math.abs(l)+Math.abs(s);
        if (tot > 0) {
          if (l < 0 || s < 0) longShortPenalty = 0.08 * Math.abs(Math.min(l,s)) / tot;
          else { const dom = Math.max(l,s)/tot; if (dom > 0.90) longShortPenalty = 0.03*(dom-0.90)/0.10; }
        }
      }
      const utilityScore = row.finalScore * stabilityCoeff - riskProximityPenalty - longShortPenalty;
      return { ...row, utilityScore, stabilityCoeff, riskProximityPenalty };
    }).sort((a, b) => b.utilityScore - a.utilityScore);
  }, [scoredData, filters]);

  useEffect(() => {
    let aborted = false;
    if (robustnessAbortRef.current) robustnessAbortRef.current();
    robustnessAbortRef.current = () => { aborted = true; };

    if (deduplicatedData.length < 2) {
      setRobustnessData({});
      setRobustnessProgress(0);
      return;
    }

    setRobustnessProgress(1);

    setTimeout(() => {
      if (aborted) return;
      const passedSet = new Set(filteredData.map(r => r.originalIndex));
      const { numericVaryingKeys, boolVaryingKeys, stepSizes } = prepareStepNeighborMeta(deduplicatedData);

      if (numericVaryingKeys.length === 0 && boolVaryingKeys.length === 0) {
        setRobustnessData({});
        setRobustnessProgress(100);
        return;
      }

      const result = {};
      const totalRows = deduplicatedData.length;
      let currentIndex = 0;
      const CHUNK = 150;

      const processChunk = () => {
        if (aborted) return;
        const end = Math.min(currentIndex + CHUNK, totalRows);

        for (let i = currentIndex; i < end; i++) {
          const row = deduplicatedData[i];
          const rowReturn = row.returnPct || 0;
          const rowDD = row.ddPct || 0;
          let totalNeighbors = 0, stableNeighbors = 0, passedNeighbors = 0;

          for (let j = 0; j < totalRows; j++) {
            if (i === j) continue;
            const other = deduplicatedData[j];
            let changedParams = 0;
            let anyExceedsTwoSteps = false;

            for (const key of numericVaryingKeys) {
              const vRow = row.strategyParams?.[key];
              const vOther = other.strategyParams?.[key];
              if (typeof vRow !== 'number' || !isFinite(vRow) ||
                  typeof vOther !== 'number' || !isFinite(vOther)) continue;
              const diff = Math.abs(vRow - vOther);
              if (diff < 1e-9) continue;
              const step = stepSizes[key];
              if (!isFinite(step) || step <= 0) { changedParams++; continue; }
              if (diff / step > 1.5) { anyExceedsTwoSteps = true; break; }
              changedParams++;
            }

            if (!anyExceedsTwoSteps) {
              for (const key of boolVaryingKeys) {
                const vRow = row.strategyParams?.[key];
                const vOther = other.strategyParams?.[key];
                if (typeof vRow !== 'boolean' || typeof vOther !== 'boolean') continue;
                if (vRow !== vOther) changedParams++;
              }
            }

            if (anyExceedsTwoSteps || changedParams === 0 || changedParams > 2) continue;

            totalNeighbors++;
            if (passedSet.has(other.originalIndex)) passedNeighbors++;

            const otherReturn = other.returnPct || 0;
            const otherDD = other.ddPct || 0;
            const ddDiffPt = Math.abs(otherDD - rowDD);
            let returnDiffPct;
            if (Math.abs(rowReturn) < 1e-6) {
              returnDiffPct = Math.abs(otherReturn) < 1e-6 ? 0 : 1;
            } else {
              returnDiffPct = Math.abs(otherReturn - rowReturn) / Math.abs(rowReturn);
            }
            if (returnDiffPct < 0.15 && ddDiffPt < 5.0) stableNeighbors++;
          }

          const stableRatio = totalNeighbors > 0 ? stableNeighbors / totalNeighbors : 0;
          const passedRatio = totalNeighbors > 0 ? passedNeighbors / totalNeighbors : 0;
          const confidenceMultiplier = totalNeighbors >= 3 ? 1.0 : (totalNeighbors > 0 ? 0.9 : 0);
          result[row.originalIndex] = {
            totalNeighbors, stableNeighbors, passedNeighbors,
            stableRatio, passedRatio,
            robustnessScore: (stableRatio * 0.70 + passedRatio * 0.30) * confidenceMultiplier,
            paramDimensions: numericVaryingKeys.length,
            boolDimensions: boolVaryingKeys.length,
            stepSizes,
          };
        }

        currentIndex = end;
        setRobustnessProgress(Math.round((currentIndex / totalRows) * 100));

        if (currentIndex < totalRows) {
          setTimeout(processChunk, 0);
        } else {
          setRobustnessData(result);
          setRobustnessProgress(100);
        }
      };

      setTimeout(processChunk, 0);
    }, 0);

    return () => { aborted = true; };
  }, [deduplicatedData, filteredData]);

  const finalRankedData = useMemo(() => {
    if (enrichedScoredData.length === 0) return [];
    return enrichedScoredData.map(row => {
      const rb = robustnessData[row.originalIndex] || {
        totalNeighbors: 0, stableNeighbors: 0, passedNeighbors: 0, robustnessScore: 0
      };
      const multiplier = (1 - robustnessWeight) + robustnessWeight * rb.robustnessScore;
      const combinedScore = row.utilityScore > 0 ? row.utilityScore * multiplier : row.utilityScore;
      return {
        ...row,
        neighborCount: rb.totalNeighbors,
        stableNeighborCount: rb.stableNeighbors,
        passedNeighborCount: rb.passedNeighbors,
        robustnessScore: rb.robustnessScore,
        combinedScore
      };
    }).sort((a, b) => b.combinedScore - a.combinedScore);
  }, [enrichedScoredData, robustnessData, robustnessWeight]);

  const recommendedParameter = useMemo(() => finalRankedData.length > 0 ? finalRankedData[0] : null, [finalRankedData]);

  const handleRecommendSort = (key) => {
    let direction = 'desc'; // Default to desc for metrics
    if (recommendSort.key === key && recommendSort.direction === 'desc') {
      direction = 'asc';
    }
    setRecommendSort({ key, direction });
  };

  const displayData = useMemo(() => {
    let src = showParetoOnly ? finalRankedData.filter(r => isPareto(r)) : finalRankedData;
    if (recommendSort.key) {
      src = [...src].sort((a, b) => {
        let valA = a[recommendSort.key] ?? -1e9;
        let valB = b[recommendSort.key] ?? -1e9;
        if (valA < valB) return recommendSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return recommendSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return src.slice(0, 10);
  }, [finalRankedData, showParetoOnly, isPareto, recommendSort]);

  const handleAllTableSort = (key) => {
    let direction = 'desc';
    if (allTableSort.key === key && allTableSort.direction === 'desc') direction = 'asc';
    setAllTableSort({ key, direction });
  };

  const allTableData = useMemo(() => {
    const enrichedMap = new Map(finalRankedData.map(r => [r.originalIndex, r]));
    const rows = deduplicatedData.map(row => {
      const reasons = getFilterReasons(row);
      const enriched = enrichedMap.get(row.originalIndex);
      const rb = robustnessData[row.originalIndex] || { totalNeighbors: 0, stableNeighbors: 0, passedNeighbors: 0, robustnessScore: 0 };
      return {
        ...(enriched || row),
        filterReasons: reasons,
        passed: reasons.length === 0,
        combinedScore: enriched?.combinedScore || null,
        robustnessScore: rb.robustnessScore || null,
        neighborCount: rb.totalNeighbors || 0,
        stableNeighborCount: rb.stableNeighbors || 0,
        passedNeighborCount: rb.passedNeighbors || 0,
      };
    });
    if (allTableSort.key) {
      rows.sort((a, b) => {
        let valA = a[allTableSort.key] ?? -1e9;
        let valB = b[allTableSort.key] ?? -1e9;
        if (allTableSort.key === 'originalIndex') {
          valA = a.originalIndex; valB = b.originalIndex;
        }
        if (valA < valB) return allTableSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return allTableSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [deduplicatedData, finalRankedData, robustnessData, allTableSort, filters, getFilterReasons]);

  const algoStats = useMemo(() => {
    const firstKey = Object.keys(robustnessData)[0];
    if (!firstKey) return null;
    const info = robustnessData[firstKey];
    return {
      dims: info?.paramDimensions || 0,
      boolDims: info?.boolDimensions || 0,
      steps: info?.stepSizes || {}
    };
  }, [robustnessData]);

  // 根据参数维度数量自动设定稳健性权重
  const autoRobustnessWeight = useMemo(() => {
    const totalDims = (algoStats?.dims || 0) + (algoStats?.boolDims || 0);
    if (totalDims <= 1) return { weight: 0.00, label: '参数维度 ≤1，稳健性无意义，已自动设为 0%' };
    if (totalDims === 2) return { weight: 0.15, label: '参数维度 =2，稳健性参考价值有限，已自动设为 15%' };
    if (totalDims <= 4) return { weight: 0.25, label: `参数维度 =${totalDims}，已自动设为 25%` };
    return { weight: 0.40, label: `参数维度 =${totalDims}，邻居充足，已自动设为 40%` };
  }, [algoStats]);

  useEffect(() => {
    if (algoStats) {
      setRobustnessWeight(autoRobustnessWeight.weight);
    }
  }, [algoStats, autoRobustnessWeight.weight]);

  const stats = useMemo(() => ({
    total: data.length,
    deduplicated: deduplicatedData.length,
    filtered: filteredData.length,
    pareto: paretoFront.length,
    maxReturn: scoredData.length > 0 ? scoredData.reduce((max, r) => Math.max(max, r.returnPct||0), 0) : 0,
    maxCalmar: scoredData.length > 0 ? scoredData.reduce((max, r) => Math.max(max, r.calmarRatio||0), 0) : 0,
    paramDimensions: algoStats?.dims || 0,
    boolDimensions: algoStats?.boolDims || 0,
  }), [data.length, deduplicatedData.length, filteredData.length, scoredData.length, paretoFront.length, algoStats]);

  const filterInputs = [
    { key: 'minTrades',        label: '最小交易次数',    step: 1,    category: 'survival' },
    { key: 'minProfitFactor',  label: '最小盈利因子',    step: 0.1,  category: 'survival' },
    { key: 'maxSingleLossPct', label: '最大单笔亏损 (%)', step: 1,    category: 'survival' },
    { key: 'maxDrawdown',      label: '最大回撤 (%)',    step: 1,    category: 'risk' },
    { key: 'minSharpe',        label: '最小夏普比率',    step: 0.05, category: 'risk' },
    { key: 'minSortino',       label: '最小索提诺比率',  step: 0.1,  category: 'risk' },
    { key: 'minWinRate',       label: '最小胜率 (%)',    step: 1,    category: 'risk' },
    { key: 'minWinLossRatio',  label: '最小盈亏比',      step: 0.1,  category: 'risk' },
  ];

  /* ═══════════════════════════════════════════════
     ── 表格列定义（水墨色系） ──
  ═══════════════════════════════════════════════ */
  const recommendColumns = [
    { header: '行 号', sortKey: 'originalIndex', render: (row) => (
        <span className="num flex items-center gap-1" style={{ color: 'var(--ink-4)' }}>
          <span>{row.originalIndex}</span>
          {recommendedParameter?.originalIndex === row.originalIndex && <span className="dot dot-cinnabar" />}
        </span>
      ) },
    { header: '综 合 分', sortKey: 'combinedScore', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--cinnabar)', fontWeight: 500 }}>{(row.combinedScore||0).toFixed(3)}</span> },
    { header: '效 用 分', sortKey: 'utilityScore', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--bamboo)' }}>{(row.utilityScore||0).toFixed(3)}</span> },
    { header: '稳 健 性', sortKey: 'robustnessScore', align: 'text-left', render: (row) =>
        <RobustnessBar
          score={row.robustnessScore||0}
          totalNeighbors={row.neighborCount||0}
          stableNeighbors={row.stableNeighborCount||0}
          passedNeighbors={row.passedNeighborCount||0}
        /> },
    { header: 'CALMAR', sortKey: 'calmarRatio', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--ink)', fontWeight: 500 }}>{(row.calmarRatio||0).toFixed(2)}</span> },
    { header: '净 收 益', sortKey: 'returnPct', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: (row.returnPct||0) >= 0 ? 'var(--bamboo)' : 'var(--cinnabar)' }}>
          {(row.returnPct||0).toFixed(2)}%
        </span> },
    { header: '回 撤', sortKey: 'ddPct', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: (row.ddPct||0)>20 ? 'var(--cinnabar)' : (row.ddPct||0)>15 ? 'var(--gold-lt)' : 'var(--ink-2)' }}>
          {(row.ddPct||0).toFixed(2)}%
        </span> },
    { header: '胜 率', sortKey: 'winRate', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: (row.winRate||0)>=40 ? 'var(--bamboo)' : (row.winRate||0)>=30 ? 'var(--gold-lt)' : 'var(--cinnabar)' }}>
          {(row.winRate||0).toFixed(1)}%
        </span> },
    { header: '盈 亏 比', sortKey: 'winLossRatio', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: (row.winLossRatio||0)>=3 ? 'var(--bamboo)' : 'var(--ink-2)' }}>
          {(row.winLossRatio||0).toFixed(2)}
        </span> },
    { header: '笔 数', sortKey: 'totalTrades', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--ink-2)' }}>{row.totalTrades||0}</span> },
    { header: '帕 累 托', align: 'text-center', render: (row) =>
        isPareto(row) ? <span className="dot dot-cinnabar" /> : <span className="empty-dash">—</span> },
  ];

  const allDataColumns = [
    { header: '行 号', sortKey: 'originalIndex', render: (row) =>
        <span className="num" style={{ color: 'var(--ink-4)' }}>{row.originalIndex}</span> },
    { header: '综 合 分', sortKey: 'combinedScore', align: 'text-right', render: (row) =>
        row.combinedScore!=null
          ? <span className="num" style={{ color: 'var(--cinnabar)', fontWeight: 500 }}>{(row.combinedScore).toFixed(3)}</span>
          : <span className="empty-dash">—</span> },
    { header: '效 用 分', sortKey: 'utilityScore', align: 'text-right', render: (row) =>
        row.utilityScore!=null
          ? <span className="num" style={{ color: 'var(--bamboo)' }}>{(row.utilityScore).toFixed(3)}</span>
          : <span className="empty-dash">—</span> },
    { header: '稳 健 性', sortKey: 'robustnessScore', align: 'text-left', render: (row) =>
        row.robustnessScore!=null
          ? <RobustnessBar score={row.robustnessScore} totalNeighbors={row.neighborCount||0} stableNeighbors={row.stableNeighborCount||0} passedNeighbors={row.passedNeighborCount||0} />
          : <span className="empty-dash">—</span> },
    { header: 'CALMAR', sortKey: 'calmarRatio', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--ink-2)' }}>{(row.calmarRatio||0).toFixed(2)}</span> },
    { header: '净 收 益', sortKey: 'returnPct', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: (row.returnPct||0) >= 0 ? 'var(--bamboo)' : 'var(--cinnabar)' }}>
          {(row.returnPct||0).toFixed(2)}%
        </span> },
    { header: '回 撤', sortKey: 'ddPct', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--ink-2)' }}>{(row.ddPct||0).toFixed(2)}%</span> },
    { header: '笔 数', sortKey: 'totalTrades', align: 'text-right', render: (row) =>
        <span className="num" style={{ color: 'var(--ink-2)' }}>{row.totalTrades||0}</span> },
    { header: '筛选状态', align: 'text-left', render: (row) =>
        row.passed
          ? <span className="tag tag-bamboo inline-flex items-center gap-1.5">
              <span className="dot dot-bamboo" /> 通 · 过
            </span>
          : <span className="tag tag-cinnabar inline-flex items-start gap-1.5 leading-tight" style={{ letterSpacing: '0.1em' }}>
              <span className="dot dot-cinnabar mt-1 flex-shrink-0" />
              <span>{row.filterReasons.join(' · ')}</span>
            </span>
      },
  ];

  /* Header clock */
  const [clock, setClock] = React.useState(() => new Date().toLocaleTimeString('zh-CN', { hour12: false }));
  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('zh-CN', { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  /* Ticker（保留功能 · 低调呈现） */
  const [tickerItems, setTickerItems] = React.useState([]);

  React.useEffect(() => {
    const fetchTicker = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await response.json();
        const targets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ARBUSDT', 'DOGEUSDT', 'MATICUSDT', 'AVAXUSDT'];
        const targetSet = new Set(targets);
        const filtered = data.filter(d => targetSet.has(d.symbol));
        filtered.sort((a, b) => targets.indexOf(a.symbol) - targets.indexOf(b.symbol));

        const formatPrice = (p) => {
          const val = parseFloat(p);
          if (val < 1) return val.toFixed(4);
          if (val < 100) return val.toFixed(2);
          return val.toFixed(1);
        };

        const items = filtered.map(item => ({
          sym: item.symbol.replace('USDT', '/USDT'),
          val: '$' + formatPrice(item.lastPrice),
          chg: (parseFloat(item.priceChangePercent) >= 0 ? '+' : '') + parseFloat(item.priceChangePercent).toFixed(2) + '%',
          up: parseFloat(item.priceChangePercent) >= 0
        }));

        if (items.length > 0) setTickerItems(items);
      } catch (e) {
        console.error('Ticker fetch error:', e);
      }
    };
    fetchTicker();
    const timer = setInterval(fetchTicker, 30000);
    return () => clearInterval(timer);
  }, []);

  /* ═══════════════════════════════════════════════
     ── 渲染 · 水墨风版面 ──
  ═══════════════════════════════════════════════ */
  return (
    <div className="paper-bg min-h-screen" style={{ color: 'var(--ink)' }}>

      {/* ── 行情跑马灯（低调小字） ── */}
      {tickerItems.length > 0 && (
        <div className="ticker-wrap py-1.5">
          <div className="ticker-inner">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-8 text-xs">
                <span className="tag" style={{ fontSize: '10px' }}>{item.sym}</span>
                <span className="num" style={{ color: 'var(--ink-2)', fontSize: '12px' }}>{item.val}</span>
                <span className="num" style={{ color: item.up ? 'var(--bamboo)' : 'var(--cinnabar)', fontSize: '11px' }}>
                  {item.chg}
                </span>
                <span style={{ color: 'var(--ink-5)', marginLeft: '1.5rem' }}>·</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          Masthead ── 页眉 · 朱砂方印 + 远山背景
      ═══════════════════════════════════════════ */}
      <header className="relative" style={{ paddingTop: 56, paddingBottom: 44 }}>
        <Ink.Mountains style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, opacity: 0.9 }} />

        <div className="relative mx-auto flex items-start justify-between flex-wrap gap-6" style={{ maxWidth: 1280, padding: '0 48px' }}>
          <div className="flex gap-7 items-start">
            <Ink.Seal size={72} />
            <div>
              <div className="tag mb-3">QUANT&nbsp;·&nbsp;LAB&nbsp;·&nbsp;禅 道 量 化</div>
              <h1 className="chap m-0" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '0.12em', lineHeight: 1.1 }}>
                回&nbsp;测&nbsp;·&nbsp;观&nbsp;止
              </h1>
              <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-3)', letterSpacing: '0.15em' }}>
                量化回测智能评分系统&nbsp;·&nbsp;稳健优先
              </div>
            </div>
          </div>

          <div className="flex gap-7 items-start">
            <div className="flex flex-col items-end gap-2">
              <div style={{ fontSize: 11, letterSpacing: '0.3em', color: 'var(--ink-4)' }}>SYSTEM&nbsp;·&nbsp;运 行 中</div>
              <div className="flex items-center gap-2">
                <span className="dot dot-cinnabar breathe" />
                <span className="num" style={{ fontSize: 13, color: 'var(--ink-3)' }}>v 3.2 &nbsp;/&nbsp; 潜在稳健性算法</span>
              </div>
              <div className="num" style={{ fontSize: 11, color: 'var(--ink-5)', letterSpacing: '0.1em' }}>
                {clock}
              </div>
            </div>
            <div className="vertical hidden md:block" style={{ fontSize: 13, color: 'var(--ink-4)', letterSpacing: '0.4em', lineHeight: 1.6 }}>
              稳&nbsp;中&nbsp;求&nbsp;胜
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          Preface ── 序·本书所述
      ═══════════════════════════════════════════ */}
      <section className="relative mx-auto" style={{ maxWidth: 1280, padding: '0 48px 56px' }}>
        <div className="grid items-start gap-12" style={{ gridTemplateColumns: '1fr 2px 2fr' }}>
          <div>
            <div className="tag mb-4">序&nbsp;·&nbsp;本 书 所 述</div>
            <div className="chap" style={{ fontSize: 22, lineHeight: 1.7, color: 'var(--ink)' }}>
              于<span style={{ color: 'var(--cinnabar)' }}>&nbsp;万 千 参 数&nbsp;</span>之中
              <br />
              寻 一 处 <span style={{ borderBottom: '1px solid var(--ink-3)' }}>稳 健 高 原</span>
            </div>
          </div>
          <div style={{ background: 'var(--line)', width: 1, height: '100%', minHeight: 120, justifySelf: 'center' }} />
          <div className="prose-zen" style={{ maxWidth: 620 }}>
            基于<span className="highlight">单步邻居法</span>的稳健性评估系统。助君从成千上万个回测组合中，
            避开"孤峰陷阱"与"维度黑洞"，锁定真正具备实盘价值的
            <span className="highlight">稳健参数组合</span>。
            <br /><br />
            <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>
              —&nbsp;回测非预测，稳健先于收益。仅供策略研究参考，不构成投资建议。
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          使用说明 ── 新用户引导
      ═══════════════════════════════════════════ */}
      <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 24px' }}>
        <div className="leaf" style={{ padding: '32px 40px', background: 'rgba(var(--ink-rgb,40,36,30),0.03)', borderColor: 'var(--ink-4)' }}>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* 左：步骤说明 */}
            <div style={{ flex: 1 }}>
              <div className="tag mb-3">使 用 说 明</div>
              <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 2.0, letterSpacing: '0.05em' }}>
                上传 <span className="num" style={{ color: 'var(--cinnabar)' }}>TradingView</span> 策略生成器导出的 CSV 文件，
                系统会自动评分并筛选出最稳健的参数组合。
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['①', '在 TradingView 打开策略生成器，运行参数优化（Strategy Tester → 优化）'],
                  ['②', '点击右上角"导出结果"，下载 CSV 文件'],
                  ['③', '将 CSV 拖入下方上传区，系统自动分析'],
                ].map(([num, text]) => (
                  <div key={num} className="flex items-start gap-3" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    <span className="num" style={{ color: 'var(--cinnabar)', fontWeight: 600, minWidth: 20 }}>{num}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 右：示例下载 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 180 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', textAlign: 'center', letterSpacing: '0.08em' }}>
                没有 CSV？先用示例文件体验
              </div>
              <a
                href="/sample.csv"
                download="sample_backtest.csv"
                className="btn btn-cinnabar"
                style={{ textDecoration: 'none', fontSize: 13, padding: '10px 24px', letterSpacing: '0.1em' }}
              >
                下载示例 CSV
              </a>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center' }}>
                包含 12 组参数回测结果<br />可直接上传体验分析功能
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          Upload ── 第一章 · 入 卷
      ═══════════════════════════════════════════ */}
      <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 48px' }}>
        {data.length === 0 ? (
          <label
            className="leaf block cursor-pointer relative overflow-hidden transition-all"
            style={{
              padding: '64px 48px',
              textAlign: 'center',
              borderStyle: 'dashed',
              borderColor: 'var(--ink-5)',
              background: 'transparent',
            }}
          >
            {/* 背景柳枝 */}
            <Ink.Willow style={{ position: 'absolute', right: 40,  top: -20, width: 100, height: 300, opacity: 0.55, pointerEvents: 'none' }} />
            <Ink.Willow style={{ position: 'absolute', left:  60,  top: -40, width:  80, height: 260, opacity: 0.35, pointerEvents: 'none', transform: 'scaleX(-1)' }} />

            <div className="relative">
              <Ink.Ripple style={{ width: 120, height: 120, margin: '0 auto 20px' }} />
              <div className="tag mb-3">第 一 章&nbsp;·&nbsp;入 卷</div>
              <div className="chap" style={{ fontSize: 24, marginBottom: 10, letterSpacing: '0.1em' }}>
                拖 入 &nbsp;·&nbsp; 或 轻 点 &nbsp;·&nbsp; 上 传 回 测
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', letterSpacing: '0.1em', lineHeight: 2 }}>
                支持 TradingView 策略生成器导出的 <span className="num" style={{ color: 'var(--ink-2)' }}>CSV</span> 原始数据
                <br />
                <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>首行需为表头 · 解析于本地完成，不上传服务器</span>
              </div>
              <div style={{ marginTop: 28 }}>
                <span className="btn btn-cinnabar">选&nbsp;·&nbsp;取&nbsp;·&nbsp;文&nbsp;·&nbsp;卷</span>
              </div>
            </div>

            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        ) : (
          <div className="leaf" style={{ padding: '28px 36px' }}>
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-7">
                <Ink.RoundSeal ch="阅" size={44} />
                <div>
                  <div className="tag mb-1.5">卷&nbsp;·&nbsp;已 展</div>
                  <div className="chap" style={{ fontSize: 18 }}>
                    <span className="num" style={{ color: 'var(--cinnabar)', fontSize: 22, marginRight: 8 }}>
                      {data.length.toLocaleString()}
                    </span>
                    行回测记录已解析&nbsp;·&nbsp;成功载入
                  </div>
                </div>
              </div>
              <label className="btn btn-ghost cursor-pointer">
                重&nbsp;·&nbsp;新 上 传
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {uploadLog && (
              <div
                className="mt-4 text-sm font-sans-cn inline-flex items-center gap-2"
                style={{ color: uploadLog.includes('✅') ? 'var(--bamboo)' : 'var(--cinnabar)' }}
              >
                {uploadLog.includes('✅') ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {uploadLog.replace(/^[✅❌] ?/, '')}
              </div>
            )}
          </div>
        )}
        {data.length === 0 && uploadLog && (
          <div
            className="mt-4 text-sm font-sans-cn inline-flex items-center gap-2"
            style={{ color: uploadLog.includes('✅') ? 'var(--bamboo)' : 'var(--cinnabar)' }}
          >
            {uploadLog.includes('✅') ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {uploadLog.replace(/^[✅❌] ?/, '')}
          </div>
        )}
      </section>

      {data.length > 0 && (
        <div className="fade-in-up">

          {/* ═══════════════════════════════════════════
              StatsBar ── 古籍表格式统计条
          ═══════════════════════════════════════════ */}
          <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 56px' }}>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-0 leaf-quiet">
              <StatCard label="原始组合"    value={stats.total} />
              <StatCard label="去重后"      value={stats.deduplicated} />
              <StatCard label="通过过滤"    value={stats.filtered}       color="amber" />
              <StatCard label="帕累托最优"  value={stats.pareto}         color="teal" />
              <StatCard label="最高收益"    value={stats.maxReturn.toFixed(1) + '%'}    color="teal" />
              <StatCard label="最高Calmar"  value={stats.maxCalmar.toFixed(2)} />
              <StatCard label="参数维度"    value={(stats.paramDimensions + stats.boolDimensions) + 'D'} />
            </div>
          </section>

          {/* ═══════════════════════════════════════════
              稳健性扫描进度
          ═══════════════════════════════════════════ */}
          {robustnessProgress > 0 && robustnessProgress < 100 && (
            <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 32px' }}>
              <div className="leaf flex items-center gap-5" style={{ padding: '20px 28px' }}>
                <Activity className="animate-spin flex-shrink-0" size={18} style={{ color: 'var(--bamboo)' }} />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-3">
                    <span className="tag">单 步 邻 居 稳 健 性 扫 描 中</span>
                    <span className="num" style={{ color: 'var(--cinnabar)', fontWeight: 500 }}>{robustnessProgress}%</span>
                  </div>
                  <div className="ink-bar" />
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════════════════════════════
              二章 · 单步邻居评估 · 算法总览
          ═══════════════════════════════════════════ */}
          <section className="mx-auto relative" style={{ maxWidth: 1280, padding: '0 48px 72px' }}>
            <div className="flex items-center gap-5 mb-8 flex-wrap">
              <span className="seal-v" style={{ padding: '14px 5px' }}>二&nbsp;章</span>
              <div>
                <div className="tag mb-1.5">CHAPTER&nbsp;·&nbsp;II</div>
                <h2 className="chap m-0" style={{ fontSize: 26, letterSpacing: '0.1em', fontWeight: 500 }}>
                  单 步 邻 居 评 估&nbsp;·&nbsp;算 法 总 览
                </h2>
              </div>
              <button
                onClick={() => setShowAlgoInfo(!showAlgoInfo)}
                className="btn btn-ghost ml-auto"
                style={{ fontSize: 11, padding: '0.6em 1.4em' }}
              >
                {showAlgoInfo ? '收 · 起' : '展 · 开 · 说 · 明'}
              </button>
            </div>

            {showAlgoInfo && (
              <>
                <div className="grid md:grid-cols-2 gap-12 mb-9">
                  <div className="leaf" style={{ padding: '32px 36px' }}>
                    <div className="tag tag-cinnabar mb-5">核 心&nbsp;·&nbsp;所 解</div>
                    <div className="mb-7">
                      <div className="chap mb-2" style={{ fontSize: 17, color: 'var(--ink)' }}>·&nbsp;孤 峰 陷 阱</div>
                      <div className="prose-zen" style={{ fontSize: 13, lineHeight: 1.9 }}>
                        部分参数虽回测极佳，但稍有改动便雪崩坠落。孤峰之险，非稳健之道。
                      </div>
                    </div>
                    <div>
                      <div className="chap mb-2" style={{ fontSize: 17, color: 'var(--ink)' }}>·&nbsp;维 度 黑 洞</div>
                      <div className="prose-zen" style={{ fontSize: 13, lineHeight: 1.9 }}>
                        高维参数空间中，传统算法极易漏掉真正稳健的配置。黑洞之深，须以邻居之法照之。
                      </div>
                    </div>
                  </div>

                  <div className="leaf" style={{ padding: '32px 36px' }}>
                    <div className="tag tag-bamboo mb-5">算 法&nbsp;·&nbsp;所 长</div>
                    {[
                      { t: '高 原 效 应', d: '仅改变 1-2 步进的邻居，皆为高原区域，方称稳健。' },
                      { t: '布 尔 修 正', d: '深度支持布尔型开关参数的变动追踪。' },
                      { t: '步 长 推 断', d: '自动感知每一维度的步长与量级，适配策略维度。' },
                    ].map((x, i) => (
                      <div key={i} className="flex items-start gap-4" style={{ marginBottom: i < 2 ? 20 : 0 }}>
                        <span className="num" style={{ color: 'var(--bamboo)', fontSize: 14, marginTop: 3, minWidth: 20 }}>0{i + 1}</span>
                        <div>
                          <div className="chap" style={{ fontSize: 16, marginBottom: 4 }}>{x.t}</div>
                          <div className="prose-zen" style={{ fontSize: 13, lineHeight: 1.8 }}>{x.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {algoStats && Object.keys(algoStats.steps).length > 0 && (
                  <div className="leaf" style={{ padding: '24px 32px' }}>
                    <div className="tag mb-4">步&nbsp;长&nbsp;推&nbsp;断&nbsp;·&nbsp;结 果</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-10">
                      {Object.entries(algoStats.steps).map(([key, step]) => (
                        <div key={key} className="flex justify-between items-center py-2"
                          style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <span className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{key}</span>
                          <span className="num" style={{ fontSize: 14, color: 'var(--bamboo)', fontWeight: 500 }}>
                            {isFinite(step) ? step.toFixed(4).replace(/\.?0+$/, '') : '∞'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ═══════════════════════════════════════════
              三章 · 过滤 · 权重
          ═══════════════════════════════════════════ */}
          <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 72px' }}>
            <div className="flex items-center gap-5 mb-8 flex-wrap">
              <span className="seal-v" style={{ padding: '14px 5px' }}>三&nbsp;章</span>
              <div>
                <div className="tag mb-1.5">CHAPTER&nbsp;·&nbsp;III</div>
                <h2 className="chap m-0" style={{ fontSize: 26, letterSpacing: '0.1em', fontWeight: 500 }}>
                  过 滤 层 级&nbsp;·&nbsp;加 权 评 估
                </h2>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
              {/* 过滤面板 */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Filter size={16} style={{ color: 'var(--bamboo)' }} />
                  <h3 className="chap m-0" style={{ fontSize: 18, letterSpacing: '0.08em', fontWeight: 500 }}>分 层 核 心 过 滤</h3>
                </div>

                {/* 第一层 · 生存筛选 */}
                <div style={{ borderTop: '1px solid var(--ink-3)', paddingTop: 22 }}>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="tag tag-cinnabar">第 一 层</span>
                    <span className="chap" style={{ fontSize: 16, letterSpacing: '0.08em' }}>生 存 筛 选</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {filterInputs.filter(f=>f.category==='survival').map(({ key, label, step }) => (
                      <div key={key} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <label className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</label>
                        <input type="number" step={step} value={filters[key]}
                          onChange={(e)=>setFilters({...filters,[key]:Number(e.target.value)})}
                          className="num text-right"
                          style={{ width: 90, padding: '3px 6px', fontSize: 14 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 第二层 · 性能深度过滤 */}
                <div style={{ borderTop: '1px solid var(--ink-3)', paddingTop: 22, marginTop: 32 }}>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="tag tag-cinnabar">第 二 层</span>
                    <span className="chap" style={{ fontSize: 16, letterSpacing: '0.08em' }}>性 能 深 度 过 滤</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {filterInputs.filter(f=>f.category==='risk').map(({ key, label, step }) => (
                      <div key={key} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <label className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</label>
                        <input type="number" step={step} value={filters[key]}
                          onChange={(e)=>setFilters({...filters,[key]:Number(e.target.value)})}
                          className="num text-right"
                          style={{ width: 90, padding: '3px 6px', fontSize: 14 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 权重面板 */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Award size={16} style={{ color: 'var(--cinnabar)' }} />
                  <h3 className="chap m-0" style={{ fontSize: 18, letterSpacing: '0.08em', fontWeight: 500 }}>加 权 评 估 矩 阵</h3>
                </div>

                <div style={{ borderTop: '1px solid var(--ink-3)', paddingTop: 22 }}>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-7">
                    {[
                      { key:'calmar',       label:'Calmar Ratio'  },
                      { key:'sortino',      label:'Sortino Ratio' },
                      { key:'profitFactor', label:'Profit Factor' },
                      { key:'netReturn',    label:'Net Return %'  },
                      { key:'sharpe',       label:'Sharpe Ratio'  },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <label className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</label>
                        <input type="number" step="0.05" min="0" max="1"
                          value={scoreWeights[key]||0}
                          onChange={(e)=>setScoreWeights({...scoreWeights,[key]:Number(e.target.value)})}
                          className="num text-right"
                          style={{ width: 90, padding: '3px 6px', fontSize: 14, color: 'var(--cinnabar)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--ink-3)', paddingTop: 22 }}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <Shield size={14} style={{ color: 'var(--bamboo)' }} />
                    <span className="chap" style={{ fontSize: 16, letterSpacing: '0.08em' }}>稳 健 性 置 信 因 子</span>
                  </div>
                  <div className="prose-zen mb-2" style={{ fontSize: 12 }}>
                    决定"选高原"还是"选山尖"的平衡杠杆
                  </div>
                  {algoStats && (
                    <div className="flex items-center gap-2 mb-3" style={{ fontSize: 11, color: autoRobustnessWeight.weight === robustnessWeight ? 'var(--bamboo)' : 'var(--ink-4)' }}>
                      <span>💡 {autoRobustnessWeight.label}</span>
                      {autoRobustnessWeight.weight !== robustnessWeight && (
                        <button
                          onClick={() => setRobustnessWeight(autoRobustnessWeight.weight)}
                          style={{ fontSize: 10, padding: '2px 8px', border: '1px solid var(--ink-4)', borderRadius: 2, background: 'transparent', color: 'var(--cinnabar)', cursor: 'pointer' }}
                        >
                          恢复推荐值
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-5">
                    <div className="flex-1">
                      <input type="range" min="0" max="1" step="0.05"
                        value={robustnessWeight}
                        onChange={(e)=>setRobustnessWeight(Number(e.target.value))}
                        className="w-full"
                        style={{ accentColor: 'var(--cinnabar)' }}
                      />
                      <div className="flex justify-between mt-2 tag" style={{ fontSize: 10 }}>
                        <span>纯 · 收 益</span>
                        <span>极 · 致 · 稳 健</span>
                      </div>
                    </div>
                    <div className="text-center" style={{ minWidth: 90, padding: '8px 14px', background: 'var(--paper-warm)', borderTop: '1px solid var(--ink-3)', borderBottom: '1px solid var(--ink-4)' }}>
                      <div className="num" style={{ fontSize: 24, color: 'var(--cinnabar)', lineHeight: 1, fontWeight: 500 }}>
                        {(robustnessWeight*100).toFixed(0)}
                        <span className="tag" style={{ fontSize: 10, marginLeft: 2, color: 'var(--ink-4)' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════
              结果区域（计算中时模糊）
          ═══════════════════════════════════════════ */}
          <div className={`transition-all duration-700 ${robustnessProgress > 0 && robustnessProgress < 100 ? 'opacity-30 blur-sm pointer-events-none' : 'opacity-100'}`}>

            {/* ── 四章 · 金榜推荐 ── */}
            {recommendedParameter && (
              <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 72px' }}>
                <div className="flex items-center gap-5 mb-8 flex-wrap">
                  <span className="seal-v" style={{ padding: '14px 5px' }}>四&nbsp;章</span>
                  <div>
                    <div className="tag mb-1.5">CHAPTER&nbsp;·&nbsp;IV</div>
                    <h2 className="chap m-0" style={{ fontSize: 26, letterSpacing: '0.1em', fontWeight: 500 }}>
                      金 榜&nbsp;·&nbsp;最 强 推 荐 参 数 组
                    </h2>
                  </div>
                </div>

                <div className="leaf fold-tr">
                  {/* 卡头 */}
                  <div className="flex items-center gap-5 flex-wrap px-8 py-5" style={{ borderBottom: '1px solid var(--line)' }}>
                    <Ink.RoundSeal ch="智" size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="tag mb-1.5">智&nbsp;·&nbsp;优 选</div>
                      <div className="chap" style={{ fontSize: 18, color: 'var(--ink)' }}>
                        该 组 合 在 全 域 参 数 变 动 中 表 现 出 极 高 的 生 存 韧 性
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="tag mb-1">CSV&nbsp;·&nbsp;原 行</div>
                      <div className="num" style={{ fontSize: 32, color: 'var(--cinnabar)', fontWeight: 500, lineHeight: 1 }}>
                        #{recommendedParameter.originalIndex}
                      </div>
                    </div>
                  </div>

                  {/* 三栏指标 */}
                  <div className="grid md:grid-cols-3 gap-0" style={{ background: 'var(--paper)' }}>
                    {/* 栏1：综合评分 */}
                    <div className="p-7" style={{ borderRight: '1px solid var(--line)' }}>
                      <div className="tag mb-5">综 合 评 分</div>
                      {[
                        { label: '综合分',   val: (recommendedParameter.combinedScore||0).toFixed(3),  color: 'var(--cinnabar)', size: 24 },
                        { label: '效用分',   val: (recommendedParameter.utilityScore||0).toFixed(3),   color: 'var(--bamboo)',   size: 20 },
                        { label: '稳定系数', val: `${(recommendedParameter.stabilityCoeff||1).toFixed(2)}×`, color: 'var(--ink-2)', size: 18 },
                      ].map(({ label, val, color, size }) => (
                        <div key={label} className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <span className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</span>
                          <span className="num" style={{ color, fontSize: size, fontWeight: 500 }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* 栏2：稳健性 */}
                    <div className="p-7" style={{ borderRight: '1px solid var(--line)' }}>
                      <div className="tag mb-5">单 步 邻 居 稳 健 性</div>
                      <div className="flex justify-between items-baseline mb-3">
                        <span className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>稳 健 性 分 数</span>
                        <span className="num" style={{ fontSize: 28, color: 'var(--bamboo)', fontWeight: 500, lineHeight: 1 }}>
                          {((recommendedParameter.robustnessScore||0)*100).toFixed(0)}<span className="tag" style={{ fontSize: 10, marginLeft: 2 }}>%</span>
                        </span>
                      </div>
                      <div className="h-[3px] mb-5" style={{ background: 'var(--line-soft)' }}>
                        <div className="h-full transition-all duration-1000"
                          style={{ width: `${(recommendedParameter.robustnessScore||0)*100}%`, background: 'var(--bamboo)' }} />
                      </div>
                      {[
                        { label: '总邻居数（单步内）', val: `${recommendedParameter.neighborCount||0}`,        unit: '组', color: 'var(--ink-2)' },
                        { label: '结果稳定邻居',       val: `${recommendedParameter.stableNeighborCount||0}`, unit: '组', color: 'var(--bamboo)' },
                        { label: '通过筛选邻居',       val: `${recommendedParameter.passedNeighborCount||0}`, unit: '组', color: 'var(--bamboo)' },
                      ].map(({ label, val, unit, color }) => (
                        <div key={label} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <span className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</span>
                          <span className="num" style={{ color, fontSize: 15, fontWeight: 500 }}>
                            {val}<span className="tag" style={{ fontSize: 10, marginLeft: 3 }}>{unit}</span>
                          </span>
                        </div>
                      ))}
                      <div className="prose-zen mt-4" style={{ fontSize: 11, lineHeight: 1.8, color: 'var(--ink-4)' }}>
                        仅改变 1-2 个参数 × 1 步，收益率偏差 &lt; 15% 且回撤差 &lt; 5pp 方为稳定邻居。
                      </div>
                    </div>

                    {/* 栏3：绩效核心 */}
                    <div className="p-7">
                      <div className="tag mb-5">绩 效 核 心</div>
                      {[
                        { label: 'Calmar 比率',  val: (recommendedParameter.calmarRatio||0).toFixed(2),              color: 'var(--bamboo)' },
                        { label: '最大回撤',     val: `${(recommendedParameter.ddPct||0).toFixed(2)}%`,               color: (recommendedParameter.ddPct||0)>15 ? 'var(--cinnabar)' : 'var(--bamboo)' },
                        { label: '净收益率',     val: `${(recommendedParameter.returnPct||0).toFixed(2)}%`,           color: (recommendedParameter.returnPct||0)>=0 ? 'var(--bamboo)' : 'var(--cinnabar)' },
                        { label: '盈利因子',     val: (recommendedParameter.profitFactor||0).toFixed(2),              color: 'var(--ink-2)' },
                        { label: '胜率',         val: `${(recommendedParameter.winRate||0).toFixed(1)}%`,             color: 'var(--ink-2)' },
                        { label: '索提诺',       val: (recommendedParameter.sortino||0).toFixed(2),                   color: 'var(--ink-2)' },
                        { label: 'Kelly 仓位',   val: `${(Math.max(0,recommendedParameter.kellyFraction||0)*50).toFixed(1)}%`, color: 'var(--cinnabar)' },
                        { label: '总交易笔数',   val: `${recommendedParameter.totalTrades||0}`,                       color: 'var(--ink-4)' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <span className="chap" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</span>
                          <span className="num" style={{ color, fontSize: 15, fontWeight: 500 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 策略参数 */}
                  {recommendedParameter.strategyParams && Object.keys(recommendedParameter.strategyParams).length > 0 && (
                    <div className="px-7 py-5" style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-warm)' }}>
                      <div className="tag mb-4">策 略 参 数 配 置</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-8 gap-y-2.5">
                        {Object.entries(recommendedParameter.strategyParams)
                          .filter(([,v]) => v!==null && v!==undefined && v!=='' && !(typeof v==='number'&&isNaN(v)))
                          .map(([key,value]) => (
                            <div key={key} className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                              <span className="chap truncate mr-2" style={{ fontSize: 12, color: 'var(--ink-4)' }}>{key}</span>
                              <span className="num flex-shrink-0" style={{ color: 'var(--bamboo)', fontSize: 14, fontWeight: 500 }}>
                                {typeof value==='boolean'?(value?'是':'否'):value}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ═══════════════════════════════════════════
                五章 · TOP 10 排行榜
            ═══════════════════════════════════════════ */}
            <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 72px' }}>
              <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-5">
                  <span className="seal-v" style={{ padding: '14px 5px' }}>五&nbsp;章</span>
                  <div>
                    <div className="tag mb-1.5">CHAPTER&nbsp;·&nbsp;V</div>
                    <h2 className="chap m-0" style={{ fontSize: 26, letterSpacing: '0.1em', fontWeight: 500 }}>
                      优 选 排 行&nbsp;·&nbsp;TOP&nbsp;10
                    </h2>
                    <div className="prose-zen mt-1" style={{ fontSize: 12 }}>
                      已综合收益效能与参数稳健性进行加权排序
                    </div>
                  </div>
                </div>
                <button
                  onClick={()=>setShowParetoOnly(!showParetoOnly)}
                  className={`btn ${showParetoOnly ? 'btn-cinnabar' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '0.6em 1.4em' }}
                >
                  {showParetoOnly ? '展&nbsp;·&nbsp;全 部' : '仅 · 看 · 帕 · 累 · 托'}
                </button>
              </div>
              <DataTable data={displayData} columns={recommendColumns}
                sortConfig={recommendSort}
                onSort={handleRecommendSort}
                rowClassName={(row) => {
                  const isRec = recommendedParameter?.originalIndex === row.originalIndex;
                  return isRec ? 'font-bold' : '';
                }}
              />
            </section>

            {/* ═══════════════════════════════════════════
                六章 · 原始数据池
            ═══════════════════════════════════════════ */}
            <section className="mx-auto" style={{ maxWidth: 1280, padding: '0 48px 72px' }}>
              <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-5">
                  <span className="seal-v" style={{ padding: '14px 5px' }}>六&nbsp;章</span>
                  <div>
                    <div className="tag mb-1.5">CHAPTER&nbsp;·&nbsp;VI</div>
                    <h2 className="chap m-0" style={{ fontSize: 26, letterSpacing: '0.1em', fontWeight: 500 }}>
                      原 始 数 据 明 细 池
                    </h2>
                    <div className="prose-zen mt-1" style={{ fontSize: 12 }}>
                      完整记录每一组参数的回测表现与过滤状态
                    </div>
                  </div>
                </div>
                <div className="flex gap-0" style={{ borderTop: '1px solid var(--ink-3)', borderBottom: '1px solid var(--ink-4)' }}>
                  {[{key:'combinedScore', label:'综 合 分'}, {key:'utilityScore', label:'效 用 分'}, {key:'originalIndex', label:'原 始 行'}].map(({key, label}) => (
                    <button key={key} onClick={()=>setAllTableSort({ key, direction: key === 'originalIndex' ? 'asc' : 'desc' })}
                      className="tag transition-colors"
                      style={{
                        padding: '10px 18px',
                        background: allTableSort.key===key ? 'var(--paper-warm)' : 'transparent',
                        color:      allTableSort.key===key ? 'var(--cinnabar)'   : 'var(--ink-4)',
                        borderRight: '1px solid var(--line)',
                        fontFamily: 'var(--ff-serif)',
                        cursor: 'pointer',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <DataTable data={allTableData.slice(0, 500)} columns={allDataColumns}
                sortConfig={allTableSort}
                onSort={handleAllTableSort}
                rowClassName={(row) => {
                  const isRec = recommendedParameter?.originalIndex === row.originalIndex;
                  return isRec ? 'font-bold' : '';
                }}
              />
              {allTableData.length > 500 && (
                <div className="prose-zen text-center mt-3" style={{ fontSize: 11 }}>
                  ——&nbsp;仅显示前 500 行&nbsp;·&nbsp;共 {allTableData.length.toLocaleString()} 组&nbsp;——
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          空状态 ── 远山 · 莲花 · 静候
      ═══════════════════════════════════════════ */}
      {data.length === 0 && (
        <section className="mx-auto relative" style={{ maxWidth: 1280, padding: '72px 48px 120px' }}>
          <Ink.DistantPeak style={{ position: 'absolute', left:  0, bottom: 0, width: 320, height: 200, opacity: 0.7 }} />
          <Ink.DistantPeak style={{ position: 'absolute', right: 0, bottom: 0, width: 320, height: 200, opacity: 0.55, transform: 'scaleX(-1)' }} />
          <div className="relative text-center mx-auto" style={{ maxWidth: 520 }}>
            <div className="flex justify-center mb-6">
              <Ink.Lotus size={108} className="breathe" />
            </div>
            <div className="tag mb-4">空&nbsp;·&nbsp;静 候</div>
            <h2 className="chap mb-4" style={{ fontSize: 26, color: 'var(--ink)', letterSpacing: '0.2em', fontWeight: 500 }}>
              静 候 数 据&nbsp;·&nbsp;分 析 待 命
            </h2>
            <div className="prose-zen" style={{ maxWidth: 440, margin: '0 auto' }}>
              上传回测报告后，系统将自动解析数据，通过数学建模从海量结果中，
              锁定具备长效竞争力的核心参数组合。
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          Colophon ── 页脚 · 水纹 · 免责声明
      ═══════════════════════════════════════════ */}
      <footer className="relative mt-8" style={{ borderTop: '1px solid var(--ink-3)' }}>
        <Ink.Water style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, opacity: 0.7 }} />
        <div className="mx-auto flex flex-col md:flex-row gap-4 items-center justify-between relative" style={{ maxWidth: 1280, padding: '40px 48px 32px' }}>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="seal" style={{ padding: '4px 10px' }}>禅&nbsp;道</span>
            <span className="tag">QUANT&nbsp;·&nbsp;LAB&nbsp;·&nbsp;v 3.2</span>
            <span className="chap" style={{ fontSize: 12, color: 'var(--ink-4)' }}>潜在稳健性算法</span>
          </div>
          <div className="prose-zen text-center md:text-right" style={{ fontSize: 11, lineHeight: 1.8 }}>
            回测非预测&nbsp;·&nbsp;稳健先于收益
            <br />
            <span style={{ color: 'var(--ink-5)' }}>仅供策略研究参考&nbsp;·&nbsp;不构成投资建议</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AnalysisDashboard;
