"use client";

import { useEffect, useMemo, useState } from "react";
import {
  aiAnalysisSteps,
  dataAssets,
  issueTypeDistribution,
  issueTypeOptions,
  lineageNodes,
  qualityIssues,
  riskDistribution,
  trendData,
  type DataAsset,
  type IssueStatus,
  type IssueType,
  type LineageNode,
  type QualityIssue,
  type ViewKey,
  type WorkOrder,
  type WorkOrderStatus,
  workOrdersSeed,
} from "./governance-mock";

type ToastTone = "success" | "info" | "warning";
type Toast = { message: string; tone: ToastTone } | null;

const navItems: Array<{ key: ViewKey; label: string; icon: string; badge?: string }> = [
  { key: "health", label: "数据健康", icon: "⌂" },
  { key: "diagnosis", label: "智能诊断", icon: "⌁", badge: "137" },
  { key: "root-cause", label: "根因分析", icon: "◈" },
  { key: "lineage", label: "数据血缘", icon: "⌬" },
  { key: "remediation", label: "整改闭环", icon: "✓", badge: "3" },
  { key: "rules", label: "治理规则", icon: "▦" },
];

const analysisScenarioId = "Q-2026-0001";

function readHashRoute() {
  if (typeof window === "undefined") return { view: "health" as ViewKey, issueId: undefined };
  const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  if (raw.startsWith("diagnosis/")) return { view: "diagnosis" as ViewKey, issueId: raw.split("/")[1] };
  const view = raw as ViewKey;
  return { view: navItems.some((item) => item.key === view) ? view : "health", issueId: undefined };
}

function formatIssueStatus(status: IssueStatus) {
  return status;
}

function statusClass(status: string) {
  if (["高", "已解决", "已关闭"].includes(status)) return "status-danger";
  if (["中", "待确认", "整改中", "待复检"].includes(status)) return "status-warning";
  return "status-safe";
}

function riskClass(risk: string) {
  return risk === "高" ? "risk-high" : risk === "中" ? "risk-medium" : "risk-low";
}

function AppIcon({ children }: { children: string }) {
  return <span className="app-icon" aria-hidden="true">{children}</span>;
}

function AppShell({
  view,
  onNavigate,
  children,
}: {
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="governance-shell">
      <aside className="governance-sidebar">
        <div className="product-brand" onClick={() => onNavigate("health")} role="button" tabIndex={0}>
          <div className="product-mark"><span>AI</span></div>
          <div>
            <strong>智能诊断中心</strong>
            <small>AI Data Governance</small>
          </div>
        </div>

        <div className="sidebar-context">
          <span className="context-dot" />
          <div>
            <strong>福建省企业法人主题数据域</strong>
            <small>政企数据平台 · 生产演示域</small>
          </div>
        </div>

        <div className="nav-caption">智能治理工作台</div>
        <nav className="governance-nav" aria-label="治理中心主导航">
          {navItems.map((item) => (
            <button key={item.key} className={`governance-nav-item ${view === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key)}>
              <AppIcon>{item.icon}</AppIcon>
              <span>{item.label}</span>
              {item.badge && <em>{item.badge}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-flow-card">
          <div className="flow-card-topline"><span className="flow-pulse" />AI 治理闭环</div>
          <strong>让问题自己找到答案</strong>
          <p>从发现异常到自动复检，持续沉淀治理规则。</p>
          <div className="flow-mini-line"><span>发现</span><i>→</i><span>分析</span><i>→</i><span>修复</span></div>
        </div>

        <div className="sidebar-footer">
          <div className="demo-tag"><span />Demo 模拟数据</div>
          <div className="operator-profile">
            <div className="operator-avatar">数</div>
            <div><strong>数据治理管理员</strong><small>省大数据运营中心</small></div>
            <span className="operator-more">•••</span>
          </div>
        </div>
      </aside>

      <main className="governance-main">
        <header className="governance-topbar">
          <div className="breadcrumb"><span>福建省企业法人主题数据域</span><b>/</b><strong>{navItems.find((item) => item.key === view)?.label}</strong></div>
          <div className="topbar-tools">
            <span className="system-status"><i />数据服务正常</span>
            <span className="last-sync">最后同步 2026-08-11 09:30</span>
            <button className="topbar-icon" aria-label="帮助">?</button>
            <button className="topbar-icon notification-dot" aria-label="通知">♧</button>
            <div className="topbar-avatar">管</div>
          </div>
        </header>
        <div className="governance-content">{children}</div>
      </main>
    </div>
  );
}

function PageTitle({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="page-title-row">
      <div>
        <div className="page-eyebrow"><span />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function MetricCard({ label, value, note, tone, onClick }: { label: string; value: string; note: string; tone: string; onClick?: () => void }) {
  return (
    <button className={`metric-card ${tone}`} onClick={onClick}>
      <span className="metric-icon"><AppIcon>{tone === "teal" ? "◈" : tone === "orange" ? "!" : tone === "red" ? "⌁" : "▦"}</AppIcon></span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
      <span className="metric-arrow">↗</span>
    </button>
  );
}

function HealthScoreCard({ currentScore, forecastScore }: { currentScore: number; forecastScore: number }) {
  return (
    <div className="health-score-card">
      <div>
        <div className="card-kicker">DATA HEALTH SCORE</div>
        <h2>数据健康评分</h2>
        <p>基于完整性、一致性、及时性与准确性综合计算。</p>
        <div className="score-change"><strong>{currentScore}</strong><span>→</span><b>{forecastScore}</b><small>预计整改后</small></div>
      </div>
      <div className="score-ring" style={{ "--score": `${currentScore * 3.6}deg` } as React.CSSProperties}><div><strong>{currentScore}</strong><small>/100</small></div></div>
    </div>
  );
}

function TrendChart() {
  const maxIssues = Math.max(...trendData.map((item) => item.issues));
  return (
    <div className="surface chart-surface trend-surface">
      <div className="surface-heading"><div><span className="section-kicker">QUALITY TREND</span><h3>数据质量趋势</h3></div><span className="surface-meta">近 30 天</span></div>
      <div className="trend-chart">
        <div className="trend-grid"><i /><i /><i /><i /></div>
        <div className="trend-bars">
          {trendData.map((item) => <div key={item.label} className="trend-bar-wrap"><span style={{ height: `${Math.max(22, ((item.issues - 130) / (maxIssues - 130)) * 76 + 20)}%` }} /><b>{item.score}</b><small>{item.label}</small></div>)}
        </div>
      </div>
      <div className="chart-legend"><span><i className="legend-teal" />健康评分</span><span><i className="legend-slate" />问题数量</span><b>较上周期 +4.8%</b></div>
    </div>
  );
}

function IssueDistribution({ onFilter }: { onFilter: (type?: IssueType) => void }) {
  return (
    <div className="surface chart-surface distribution-surface">
      <div className="surface-heading"><div><span className="section-kicker">ISSUE CATEGORIES</span><h3>问题类型分布</h3></div><button className="surface-link" onClick={() => onFilter()}>查看全部 <span>→</span></button></div>
      <div className="distribution-list">
        {issueTypeDistribution.map((item) => <button key={item.label} className="distribution-row" onClick={() => onFilter(item.type)}><span className={`distribution-dot ${item.tone}`} /><span>{item.label}</span><div className="distribution-track"><i className={item.tone} style={{ width: `${(item.value / 62) * 100}%` }} /></div><strong>{item.value}</strong><small>条</small></button>)}
      </div>
      <div className="distribution-foot"><span>高频问题集中在经营状态与主体识别字段</span><b>AI 已标记 31 条优先分析</b></div>
    </div>
  );
}

function RiskDistribution() {
  return (
    <div className="surface chart-surface risk-surface">
      <div className="surface-heading"><div><span className="section-kicker">RISK LEVEL</span><h3>风险等级分布</h3></div><span className="surface-meta">共 137 条</span></div>
      <div className="risk-content"><div className="risk-donut"><div><strong>18</strong><small>高风险</small></div></div><div className="risk-list">{riskDistribution.map((item) => <div key={item.label}><span><i className={item.tone} />{item.label}</span><strong>{item.value}</strong><small>条</small></div>)}</div></div>
      <div className="risk-foot"><span className="pulse-dot" />高风险问题需要责任部门在 24 小时内确认</div>
    </div>
  );
}

function AssetTable({ onAssetClick }: { onAssetClick: (asset: DataAsset) => void }) {
  return (
    <div className="surface asset-surface">
      <div className="surface-heading"><div><span className="section-kicker">DATA ASSETS</span><h3>数据资产列表</h3></div><span className="surface-meta">8 张核心数据表</span></div>
      <div className="asset-table-head"><span>数据资产</span><span>所属域</span><span>记录数</span><span>更新时间</span><span>健康度</span><span>问题数</span></div>
      {dataAssets.map((asset) => <button key={asset.id} className="asset-row" onClick={() => onAssetClick(asset)}><span className="asset-name"><i>{asset.name.slice(0, 1)}</i><strong>{asset.name}<small>{asset.tableName}</small></strong></span><span>{asset.domain}</span><span>{asset.recordCount}</span><span>{asset.updateTime.slice(5)}</span><span><b className={`health-mini ${asset.healthScore < 75 ? "low" : asset.healthScore < 88 ? "mid" : "high"}`}>{asset.healthScore}</b></span><span><b className={asset.issueCount > 25 ? "issue-hot" : "issue-normal"}>{asset.issueCount}</b></span></button>)}
    </div>
  );
}

function RecentIssues({ issues, onIssueClick }: { issues: QualityIssue[]; onIssueClick: (issue: QualityIssue) => void }) {
  return (
    <div className="surface recent-surface">
      <div className="surface-heading"><div><span className="section-kicker">RECENT FINDINGS</span><h3>最近发现的问题</h3></div><button className="surface-link" onClick={() => onIssueClick(issues[0])}>进入诊断中心 <span>→</span></button></div>
      <div className="recent-list">{issues.slice(0, 5).map((issue) => <button key={issue.id} className="recent-row" onClick={() => onIssueClick(issue)}><span className={`recent-risk ${riskClass(issue.risk)}`} /> <span className="recent-main"><strong>{issue.description}</strong><small>{issue.id} · {issue.tableLabel} · {issue.fieldLabel}</small></span><span className="recent-confidence">AI {issue.confidence}%</span><span className={`status-pill ${statusClass(issue.status)}`}>{formatIssueStatus(issue.status)}</span></button>)}</div>
    </div>
  );
}

function HealthDashboard({ currentScore, forecastScore, onNavigate, onIssueClick, onFilter, onAssetClick, issues }: { currentScore: number; forecastScore: number; onNavigate: (view: ViewKey) => void; onIssueClick: (issue: QualityIssue) => void; onFilter: (type?: IssueType) => void; onAssetClick: (asset: DataAsset) => void; issues: QualityIssue[] }) {
  return (
    <div className="page-stack">
      <PageTitle eyebrow="AI DATA GOVERNANCE / HEALTH OVERVIEW" title="数据健康驾驶舱" description="以企业法人主体为核心，实时感知数据质量、风险分布与整改进展。" actions={<><button className="secondary-btn" onClick={() => onNavigate("lineage")}>查看数据血缘 <span>↗</span></button><button className="primary-btn" onClick={() => onNavigate("diagnosis")}>进入智能诊断 <span>→</span></button></>} />
      <div className="dashboard-alert"><span className="alert-icon">✦</span><div><strong>AI 已发现 31 条跨系统语义冲突</strong><p>其中 18 条为高风险问题，建议优先分析企业经营状态与统一社会信用代码相关异常。</p></div><button onClick={() => onFilter("跨系统数据冲突")}>查看优先问题 <span>→</span></button></div>
      <div className="metric-grid"><MetricCard label="核心数据表" value="8" note="已纳入 AI 诊断" tone="teal" onClick={() => onNavigate("health")} /><MetricCard label="数据记录数" value="126 万" note="较昨日 +2.1%" tone="blue" /><MetricCard label="疑似质量问题" value="137" note="较上周期 -12 条" tone="orange" onClick={() => onNavigate("diagnosis")} /><MetricCard label="高风险问题" value="18" note="需 24 小时内确认" tone="red" onClick={() => onFilter("跨系统数据冲突")} /></div>
      <div className="dashboard-grid top-grid"><HealthScoreCard currentScore={currentScore} forecastScore={forecastScore} /><TrendChart /><IssueDistribution onFilter={onFilter} /><RiskDistribution /></div>
      <div className="section-heading"><div><span className="section-kicker">ASSET MONITORING</span><h2>资产与问题概览</h2></div><span className="section-note">数据均标明为 Demo 模拟数据</span></div>
      <div className="dashboard-grid bottom-grid"><AssetTable onAssetClick={onAssetClick} /><RecentIssues issues={issues} onIssueClick={onIssueClick} /></div>
    </div>
  );
}

function IssueFilters({ filter, onFilter }: { filter?: IssueType; onFilter: (type?: IssueType) => void }) {
  return <div className="issue-filters">{issueTypeOptions.map((item) => <button key={item.label} className={filter === item.value || (!filter && !item.value) ? "active" : ""} onClick={() => onFilter(item.value)}>{item.label}{item.value && <b>{issueTypeDistribution.find((entry) => entry.type === item.value)?.value ?? ""}</b>}</button>)}</div>;
}

function IssueList({ issues, onIssueClick, filter, onFilter }: { issues: QualityIssue[]; onIssueClick: (issue: QualityIssue) => void; filter?: IssueType; onFilter: (type?: IssueType) => void }) {
  return (
    <div className="page-stack">
      <PageTitle eyebrow="AI QUALITY DIAGNOSIS" title="AI 数据质量问题诊断" description="集中查看质量异常，筛选高风险问题并让 AI 解释问题背后的业务原因。" actions={<button className="primary-btn" onClick={() => onFilter("跨系统数据冲突")}>优先分析跨系统冲突 <span>→</span></button>} />
      <div className="diagnosis-summary"><div><span>当前展示问题</span><strong>{issues.length}</strong><small>条样例</small></div><div><span>AI 建议高优先级</span><strong>31</strong><small>条</small></div><div><span>平均 AI 置信度</span><strong>91.4%</strong><small>基于规则与血缘</small></div><div><span>待责任部门确认</span><strong>3</strong><small>条</small></div></div>
      <div className="filter-toolbar"><div><span className="toolbar-label">问题分类</span><IssueFilters filter={filter} onFilter={onFilter} /></div><div className="toolbar-right"><span className="data-freshness"><i />扫描完成 · 2026-08-11 09:24</span><button className="secondary-btn compact" onClick={() => onFilter()}>重置筛选</button></div></div>
      <div className="surface issue-list-surface"><div className="issue-table-head"><span>问题编号</span><span>问题描述 / 数据表</span><span>字段</span><span>问题类型</span><span>风险</span><span>AI 置信度</span><span>发现时间</span><span>状态</span></div>{issues.map((issue) => <button key={issue.id} className="issue-table-row" onClick={() => onIssueClick(issue)}><span className="issue-id">{issue.id}<small>规则自动发现</small></span><span className="issue-description"><strong>{issue.description}</strong><small>{issue.tableLabel} · {issue.tableName}</small></span><span className="field-cell"><b>{issue.fieldLabel}</b><small>{issue.field}</small></span><span><span className="type-pill">{issue.issueType}</span></span><span><span className={`risk-pill ${riskClass(issue.risk)}`}>{issue.risk}风险</span></span><span className="confidence-cell"><strong>{issue.confidence}%</strong><i><b style={{ width: `${issue.confidence}%` }} /></i></span><span className="time-cell">{issue.foundAt}<small>约 {issue.id.endsWith("0001") ? "10" : "35"} 分钟前</small></span><span><span className={`status-pill ${statusClass(issue.status)}`}>{issue.status}</span></span></button>)}</div>
    </div>
  );
}

function AnalysisTimeline({ active, ready }: { active: boolean; ready: boolean }) {
  const [step, setStep] = useState(active ? 0 : ready ? aiAnalysisSteps.length : 0);
  useEffect(() => {
    if (!active || step >= aiAnalysisSteps.length) return;
    const timer = window.setTimeout(() => setStep((current) => current + 1), 260);
    return () => window.clearTimeout(timer);
  }, [active, step]);
  const displayStep = active ? step : ready ? aiAnalysisSteps.length : 0;
  return <div className="ai-timeline">{aiAnalysisSteps.map((item, index) => <div key={item.label} className={`ai-step ${index < displayStep ? "done" : index === displayStep && active ? "current" : ""}`}><span className="ai-step-icon">{index < displayStep ? "✓" : index + 1}</span><div><strong>{item.label}</strong><p>{index < displayStep ? item.detail : index === displayStep && active ? "AI 正在检索本地 Mock 数据与血缘关系…" : "等待分析"}</p></div><small>{index < displayStep ? "完成" : index === displayStep && active ? "分析中" : ""}</small></div>)}</div>;
}

function IssueDetail({ issue, onBack, onAnalyze, analyzing, analysisReady }: { issue: QualityIssue; onBack: () => void; onAnalyze: () => void; analyzing: boolean; analysisReady: boolean }) {
  return (
    <div className="page-stack detail-page">
      <button className="back-link" onClick={onBack}>← 返回问题列表</button>
      <PageTitle eyebrow={`ISSUE DETAIL / ${issue.id}`} title="质量问题详情" description="查看异常样本、规则证据与 AI 诊断入口。" actions={<span className={`status-pill ${statusClass(issue.status)} large-status`}>{issue.status}</span>} />
      <div className="detail-grid"><div className="detail-main"><div className="surface issue-hero"><div className="issue-hero-top"><div><span className={`risk-pill ${riskClass(issue.risk)}`}>{issue.risk}风险</span><span className="type-pill">{issue.issueType}</span></div><span className="detail-found">发现于 {issue.foundAt}</span></div><h2>{issue.description}</h2><p>{issue.tableLabel}中的「{issue.fieldLabel}」触发了跨数据集质量检测。AI 会结合元数据、规则、血缘与历史异常进行进一步判断。</p><div className="detail-kv-grid"><div><span>问题编号</span><strong>{issue.id}</strong></div><div><span>数据表</span><strong>{issue.tableLabel}</strong><small>{issue.tableName}</small></div><div><span>异常字段</span><strong>{issue.fieldLabel}</strong><small>{issue.field}</small></div><div><span>涉及系统</span><strong>{issue.systems.length} 个</strong><small>{issue.systems.join(" / ")}</small></div></div></div><div className="surface evidence-card"><div className="surface-heading"><div><span className="section-kicker">OBSERVED EVIDENCE</span><h3>异常样本与规则证据</h3></div><span className="rule-code">RULE · Q-STATUS-004</span></div><div className="evidence-value"><span>同一主体的经营状态返回值</span><strong>{issue.sampleValue}</strong></div><div className="evidence-checks"><div><i>✓</i><span>字段定义已匹配<small>operation_status · 枚举型</small></span></div><div><i>✓</i><span>跨系统一致性规则已命中<small>同一主体状态差异不得超过 1 个同步周期</small></span></div><div><i>!</i><span>同步时间存在异常<small>源系统领先主数据 17 小时 26 分</small></span></div></div></div></div><aside className="detail-side"><div className="surface ai-action-card"><div className="ai-card-glow">✦</div><span className="section-kicker">AI DIAGNOSIS</span><h3>让 AI 分析根因</h3><p>AI 将读取元数据、字段定义、数据质量规则、上下游血缘、历史异常与数据更新时间。</p><button className="primary-btn full-width" onClick={onAnalyze} disabled={analyzing}>{analyzing ? "AI 正在分析…" : analysisReady ? "重新分析根因" : "让 AI 分析根因"}<span>{analyzing ? "···" : "→"}</span></button><AnalysisTimeline key={`${analyzing}-${analysisReady}`} active={analyzing} ready={analysisReady} /></div><div className="surface confidence-card"><span className="section-kicker">MODEL EVIDENCE</span><div className="confidence-big"><strong>{issue.confidence}%</strong><span>AI 置信度</span></div><p>基于 6 类证据综合判断，已达到高可信分析阈值。</p><div className="confidence-bar"><i style={{ width: `${issue.confidence}%` }} /></div></div></aside></div>
    </div>
  );
}

function LineageNodeCard({ node, onClick, compact = false }: { node: LineageNode; onClick: (node: LineageNode) => void; compact?: boolean }) {
  return <button className={`lineage-node ${node.status} ${compact ? "compact" : ""}`} onClick={() => onClick(node)}><span className="node-type">{node.type === "system" ? "SYS" : node.type === "table" ? "DB" : node.type === "job" ? "JOB" : node.type === "api" ? "API" : "APP"}</span><strong>{node.label}</strong><small>{node.subLabel}</small><i className="node-status-dot" /></button>;
}

function MetadataDrawer({ node, onClose }: { node: LineageNode; onClose: () => void }) {
  return <div className="metadata-drawer"><div className="drawer-heading"><div><span className="section-kicker">NODE METADATA</span><h3>{node.label}</h3></div><button onClick={onClose}>×</button></div><span className={`node-state ${node.status}`}>{node.status === "error" ? "异常节点" : node.status === "warning" ? "存在影响" : "运行正常"}</span><p>{node.metadata.description}</p><div className="drawer-kv"><div><span>节点类型</span><strong>{node.type === "table" ? "数据表" : node.type === "job" ? "任务" : node.type === "api" ? "数据服务 API" : node.type === "application" ? "应用" : "系统"}</strong></div><div><span>数据负责人</span><strong>{node.metadata.owner}</strong></div><div><span>最近更新时间</span><strong>{node.metadata.updateTime}</strong></div><div><span>数据规模</span><strong>{node.metadata.recordCount}</strong></div></div><button className="secondary-btn full-width" onClick={onClose}>关闭节点详情</button></div>;
}

function RootLineage({ onNodeClick }: { onNodeClick: (node: LineageNode) => void }) {
  const node = (id: string) => lineageNodes.find((item) => item.id === id)!;
  return <div className="lineage-canvas"><div className="lineage-column source-col"><span className="lineage-col-label">权威源</span><LineageNodeCard node={node("source-registration")} onClick={onNodeClick} /><div className="lineage-connector vertical" /><LineageNodeCard node={node("source-change")} onClick={onNodeClick} compact /></div><div className="lineage-column base-col"><span className="lineage-col-label">基础数据层</span><LineageNodeCard node={node("base-enterprise")} onClick={onNodeClick} /><div className="lineage-connector vertical" /><LineageNodeCard node={node("base-status")} onClick={onNodeClick} /><div className="lineage-connector vertical faint" /><LineageNodeCard node={node("relationship")} onClick={onNodeClick} compact /></div><div className="lineage-column master-col"><span className="lineage-col-label">主数据层</span><div className="lineage-branch"><LineageNodeCard node={node("master-data")} onClick={onNodeClick} /><div className="lineage-alert-note"><span>!</span>异常：同步任务失败</div></div><div className="lineage-connector vertical" /><LineageNodeCard node={node("etl-increment")} onClick={onNodeClick} compact /><div className="lineage-connector vertical faint" /><LineageNodeCard node={node("quality-job")} onClick={onNodeClick} compact /></div><div className="lineage-column service-col"><span className="lineage-col-label">服务层</span><LineageNodeCard node={node("query-api")} onClick={onNodeClick} compact /><LineageNodeCard node={node("risk-api")} onClick={onNodeClick} compact /><LineageNodeCard node={node("search-index")} onClick={onNodeClick} compact /></div><div className="lineage-column app-col"><span className="lineage-col-label">应用层</span><LineageNodeCard node={node("portrait-app")} onClick={onNodeClick} /><div className="lineage-connector vertical" /><LineageNodeCard node={node("risk-app")} onClick={onNodeClick} compact /></div><div className="lineage-horizontal h-1" /><div className="lineage-horizontal h-2" /><div className="lineage-horizontal h-3" /><div className="lineage-horizontal h-4" /><div className="lineage-flow-label source-to-base">字段同步</div><div className="lineage-flow-label master-to-api">主数据分发</div><div className="lineage-flow-label api-to-app">服务调用</div></div>;
}

function ImpactPanel() {
  return <div className="impact-panel"><div className="surface-heading"><div><span className="section-kicker">IMPACT SCOPE</span><h3>影响范围</h3></div><span className="impact-badge">AI 已定位</span></div><div className="impact-total"><strong>7</strong><span>个下游对象受到影响</span></div><div className="impact-list"><div><span className="impact-icon table">▤</span><strong>4</strong><span>张下游数据表</span></div><div><span className="impact-icon api">⌁</span><strong>2</strong><span>个数据服务 API</span></div><div><span className="impact-icon app">◫</span><strong>1</strong><span>个企业画像应用</span></div></div><p>异常经营状态可能影响企业查询、风险识别与画像展示结果。</p></div>;
}

function RootCausePage({ issue, analysisReady, analyzing, suggestionGenerated, onAnalyze, onGenerateSuggestion, onCreateWorkOrder, onRecheck, onNavigate, onNodeClick, workOrder }: { issue: QualityIssue; analysisReady: boolean; analyzing: boolean; suggestionGenerated: boolean; onAnalyze: () => void; onGenerateSuggestion: () => void; onCreateWorkOrder: () => void; onRecheck: () => void; onNavigate: (view: ViewKey) => void; onNodeClick: (node: LineageNode) => void; workOrder?: WorkOrder }) {
  const scenarioReady = analysisReady || issue.status !== "待诊断";
  return <div className="page-stack root-page"><PageTitle eyebrow="AI ROOT CAUSE & IMPACT ANALYSIS" title="AI 根因与影响分析" description="AI 不只告诉你数据错了，还会解释为什么错、影响谁、应该怎么改。" actions={<><button className="secondary-btn" onClick={() => onNavigate("diagnosis")}>返回问题列表</button><button className="primary-btn" onClick={onAnalyze} disabled={analyzing}>{analyzing ? "分析中…" : "重新运行 AI 分析"} <span>✦</span></button></>} />
    {!scenarioReady && <div className="analysis-pending"><div className="pending-icon">✦</div><div><strong>准备开始 AI 根因分析</strong><p>点击右上角按钮，AI 将读取元数据、质量规则、血缘关系与历史异常。</p></div><button className="primary-btn" onClick={onAnalyze}>让 AI 分析根因 <span>→</span></button></div>}
    <div className="root-summary-grid"><div className="root-verdict surface"><div className="verdict-label"><span className="ai-spark">✦</span>问题判断</div><h2>同一企业主体在多个业务系统中的经营状态存在冲突。</h2><div className="system-status-grid"><div><span className="system-letter">A</span><div><strong>企业登记源系统</strong><small>正常经营</small></div><b className="status-safe">权威源</b></div><div className="conflict-cell"><span>≠</span><small>语义不一致</small></div><div><span className="system-letter b">B</span><div><strong>企业主数据</strong><small>已注销</small></div><b className="status-danger">异常值</b></div><div><span className="system-letter c">C</span><div><strong>企业画像应用</strong><small>正常经营</small></div><b className="status-warning">未同步</b></div></div></div><div className="root-confidence surface"><span className="section-kicker">AI CONFIDENCE</span><div className="root-confidence-value"><strong>{scenarioReady ? "92%" : "—"}</strong><span>综合置信度</span></div><p>结合 6 类证据计算</p><div className="confidence-bar"><i style={{ width: scenarioReady ? "92%" : "0%" }} /></div><div className="confidence-evidence"><span>元数据</span><span>规则</span><span>血缘</span><span>历史</span></div></div><div className="root-cause-card surface"><div className="verdict-label"><span className="ai-spark orange">⌁</span>疑似根因</div><p>权威源系统于 <strong>2026-07-18</strong> 更新企业经营状态，但下游 ETL 增量同步任务执行失败，导致企业主数据系统未同步最新状态。</p><div className="root-cause-meta"><span><i />检测到 ETL 失败记录</span><span><i />源数据领先 17 小时 26 分</span></div></div></div>
    <div className="section-heading root-section-heading"><div><span className="section-kicker">LINEAGE IMPACT MAP</span><h2>数据血缘影响分析</h2></div><span className="section-note"><i className="legend-error" />异常节点 <i className="legend-warning" />受影响节点 <b>点击节点查看元数据</b></span></div>
    <div className="root-lineage-surface surface"><div className="lineage-header-note"><span><i className="lineage-live-dot" />影响路径已展开</span><strong>企业经营状态字段 · 2026-07-18 同步窗口</strong></div><RootLineage onNodeClick={onNodeClick} /></div>
    <div className="impact-recommend-grid"><ImpactPanel /><div className="surface recommendation-card"><div className="surface-heading"><div><span className="section-kicker">AI REMEDIATION PLAN</span><h3>AI 整改建议</h3></div><span className={`suggestion-state ${suggestionGenerated ? "generated" : ""}`}>{suggestionGenerated ? "已生成" : "待生成"}</span></div>{!suggestionGenerated ? <div className="recommend-empty"><div className="recommend-orbit">✦</div><p>让 AI 根据当前根因和影响范围生成可执行的整改步骤。</p><button className="primary-btn" onClick={onGenerateSuggestion}>生成整改建议 <span>✦</span></button></div> : <div className="recommend-list"><div><span>01</span><p>将企业登记源系统作为经营状态字段的权威数据源。</p></div><div><span>02</span><p>检查 2026-07-18 ETL 增量任务执行日志，定位失败原因。</p></div><div><span>03</span><p>对经营状态字段执行增量补同步，并对 4 张下游表重新校验。</p></div><div><span>04</span><p>连续 7 天监控该字段同步质量，新增跨系统语义冲突告警。</p></div><div className="recommend-actions">{!workOrder ? <button className="primary-btn" onClick={onCreateWorkOrder}>提交整改工单 <span>→</span></button> : workOrder.status === "待复检" ? <button className="primary-btn" onClick={onRecheck}>重新检测 <span>↻</span></button> : workOrder.status === "已关闭" ? <span className="workorder-created"><i>✓</i>问题已关闭并沉淀治理规则</span> : <button className="secondary-btn" onClick={() => onNavigate("remediation")}>前往整改闭环 <span>→</span></button>}</div></div>}</div></div>
  </div>;
}

function StandaloneLineagePage({ onNodeClick }: { onNodeClick: (node: LineageNode) => void }) {
  return <div className="page-stack"><PageTitle eyebrow="DATA LINEAGE EXPLORER" title="数据血缘" description="从权威源到数据服务，查看企业法人主题数据的上下游依赖关系。" actions={<span className="lineage-mode-pill"><i />影响模式已开启</span>} /><div className="lineage-kpi-row"><div><span>血缘节点</span><strong>16</strong><small>系统 / 表 / 服务 / 应用</small></div><div><span>可追溯字段</span><strong>286</strong><small>已纳入规则管理</small></div><div><span>异常节点</span><strong className="text-danger">3</strong><small>需要关注</small></div><div><span>最近变更</span><strong>09:24</strong><small>数据质量扫描</small></div></div><div className="surface standalone-lineage"><div className="lineage-header-note"><span><i className="lineage-live-dot" />全域血缘图</span><strong>共 16 个节点 · 22 条数据流</strong></div><RootLineage onNodeClick={onNodeClick} /></div></div>;
}

function WorkOrderTable({ workOrders, onAdvance }: { workOrders: WorkOrder[]; onAdvance: (order: WorkOrder) => void }) {
  const actionLabel = (status: WorkOrderStatus) => status === "待确认" ? "确认接单" : status === "整改中" ? "模拟整改完成" : status === "待复检" ? "重新检测" : "已关闭";
  return <div className="surface workorder-surface"><div className="surface-heading"><div><span className="section-kicker">REMEDIATION WORK ORDERS</span><h3>整改工单列表</h3></div><span className="surface-meta">共 {workOrders.length} 条工单</span></div><div className="workorder-head"><span>工单 / 整改事项</span><span>责任部门</span><span>Owner</span><span>优先级</span><span>整改状态</span><span>复检结果</span><span>操作</span></div>{workOrders.map((order) => <div key={order.id} className="workorder-row"><span><strong>{order.title}</strong><small>{order.id} · 关联问题 {order.issueId}</small></span><span>{order.department}</span><span>{order.owner}</span><span><b className={`priority-badge ${order.priority.toLowerCase()}`}>{order.priority}</b></span><span><span className={`status-pill ${statusClass(order.status)}`}>{order.status}</span></span><span className={order.recheckResult === "已通过" ? "recheck-ok" : "recheck-pending"}>{order.recheckResult}</span><span>{order.status !== "已关闭" && <button className="table-action-btn" onClick={() => onAdvance(order)}>{actionLabel(order.status)} <span>→</span></button>}</span></div>)}</div>;
}

function RemediationPage({ workOrders, currentScore, onAdvance }: { workOrders: WorkOrder[]; currentScore: number; onAdvance: (order: WorkOrder) => void }) {
  const closed = workOrders.filter((order) => order.status === "已关闭").length;
  return <div className="page-stack"><PageTitle eyebrow="CLOSED-LOOP GOVERNANCE" title="整改闭环" description="让 AI 建议进入治理工单，责任部门执行整改，系统自动复检并沉淀规则。" actions={<button className="primary-btn" onClick={() => onAdvance(workOrders[0])}>推进首条工单 <span>→</span></button>} /><div className="closure-flow"><div className="closure-flow-line" />{["发现问题", "AI 判断", "高优先级问题", "责任部门确认", "执行整改", "自动复检", "关闭问题", "沉淀治理规则"].map((label, index) => <div key={label} className={`closure-step ${index < 5 ? "done" : index === 5 ? "current" : ""}`}><span>{index < 5 ? "✓" : index + 1}</span><strong>{label}</strong></div>)}</div><div className="closure-metrics"><div><span>发现问题</span><strong>137</strong><small>本周期累计</small></div><div><span>AI 建议高优先级</span><strong>31</strong><small>优先分析</small></div><div><span>已整改</span><strong>{28 + Math.max(0, closed - 7)}</strong><small>已通过复检</small></div><div><span>待确认</span><strong>{workOrders.filter((order) => order.status === "待确认").length}</strong><small>责任部门确认</small></div><div className="closure-score"><span>健康评分</span><strong>{currentScore} <b>→</b> 89</strong><small>整改闭环目标</small></div></div><div className="closure-callout"><span className="callout-icon">✦</span><div><strong>AI 正在帮助治理团队把“问题发现”变成“结果可验证”</strong><p>当前已有 28 个问题完成整改并通过自动复检，3 个高风险问题等待责任部门确认。</p></div><span className="callout-progress"><i style={{ width: "90%" }} />90%</span></div><WorkOrderTable workOrders={workOrders} onAdvance={onAdvance} /></div>;
}

function RulesPage() {
  const rules = [
    ["Q-STATUS-004", "经营状态跨系统一致性", "跨系统", "已启用", "每 30 分钟"],
    ["Q-MASTER-001", "统一社会信用代码唯一性", "主键约束", "已启用", "每日 02:00"],
    ["Q-REL-006", "企业关联关系主体可解析", "关联一致性", "已启用", "每小时"],
    ["Q-FIELD-018", "法人姓名非空校验", "完整性", "已启用", "每小时"],
    ["Q-ADDR-012", "行政区划编码有效性", "字段有效性", "待优化", "每日 03:00"],
  ];
  return <div className="page-stack"><PageTitle eyebrow="GOVERNANCE RULE CENTER" title="治理规则" description="查看支撑 AI 诊断的字段、跨表与跨系统质量规则。" actions={<button className="primary-btn">新建治理规则 <span>＋</span></button>} /><div className="rule-overview"><div><span>规则总数</span><strong>286</strong><small>启用 244 条</small></div><div><span>跨系统规则</span><strong>42</strong><small>覆盖 8 张核心表</small></div><div><span>本周期命中</span><strong>137</strong><small>自动生成质量问题</small></div></div><div className="surface rules-surface"><div className="surface-heading"><div><span className="section-kicker">RULE CATALOG</span><h3>核心治理规则</h3></div><span className="surface-meta">规则会作为 AI 诊断证据</span></div><div className="rules-head"><span>规则编号</span><span>规则名称</span><span>规则类型</span><span>状态</span><span>执行频率</span></div>{rules.map((rule) => <div className="rules-row" key={rule[0]}><strong>{rule[0]}</strong><span>{rule[1]}</span><span className="type-pill">{rule[2]}</span><span className={`status-pill ${rule[3] === "已启用" ? "status-safe" : "status-warning"}`}>{rule[3]}</span><span>{rule[4]}</span></div>)}</div></div>;
}

export default function Home() {
  const initialRoute = readHashRoute();
  const [view, setView] = useState<ViewKey>(initialRoute.view);
  const [selectedIssueId, setSelectedIssueId] = useState(initialRoute.issueId);
  const [issueFilter, setIssueFilter] = useState<IssueType | undefined>();
  const [issues, setIssues] = useState(qualityIssues);
  const [workOrders, setWorkOrders] = useState(workOrdersSeed);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestionGenerated, setSuggestionGenerated] = useState(false);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? issues[0];
  const scenarioIssue = issues.find((issue) => issue.id === analysisScenarioId) ?? issues[0];
  const scenarioWorkOrder = workOrders.find((order) => order.issueId === analysisScenarioId);
  const resolvedCount = issues.filter((issue) => issue.status === "已解决").length;
  const currentScore = resolvedCount > 0 ? 89 : 72;
  const filteredIssues = useMemo(() => issueFilter ? issues.filter((issue) => issue.issueType === issueFilter) : issues, [issueFilter, issues]);

  function notify(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2800);
  }

  function navigate(nextView: ViewKey, issueId?: string) {
    const hash = issueId ? `#/diagnosis/${issueId}` : `#/${nextView}`;
    if (typeof window !== "undefined" && window.location.hash !== hash) window.location.hash = hash;
    setView(nextView);
    setSelectedIssueId(issueId);
    if (nextView !== "diagnosis") setIssueFilter(undefined);
  }

  function navigateToIssue(issue: QualityIssue) {
    setSelectedIssueId(issue.id);
    navigate("diagnosis", issue.id);
  }

  function filterIssues(type?: IssueType) {
    setIssueFilter(type);
    navigate("diagnosis");
  }

  function startAnalysis() {
    setSelectedIssueId(analysisScenarioId);
    setAnalysisReady(false);
    setAnalyzing(true);
    setSuggestionGenerated(false);
    navigate("root-cause");
    notify("AI 已开始读取元数据、规则与数据血缘", "info");
    window.setTimeout(() => {
      setAnalyzing(false);
      setAnalysisReady(true);
      setIssues((current) => current.map((issue) => issue.id === analysisScenarioId ? { ...issue, status: "待确认" } : issue));
      notify("AI 根因分析完成，已定位影响范围", "success");
    }, 1900);
  }

  function generateSuggestion() {
    setSuggestionGenerated(true);
    notify("AI 整改建议已生成，可提交为治理工单", "success");
  }

  function createWorkOrder() {
    if (scenarioWorkOrder) {
      notify(`工单 ${scenarioWorkOrder.id} 已存在`, "info");
      return;
    }
    const newOrder: WorkOrder = { id: "WO-2026-0119", issueId: analysisScenarioId, title: "补同步企业经营状态字段并重跑下游校验", department: "省大数据运营中心", owner: "陈立峰", priority: "P0", status: "待确认", aiSuggestion: "将企业登记源系统作为权威源，检查 2026-07-18 ETL 增量任务并执行补同步。", recheckResult: "待复检", dueDate: "2026-08-12" };
    setWorkOrders((current) => [newOrder, ...current]);
    setIssues((current) => current.map((issue) => issue.id === analysisScenarioId ? { ...issue, status: "整改中" } : issue));
    notify(`整改工单 ${newOrder.id} 已提交，责任部门待确认`, "success");
  }

  function advanceWorkOrder(order: WorkOrder) {
    const next: WorkOrderStatus = order.status === "待确认" ? "整改中" : order.status === "整改中" ? "待复检" : order.status === "待复检" ? "已关闭" : "已关闭";
    if (next === order.status) return;
    setWorkOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: next, recheckResult: next === "已关闭" ? "已通过" : item.recheckResult } : item));
    setIssues((current) => current.map((issue) => issue.id === order.issueId ? { ...issue, status: next === "已关闭" ? "已解决" : next } : issue));
    notify(next === "已关闭" ? "自动复检通过，问题已关闭" : `工单已推进至「${next}」`, next === "已关闭" ? "success" : "info");
  }

  useEffect(() => {
    function syncRoute() {
      const route = readHashRoute();
      setView(route.view);
      setSelectedIssueId(route.issueId);
    }
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  return <AppShell view={view} onNavigate={(nextView) => navigate(nextView)}>
    {view === "health" && <HealthDashboard currentScore={currentScore} forecastScore={91} onNavigate={navigate} onIssueClick={navigateToIssue} onFilter={filterIssues} onAssetClick={(asset) => { notify(`${asset.name} 已打开，正在跳转智能诊断`, "info"); filterIssues(); }} issues={issues} />}
    {view === "diagnosis" && selectedIssueId && <IssueDetail issue={selectedIssue} onBack={() => navigate("diagnosis")} onAnalyze={startAnalysis} analyzing={analyzing} analysisReady={analysisReady} />}
    {view === "diagnosis" && !selectedIssueId && <IssueList issues={filteredIssues} onIssueClick={navigateToIssue} filter={issueFilter} onFilter={filterIssues} />}
    {view === "root-cause" && <RootCausePage issue={scenarioIssue} analysisReady={analysisReady} analyzing={analyzing} suggestionGenerated={suggestionGenerated} onAnalyze={startAnalysis} onGenerateSuggestion={generateSuggestion} onCreateWorkOrder={createWorkOrder} onRecheck={() => scenarioWorkOrder && advanceWorkOrder({ ...scenarioWorkOrder, status: "待复检" })} onNavigate={navigate} onNodeClick={setSelectedNode} workOrder={scenarioWorkOrder} />}
    {view === "lineage" && <StandaloneLineagePage onNodeClick={setSelectedNode} />}
    {view === "remediation" && <RemediationPage workOrders={workOrders} currentScore={currentScore} onAdvance={advanceWorkOrder} />}
    {view === "rules" && <RulesPage />}
    {selectedNode && <MetadataDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />}
    {toast && <div className={`toast-message ${toast.tone}`}><span>{toast.tone === "success" ? "✓" : toast.tone === "warning" ? "!" : "✦"}</span>{toast.message}</div>}
  </AppShell>;
}
