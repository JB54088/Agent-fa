"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, siteConfig, statusLabel, type BrandConfig, type Project } from "./data";
import { dataSourcesSeed } from "../db/seeds/data-sources";
import { organizationsSeed } from "../db/seeds/organizations";
import { nationalSourceDirectory, nationalSourceDirectorySummary } from "../db/seeds/national-source-directory";

type AdminTab = "overview" | "targets" | "coverage" | "sources" | "review" | "imports" | "verifications" | "tasks" | "settings";
type SourceStatus = "运行中" | "待检查" | "已暂停";
type RawStatus = "待审核" | "审核中" | "已转正式" | "已驳回" | "暂不处理";
type TaskStatus = "待处理" | "已认领" | "处理中" | "已完成";
type InitialSyncProgress = {
  total: number;
  completed: number;
  currentRecruitment: number;
  officialSourceFound: number;
  noCurrentRecruitment: number;
  upcoming: number;
  accessFailed: number;
  sourceNotFound: number;
  needsReview: number;
  notChecked: number;
};

type SourceRecord = {
  id: string;
  name: string;
  company: string;
  type: string;
  level: "A级" | "B级" | "C级" | "D级";
  method: string;
  frequency: string;
  lastChecked: string;
  lastSuccess: string;
  fingerprint: string;
  status: SourceStatus;
  review: boolean;
  note: string;
};

type RawItem = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  collectedAt: string;
  publishedAt: string;
  parseStatus: "成功" | "部分成功" | "失败";
  reviewStatus: RawStatus;
  duplicateStatus: "唯一" | "疑似重复" | "待判断";
  summary: string;
  content: string;
  parser: string;
};

type AdminTask = {
  id: string;
  type: string;
  title: string;
  source: string;
  priority: "高" | "中" | "低";
  status: TaskStatus;
  assignee: string;
  due: string;
  note: string;
};

const sourceSeed: SourceRecord[] = [];

// 静态站点不伪造原始采集记录或管理员任务；真实数据进入数据库后由接口填充。
const rawSeed: RawItem[] = [];
const taskSeed: AdminTask[] = [];

const tabs: { id: AdminTab; label: string; icon: string }[] = [
  { id: "overview", label: "运营总览", icon: "⌂" },
  { id: "targets", label: "目标单位", icon: "▥" },
  { id: "coverage", label: "全国覆盖", icon: "◎" },
  { id: "sources", label: "数据源管理", icon: "◎" },
  { id: "review", label: "采集审核", icon: "✓" },
  { id: "imports", label: "Excel导入", icon: "▤" },
  { id: "verifications", label: "信息复核", icon: "◷" },
  { id: "tasks", label: "任务中心", icon: "⚑" },
  { id: "settings", label: "站点配置", icon: "⚙" },
];

export default function AdminConsole({ projects: catalogProjects, brand, onBrandChange, onOpen, onNotify }: { projects: Project[]; brand: BrandConfig; onBrandChange: (brand: BrandConfig) => void; onOpen: (project: Project) => void; onNotify: (message: string) => void }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [sources, setSources] = useState(sourceSeed);
  const [rawItems, setRawItems] = useState(rawSeed);
  const [tasksState, setTasksState] = useState(taskSeed);
  const [selectedRawId, setSelectedRawId] = useState("");
  const [bootstrapState, setBootstrapState] = useState<"checking" | "available" | "admin" | "unavailable">("checking");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/collection-review")
      .then((response) => response.json() as Promise<{ ok?: boolean; items?: RawItem[] }>)
      .then((payload) => {
        if (active && payload.ok && Array.isArray(payload.items)) setRawItems(payload.items);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch("/api/admin/bootstrap")
      .then((response) => response.json() as Promise<{ ok?: boolean; isAdmin?: boolean; canBootstrap?: boolean }>)
      .then((payload) => setBootstrapState(payload.ok && payload.isAdmin ? "admin" : payload.ok && payload.canBootstrap ? "available" : "unavailable"))
      .catch(() => setBootstrapState("unavailable"));
  }, []);

  async function bootstrapCurrentAccount() {
    setBootstrapState("checking");
    try {
      const response = await fetch("/api/admin/bootstrap", { method: "POST" });
      const payload = await response.json() as { ok?: boolean; error?: string; role?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "管理员初始化失败");
      setBootstrapState("admin");
      onNotify(`当前账号已设置为${payload.role ?? "管理员"}`);
    } catch (error) {
      setBootstrapState("unavailable");
      onNotify(error instanceof Error && error.message === "admin_bootstrap_already_completed" ? "管理员初始化已完成，请使用已有管理员账号" : "管理员初始化失败，请检查登录状态和数据库连接");
    }
  }

  const pendingReview = rawItems.filter((item) => ["待审核", "审核中"].includes(item.reviewStatus)).length;
  const openTasks = tasksState.filter((task) => task.status !== "已完成").length;

  async function updateRaw(id: string, status: RawStatus, message: string) {
    try {
      const response = await fetch("/api/admin/collection-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status, note: message }),
      });
      if (!response.ok) throw new Error("review_action_failed");
      setRawItems((current) => current.map((item) => item.id === id ? { ...item, reviewStatus: status } : item));
      onNotify(message);
    } catch {
      onNotify("审核操作未保存：数据库或管理员权限尚未连接");
    }
  }

  function claimTask(task: AdminTask) {
    setTasksState((current) => current.map((item) => item.id === task.id ? { ...item, status: "处理中", assignee: "当前管理员" } : item));
    onNotify(`已认领「${task.title}」`);
  }

  function completeTask(task: AdminTask) {
    setTasksState((current) => current.map((item) => item.id === task.id ? { ...item, status: "已完成" } : item));
    onNotify("任务已完成，处理记录已保存");
  }

  function downloadTemplate() {
    const header = ["企业名称", "招聘项目名称", "招聘批次", "毕业年份", "学历要求", "招聘专业原文", "标准专业名称", "专业大类", "招聘地区", "公告发布时间", "招聘开始时间", "报名截止时间", "官方公告链接", "官方报名链接", "来源名称", "来源链接", "来源级别", "时间核验状态", "管理员备注"];
    const csv = `\ufeff${header.join(",")}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "校招雷达招聘信息导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
    onNotify("Excel模板已下载，CSV可直接用Excel打开");
  }

  return <>
    <div className="page-heading admin-heading">
      <div><span className="eyebrow"><span className="eyebrow-line" />ADMIN CONSOLE · OPERATIONS</span><h1>招聘数据运营</h1><p>公开来源先进入原始采集，再由管理员审核后发布。</p></div>
      <div className="admin-heading-actions"><span className="safe-collection-badge">⌁ 仅访问公开内容</span>{bootstrapState === "available" && <button className="secondary-button" onClick={bootstrapCurrentAccount}>设置当前账号为管理员</button>}<button className="primary-button" onClick={() => setTab("review")}>进入审核队列 <span>→</span></button></div>
    </div>
    <div className="admin-tabs" role="tablist" aria-label="管理员功能">
      {tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id}><span>{item.icon}</span>{item.label}{item.id === "review" && pendingReview > 0 && <b>{pendingReview}</b>}{item.id === "tasks" && openTasks > 0 && <b>{openTasks}</b>}</button>)}
    </div>

    {tab === "overview" && <AdminOverview projects={catalogProjects} pendingReview={pendingReview} openTasks={openTasks} onTab={setTab} onOpen={onOpen} />}
    {tab === "targets" && <TargetOrganizationDirectory onNotify={onNotify} />}
    {tab === "coverage" && <NationalCoverageDirectory />}
    {tab === "sources" && <SourceManagement sources={sources} onToggle={(id) => { setSources((current) => current.map((source) => source.id === id ? { ...source, status: source.status === "已暂停" ? "待检查" : "已暂停" } : source)); onNotify("数据源状态已更新"); }} onCheck={(id) => { setSources((current) => current.map((source) => source.id === id ? { ...source, status: "运行中", lastChecked: "刚刚", lastSuccess: "刚刚" } : source)); onNotify("已创建一次公开页面检查任务"); }} />}
    {tab === "review" && <ReviewWorkbench items={rawItems} selectedId={selectedRawId} onSelect={setSelectedRawId} onAction={updateRaw} />}
    {tab === "imports" && <ImportPanel onDownload={downloadTemplate} onNotify={onNotify} />}
    {tab === "verifications" && <VerificationPanel projects={catalogProjects} onNotify={onNotify} onOpen={onOpen} />}
    {tab === "tasks" && <TaskCenter tasks={tasksState} onClaim={claimTask} onComplete={completeTask} />}
    {tab === "settings" && <BrandSettings brand={brand} onSave={(next) => { onBrandChange(next); onNotify("站点品牌配置已保存，前台已同步"); }} />}
  </>;
}

function NationalCoverageDirectory() {
  type DirectoryDatabaseAfter = { organizations: number; regions: number; registered_sources: number; verified_sources: number; review_sources: number; enterprise_sources: number; national_civil_service_sources: number; provincial_civil_service_sources: number; central_soe_sources: number; local_soe_sources: number };
  type DirectoryCatalog = { enterpriseOrganizations: number; enterpriseSources: number; nationalSources: number; regions: number };
  const [category, setCategory] = useState("全部");
  const [batchRunning, setBatchRunning] = useState(false);
  const [initialSyncProgress, setInitialSyncProgress] = useState<InitialSyncProgress | null>(null);
  const [initialSyncReport, setInitialSyncReport] = useState<{ batch: string; processed: number; summary?: { rawInserted: number; stagingInserted: number; formalAdded: number; duplicate: number; updated: number; failed: number } } | null>(null);
  const [directorySyncRunning, setDirectorySyncRunning] = useState(false);
  const [monitoringImportRunning, setMonitoringImportRunning] = useState(false);
  const [incrementalRunning, setIncrementalRunning] = useState(false);
  const [incrementalReport, setIncrementalReport] = useState<{ activePeriod: string; sourceSummary?: { due: number; scanned: number; unchanged: number; changed: number; blocked: number; failed: number }; pipeline?: { rawInserted: number; stagingInserted: number; reviewTasksCreated: number; opportunitiesAutoPublished: number }; reminders?: { favoritesScanned: number; deliveriesSynchronized: number } } | null>(null);
  const [monitoringPoolText, setMonitoringPoolText] = useState("");
  const [monitoringImportReport, setMonitoringImportReport] = useState<{ received: number; unique: number; duplicateRows: number; inserted: number; updated: number; monitoredOrganizations: number } | null>(null);
  const [directoryReport, setDirectoryReport] = useState<{ catalog?: DirectoryCatalog; databaseAfter?: DirectoryDatabaseAfter } | null>(null);
  const [batchReport, setBatchReport] = useState<{ sourceReport?: { attempted: number; successful: number; failed: number }; findings?: { discovered: number; autumn: number; spring: number; internship?: number; rawInserted: number; stagingInserted: number; duplicateFiltered: number; formalAdded: number; awaitingManualReview: number } } | null>(null);
  const categories = [
    { value: "全部", label: "全部" },
    { value: "PROVINCIAL_CIVIL_SERVICE", label: "31省省考" },
    { value: "NATIONAL_CIVIL_SERVICE", label: "国考" },
    { value: "CENTRAL_SOE", label: "央企" },
    { value: "LOCAL_SOE", label: "地方国企" },
    { value: "ENTERPRISE_DISCOVERY", label: "企业发现" },
  ];
  const visible = nationalSourceDirectory.filter((source) => category === "全部" || source.category === category);
  async function refreshInitialSyncProgress() {
    const response = await fetch("/api/admin/initial-sync/progress");
    const payload = await response.json() as { ok?: boolean; error?: string; progress?: InitialSyncProgress };
    if (!response.ok || !payload.ok || !payload.progress) throw new Error(payload.error ?? "INITIAL_SYNC进度读取失败");
    setInitialSyncProgress(payload.progress);
    return payload.progress;
  }
  useEffect(() => {
    void refreshInitialSyncProgress().catch(() => undefined);
  }, []);
  async function runBatch1() {
    setBatchRunning(true);
    try {
      let latest: InitialSyncProgress | null = initialSyncProgress;
      let lastPayload: { batch: string; processed: number; summary?: { rawInserted: number; stagingInserted: number; formalAdded: number; duplicate: number; updated: number; failed: number } } | null = null;
      for (let index = 0; index < 20; index += 1) {
        const response = await fetch("/api/admin/initial-sync/batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchSize: 50 }) });
        const payload = await response.json() as { ok?: boolean; error?: string; batch?: string; processed?: number; summary?: { rawInserted: number; stagingInserted: number; formalAdded: number; duplicate: number; updated: number; failed: number }; after?: InitialSyncProgress };
        if (!response.ok || !payload.ok || !payload.after) throw new Error(payload.error ?? "INITIAL_SYNC批次执行失败");
        latest = payload.after;
        lastPayload = { batch: payload.batch ?? `BATCH_${index + 2}`, processed: payload.processed ?? 0, summary: payload.summary };
        setInitialSyncProgress(latest);
        if (latest.notChecked === 0 || payload.processed === 0) break;
      }
      if (lastPayload) setInitialSyncReport(lastPayload);
      onNotify(latest?.notChecked === 0 ? "INITIAL_SYNC已完成：701家监控组织均已标记状态" : `INITIAL_SYNC已继续执行，剩余 ${latest?.notChecked ?? "未知"} 家`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "INITIAL_SYNC执行失败");
    } finally {
      setBatchRunning(false);
    }
  }
  async function syncDirectory() {
    setDirectorySyncRunning(true);
    try {
      const response = await fetch("/api/admin/source-directory", { method: "POST" });
      const payload = await response.json() as { ok?: boolean; error?: string; catalog?: DirectoryCatalog; databaseAfter?: DirectoryDatabaseAfter };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "全国来源目录同步失败");
      setDirectoryReport({ catalog: payload.catalog, databaseAfter: payload.databaseAfter });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "全国来源目录同步失败");
    } finally {
      setDirectorySyncRunning(false);
    }
  }
  async function importMonitoringPool() {
    const records = monitoringPoolText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(1).map((line) => {
      const [category, regionName, industry, priority, name] = line.split("\t").map((item) => item.trim());
      return { category, regionName, industry, priority, name };
    }).filter((record) => record.name);
    if (!records.length) {
      window.alert("请先粘贴DOCX解析后的监控母表数据");
      return;
    }
    setMonitoringImportRunning(true);
    try {
      const response = await fetch("/api/admin/monitoring-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceDocument: "全国秋招集团名单｜2027届监控版.docx", records }) });
      const payload = await response.json() as { ok?: boolean; error?: string; received?: number; unique?: number; duplicateRows?: number; inserted?: number; updated?: number; monitoredOrganizations?: number };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "监控母表导入失败");
      setMonitoringImportReport({ received: payload.received ?? 0, unique: payload.unique ?? 0, duplicateRows: payload.duplicateRows ?? 0, inserted: payload.inserted ?? 0, updated: payload.updated ?? 0, monitoredOrganizations: payload.monitoredOrganizations ?? 0 });
      onNotify(`监控母表已导入：${payload.unique ?? 0} 家组织进入监控池`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "监控母表导入失败");
    } finally {
      setMonitoringImportRunning(false);
    }
  }
  async function runIncremental() {
    setIncrementalRunning(true);
    try {
      const response = await fetch("/api/admin/incremental-sync", { method: "POST" });
      const payload = await response.json() as { ok?: boolean; error?: string; activePeriod?: string; sourceSummary?: { due: number; scanned: number; unchanged: number; changed: number; blocked: number; failed: number }; pipeline?: { rawInserted: number; stagingInserted: number; reviewTasksCreated: number; opportunitiesAutoPublished: number }; reminders?: { favoritesScanned: number; deliveriesSynchronized: number } };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "增量同步失败");
      setIncrementalReport({ activePeriod: payload.activePeriod ?? "", sourceSummary: payload.sourceSummary, pipeline: payload.pipeline, reminders: payload.reminders });
      onNotify("增量扫描完成：新增和变化已进入人工审核队列");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "增量同步失败");
    } finally {
      setIncrementalRunning(false);
    }
  }
  return <div className="admin-section">
    <div className="admin-panel-heading">
      <div><span className="section-kicker">NATIONWIDE COVERAGE</span><h2>全国数据源目录</h2><p>全国来源档案已加入目录；官方网址和访问边界逐条核验后，才会进入生产采集。</p></div>
      <div className="admin-heading-actions"><span className="review-guard">INITIAL_SYNC</span><button className="secondary-button" disabled={directorySyncRunning} onClick={syncDirectory}>{directorySyncRunning ? "同步目录中…" : "同步全国来源目录"}</button><button className="primary-button" disabled={batchRunning} onClick={runBatch1}>{batchRunning ? "INITIAL_SYNC执行中…" : "继续执行全国 INITIAL_SYNC"} <span>→</span></button></div>
    </div>
    {initialSyncProgress && <div className="surface coverage-batch-report"><div className="admin-panel-heading"><div><span className="section-kicker">INITIAL SYNC STATUS</span><h3>701家组织首次检查进度</h3><p>每批50家，按P0→P1→P2→P3处理；没有确认官方URL的组织标记为 SOURCE_NOT_FOUND，不伪造网址。</p></div><span className={initialSyncProgress.notChecked === 0 ? "success-tag" : "review-guard"}>{initialSyncProgress.notChecked === 0 ? "已完成" : `剩余 ${initialSyncProgress.notChecked}`}</span></div><div className="coverage-summary"><div><strong>{initialSyncProgress.total}</strong><span>监控组织</span></div><div><strong>{initialSyncProgress.completed}</strong><span>已完成检查</span></div><div><strong>{initialSyncProgress.currentRecruitment}</strong><span>当前招聘</span></div><div><strong>{initialSyncProgress.upcoming}</strong><span>即将开始</span></div><div><strong>{initialSyncProgress.accessFailed}</strong><span>访问失败</span></div><div><strong>{initialSyncProgress.sourceNotFound}</strong><span>未找到官方来源</span></div></div><p className="coverage-batch-note">官方入口 {initialSyncProgress.officialSourceFound} · 当前无招聘 {initialSyncProgress.noCurrentRecruitment} · 待复核 {initialSyncProgress.needsReview} · 未检查 {initialSyncProgress.notChecked}</p></div>}
    <div className="coverage-summary">
      <div><strong>{nationalSourceDirectorySummary.total}</strong><span>全国来源档案</span></div>
      <div><strong>{nationalSourceDirectorySummary.provincialCivilService}</strong><span>省考独立档案</span></div>
      <div><strong>{nationalSourceDirectorySummary.centralSoe}</strong><span>央企入口档案</span></div>
      <div><strong>{nationalSourceDirectorySummary.localSoe}</strong><span>地方国企重点地区</span></div>
      <div><strong>{nationalSourceDirectorySummary.verified}</strong><span>已核验入口</span></div>
      <div><strong>{nationalSourceDirectorySummary.needsReview}</strong><span>待人工核验</span></div>
    </div>
    <div className="surface coverage-batch-report">
      <div className="admin-panel-heading"><div><span className="section-kicker">INCREMENTAL SYNC</span><h3>每日增量同步模式</h3><p>秋招 / 春招活跃期每日扫描，其余来源每7日基础巡检；新增与变化不会自动覆盖正式招聘。</p></div><div className="admin-heading-actions"><span className="success-tag">已启用</span><button className="primary-button" disabled={incrementalRunning} onClick={runIncremental}>{incrementalRunning ? "增量扫描中…" : "立即执行增量扫描"} <span>↻</span></button></div></div>
      <div className="coverage-summary"><div><strong>每日</strong><span>活跃期</span></div><div><strong>7日</strong><span>基础巡检</span></div><div><strong>0</strong><span>自动发布</span></div><div><strong>{incrementalReport?.sourceSummary?.changed ?? 0}</strong><span>本次变化</span></div><div><strong>{incrementalReport?.pipeline?.reviewTasksCreated ?? 0}</strong><span>待审核任务</span></div><div><strong>{incrementalReport?.reminders?.deliveriesSynchronized ?? 0}</strong><span>收藏提醒同步</span></div></div>
      {incrementalReport && <p className="coverage-batch-note">本次为 {incrementalReport.activePeriod}：到期来源 {incrementalReport.sourceSummary?.due ?? 0} 个，实际检查 {incrementalReport.sourceSummary?.scanned ?? 0} 个，未变化 {incrementalReport.sourceSummary?.unchanged ?? 0} 个，新增/变化 {incrementalReport.sourceSummary?.changed ?? 0} 个；raw {incrementalReport.pipeline?.rawInserted ?? 0} 条、staging {incrementalReport.pipeline?.stagingInserted ?? 0} 条、人工审核任务 {incrementalReport.pipeline?.reviewTasksCreated ?? 0} 条。正式机会自动发布 {incrementalReport.pipeline?.opportunitiesAutoPublished ?? 0} 条。</p>}
    </div>
    {directoryReport?.databaseAfter && <div className="surface coverage-batch-report"><div className="admin-panel-heading"><div><span className="section-kicker">SOURCE DIRECTORY SYNC</span><h3>全国覆盖底账已同步到生产库</h3><p>这里只登记来源和覆盖范围，不代表已经发现招聘岗位；所有来源仍禁止自动发布。</p></div><span className="success-tag">同步完成</span></div><div className="coverage-summary"><div><strong>{directoryReport.databaseAfter.registered_sources}</strong><span>已登记来源</span></div><div><strong>{directoryReport.databaseAfter.verified_sources}</strong><span>已核验入口</span></div><div><strong>{directoryReport.databaseAfter.review_sources}</strong><span>待人工核验</span></div><div><strong>{directoryReport.databaseAfter.enterprise_sources}</strong><span>企业来源</span></div><div><strong>{directoryReport.databaseAfter.national_civil_service_sources + directoryReport.databaseAfter.provincial_civil_service_sources}</strong><span>国考 / 省考</span></div><div><strong>{directoryReport.databaseAfter.central_soe_sources + directoryReport.databaseAfter.local_soe_sources}</strong><span>央企 / 地方国企</span></div></div></div>}
    <div className="surface coverage-batch-report">
      <div className="admin-panel-heading"><div><span className="section-kicker">MONITORING MASTER LIST</span><h3>导入DOCX监控母表</h3><p>只建立组织监控池，不创建招聘机会。格式：分类、地区、行业、优先级、单位名称，以Tab分隔。</p></div><span className="review-guard">名单 ≠ 招聘</span></div>
      <label className="field"><span>DOCX监控母表数据</span><textarea aria-label="DOCX监控母表数据" value={monitoringPoolText} onChange={(event) => setMonitoringPoolText(event.target.value)} placeholder="分类\t地区\t行业\t优先级\t单位名称\n央企\t全国\t能源\tP0\t示例单位" rows={5} /></label>
      <div className="brand-form-actions"><button className="primary-button" disabled={monitoringImportRunning} onClick={importMonitoringPool}>{monitoringImportRunning ? "导入监控池中…" : "导入DOCX监控母表"} <span>→</span></button>{monitoringImportReport && <span className="success-tag">已登记 {monitoringImportReport.unique} 家 · 新增 {monitoringImportReport.inserted} · 更新 {monitoringImportReport.updated} · 监控池共 {monitoringImportReport.monitoredOrganizations}</span>}</div>
    </div>
    {initialSyncReport && <div className="surface coverage-batch-report"><div className="admin-panel-heading"><div><span className="section-kicker">LATEST INITIAL_SYNC BATCH</span><h3>{initialSyncReport.batch} 已执行</h3><p>本批实际检查 {initialSyncReport.processed} 家；结果已写入组织状态和统一招聘数据链路。</p></div><span className="success-tag">真实执行</span></div><p className="coverage-batch-note">raw {initialSyncReport.summary?.rawInserted ?? 0} · staging {initialSyncReport.summary?.stagingInserted ?? 0} · 正式新增 {initialSyncReport.summary?.formalAdded ?? 0} · 重复 {initialSyncReport.summary?.duplicate ?? 0} · 更新 {initialSyncReport.summary?.updated ?? 0} · 访问失败 {initialSyncReport.summary?.failed ?? 0}</p><div className="brand-form-actions"><a className="secondary-button" href="/api/admin/initial-sync/export?kind=failed">下载 failed-sources.csv</a><a className="secondary-button" href="/api/admin/initial-sync/export?kind=no-current">下载 no-current-recruitment.csv</a><a className="secondary-button" href="/api/admin/initial-sync/export?kind=current">下载 current-recruitments.csv</a></div></div>}
    <div className="coverage-guard"><span>i</span><p>已核验入口已直接写入目录；未核验来源仍保持空白。所有来源仍不自动采集，必须继续完成人工确认和访问边界审计。</p></div>
    <div className="admin-filter-bar coverage-filter">{categories.map((item) => <button key={item.value} className={category === item.value ? "active" : ""} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
    <div className="coverage-list">{visible.map((source) => { const verified = source.discoveryStatus === "VERIFIED"; return <article className="coverage-card" key={source.id}><div className="coverage-card-heading"><div><span className="source-level-badge level-A">A级目录</span><strong>{source.name}</strong><small>{source.regionName ?? "全国"} · {source.requiredOfficialRoles.join("、")}</small></div><span className={`source-status ${verified ? "verified" : "pending"}`}><i />{verified ? "已核验入口" : "待核验"}</span></div><div className="coverage-card-grid"><div><span>目录分类</span><strong>{categories.find((item) => item.value === source.category)?.label ?? source.category}</strong></div><div><span>普通巡检</span><strong>{source.normalFrequency === "EVERY_7_DAYS" ? "每7天" : "每日"}</strong></div><div><span>活跃巡检</span><strong>每日</strong></div><div><span>官方URL</span>{source.sourceUrl ? <a className="mono-text coverage-url" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceDomain}</a> : <strong className="mono-text">待人工核验</strong>}</div></div><div className="coverage-card-footer"><span>{source.notes}{source.lastVerifiedAt ? ` 核验日期：${source.lastVerifiedAt}` : ""}</span><b>不自动采集</b></div></article>; })}</div>
  </div>;
}

function TargetOrganizationDirectory({ onNotify }: { onNotify: (message: string) => void }) {
  type TargetAuditRow = {
    organization_name: string;
    organization_type: string;
    priority: string;
    official_website: string | null;
    official_recruitment_url: string | null;
    official_confirmed: boolean;
    current_recruitment_status: string;
    current_recruitment_title: string | null;
    current_recruitment_url: string | null;
    application_url: string | null;
    last_checked_at: string | null;
    source_status: string;
    failure_type: string | null;
    published_opportunity_count: number;
    notes: string;
  };
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("全部");
  const [auditRows, setAuditRows] = useState<TargetAuditRow[]>([]);
  const [auditProgress, setAuditProgress] = useState<InitialSyncProgress | null>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditReport, setAuditReport] = useState<{ processed: number; currentRecruitment: number; upcoming: number; officialSourceFound: number; noCurrentRecruitment: number; accessFailed: number; sourceNotFound: number; needsReview: number; rawInserted: number; stagingInserted: number; formalAdded: number; duplicate: number; updated: number } | null>(null);
  const sourceByOrganization = new Map(dataSourcesSeed.map((source) => [source.organizationName, source]));
  const auditByOrganization = new Map(auditRows.map((row) => [row.organization_name, row]));
  const visible = organizationsSeed.filter((organization) => {
    const matchesQuery = !query.trim() || `${organization.name} ${organization.shortName} ${organization.industry}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (priority === "全部" || organization.priority === priority);
  });
  const counts = { P0: organizationsSeed.filter((item) => item.priority === "P0").length, P1: organizationsSeed.filter((item) => item.priority === "P1").length, P2: organizationsSeed.filter((item) => item.priority === "P2").length };
  async function refreshAuditReport() {
    const response = await fetch("/api/admin/target-audit/report");
    const payload = await response.json() as { ok?: boolean; error?: string; progress?: InitialSyncProgress; rows?: TargetAuditRow[] };
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "首批100家核验报告读取失败");
    setAuditProgress(payload.progress ?? null);
    setAuditRows(Array.isArray(payload.rows) ? payload.rows : []);
    return payload.progress;
  }
  useEffect(() => { void refreshAuditReport().catch(() => undefined); }, []);
  async function runTargetAudit() {
    setAuditRunning(true);
    try {
      const directoryResponse = await fetch("/api/admin/source-directory", { method: "POST" });
      const directoryPayload = await directoryResponse.json() as { ok?: boolean; error?: string };
      if (!directoryResponse.ok || !directoryPayload.ok) throw new Error(directoryPayload.error ?? "首批目标单位来源登记失败");
      let latest = auditProgress;
      let totals = { processed: 0, currentRecruitment: 0, upcoming: 0, officialSourceFound: 0, noCurrentRecruitment: 0, accessFailed: 0, sourceNotFound: 0, needsReview: 0, rawInserted: 0, stagingInserted: 0, formalAdded: 0, duplicate: 0, updated: 0 };
      for (let index = 0; index < 10; index += 1) {
        const response = await fetch("/api/admin/initial-sync/batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "target_100", batchSize: 20, batchName: `TARGET_100_BATCH_${index + 1}` }) });
        const payload = await response.json() as { ok?: boolean; error?: string; processed?: number; after?: InitialSyncProgress; summary?: Partial<typeof totals> };
        if (!response.ok || !payload.ok || !payload.after) throw new Error(payload.error ?? "首批100家核验执行失败");
        latest = payload.after;
        setAuditProgress(latest);
        totals.processed += payload.processed ?? 0;
        for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += Number(payload.summary?.[key] ?? 0);
        if (latest.notChecked === 0 || payload.processed === 0) break;
      }
      await refreshAuditReport();
      setAuditReport(totals);
      onNotify(latest?.notChecked === 0 ? "首批100家官方入口核验已完成，逐家状态已写入生产库" : `首批100家核验已继续执行，剩余 ${latest?.notChecked ?? "未知"} 家`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "首批100家核验执行失败");
    } finally {
      setAuditRunning(false);
    }
  }
  const statusLabelFor = (status: string) => ({ CURRENT_RECRUITMENT: "当前有招聘", UPCOMING: "即将开始", OFFICIAL_SOURCE_FOUND: "已找到官方入口", NO_CURRENT_RECRUITMENT: "当前无招聘", ACCESS_FAILED: "访问失败", SOURCE_NOT_FOUND: "未找到官方入口", NEEDS_REVIEW: "待人工复核", NOT_CHECKED: "未检查" } as Record<string, string>)[status] ?? status;
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">TARGET ORGANIZATIONS</span><h2>首批目标单位</h2><p>100家重点企业、央企、国企、银行和知名企业，执行真实公开入口核验；名单本身不等于招聘岗位。</p></div><div className="admin-heading-actions"><a className="secondary-button" href="/api/admin/initial-sync/export?kind=target-100">下载逐家报告</a><button className="primary-button" disabled={auditRunning} onClick={runTargetAudit}>{auditRunning ? "100家核验执行中…" : "执行100家官方核验"} <span>→</span></button></div></div><div className="target-summary"><div><strong>{organizationsSeed.length}</strong><span>目标单位</span></div><div><strong>{counts.P0}</strong><span>P0首批调研</span></div><div><strong>{auditProgress?.completed ?? 0}</strong><span>已完成检查</span></div><div><strong>{auditProgress?.officialSourceFound ?? dataSourcesSeed.filter((item) => item.officialConfirmed).length}</strong><span>官方入口确认</span></div><div><strong>{auditProgress?.currentRecruitment ?? 0}</strong><span>当前有招聘</span></div><div><strong>{auditProgress?.notChecked ?? 100}</strong><span>未检查</span></div></div>{auditReport && <div className="coverage-batch-report"><div className="coverage-batch-note">本次实际处理 {auditReport.processed} 家：当前招聘 {auditReport.currentRecruitment}、即将开始 {auditReport.upcoming}、官方入口 {auditReport.officialSourceFound}、当前无招聘 {auditReport.noCurrentRecruitment}、访问失败 {auditReport.accessFailed}、未找到官方入口 {auditReport.sourceNotFound}、待复核 {auditReport.needsReview}；raw {auditReport.rawInserted}、staging {auditReport.stagingInserted}、正式新增 {auditReport.formalAdded}、重复 {auditReport.duplicate}、更新 {auditReport.updated}。</div></div>}<div className="admin-filter-bar"><div className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单位、简称或行业" /></div>{["全部", "P0", "P1", "P2"].map((item) => <button key={item} className={priority === item ? "active" : ""} onClick={() => setPriority(item)}>{item}</button>)}</div><div className="target-table"><div className="target-table-head"><span>单位</span><span>类型 / 行业</span><span>优先级</span><span>真实核验状态</span><span>官方入口 / 招聘</span><span>最近检查</span></div>{visible.map((organization) => { const source = sourceByOrganization.get(organization.name); const audit = auditByOrganization.get(organization.name); const status = audit?.current_recruitment_status ?? "NOT_CHECKED"; return <div className="target-table-row" key={organization.name}><span><strong>{organization.name}</strong><small>{organization.shortName}</small></span><span>{organization.organizationType}<small>{organization.industry}</small></span><span className={`priority-pill ${organization.priority.toLowerCase()}`}>{organization.priority}</span><span><b className={`source-status ${status === "CURRENT_RECRUITMENT" ? "verified" : "pending"}`}><i />{statusLabelFor(status)}</b><small>{audit?.failure_type ?? (audit?.notes || source?.sourceStatus || "尚未执行")}</small></span><span>{audit?.current_recruitment_title ? <><strong>{audit.current_recruitment_title}</strong><small><a href={audit.current_recruitment_url ?? audit.official_recruitment_url ?? "#"} target="_blank" rel="noreferrer">打开官方页面 ↗</a></small></> : <small>{audit?.official_recruitment_url ?? "未登记官方URL"}</small>}</span><span>{audit?.last_checked_at ? formatDate(audit.last_checked_at) : "—"}</span></div>; })}</div></div>;
}

function BrandSettings({ brand, onSave }: { brand: BrandConfig; onSave: (brand: BrandConfig) => void }) {
  const [draft, setDraft] = useState<BrandConfig>(brand);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">SYSTEM CONFIGURATION</span><h2>站点品牌配置</h2><p>名称、Logo、首页标题和宣传文案通过配置管理，保存后同步到前台。</p></div><span className="safe-collection-badge">默认值可随时恢复</span></div><div className="brand-settings"><div className="surface brand-settings-card"><span className="section-kicker">BRAND SETTINGS</span><h3>产品对外信息</h3><p>当前版本先保存为本地草稿，正式环境由 system_configs 表持久化。</p><div className="brand-form-grid"><label className="field"><span>产品名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field"><span>Logo文字</span><input value={draft.logoText} onChange={(event) => setDraft({ ...draft, logoText: event.target.value })} maxLength={3} /></label><label className="field"><span>当前服务届别</span><input value={draft.edition} onChange={(event) => setDraft({ ...draft, edition: event.target.value })} /></label><label className="field"><span>首页主标题</span><input value={draft.homeTitle} onChange={(event) => setDraft({ ...draft, homeTitle: event.target.value })} /></label><label className="field"><span>首页副标题 / 宣传文案</span><textarea value={draft.homeSubtitle} onChange={(event) => setDraft({ ...draft, homeSubtitle: event.target.value })} /></label><label className="field"><span>平台免责声明</span><textarea value={draft.disclaimer} onChange={(event) => setDraft({ ...draft, disclaimer: event.target.value })} /></label></div><div className="brand-form-actions"><button className="secondary-button" onClick={() => setDraft(siteConfig)}>恢复默认</button><button className="primary-button" onClick={() => onSave(draft)}>保存配置 <span>✓</span></button></div></div><div className="brand-preview"><span>LIVE PREVIEW</span><div className="preview-logo">{draft.logoText}</div><h3>{draft.homeTitle}</h3><p>{draft.homeSubtitle}</p><div className="config-row"><span>站点名称</span><strong>{draft.name}</strong></div><div className="config-row"><span>当前版本</span><strong>{draft.edition}</strong></div><div className="config-row"><span>数据策略</span><strong>真实数据 · 官方来源 + 人工核验</strong></div></div></div></div>;
}

function AdminOverview({ projects, pendingReview, openTasks, onTab, onOpen }: { projects: Project[]; pendingReview: number; openTasks: number; onTab: (tab: AdminTab) => void; onOpen: (project: Project) => void }) {
  const sourceCounts = ["A级", "B级", "C级", "D级"].map((level) => ({ level, count: sourceSeed.filter((source) => source.level === level).length }));
  const healthySources = sourceSeed.filter((source) => source.status === "运行中").length;
  const healthScore = sourceSeed.length ? Math.round((healthySources / sourceSeed.length) * 100) : 0;
  const sourceSummary = sourceSeed.length ? `${sourceSeed.length}个来源 · ${healthySources}个可访问` : "暂无来源数据";
  return <>
    <div className="admin-kpis">
      <div><span>已发布招聘</span><strong>{projects.length}</strong><small>全部经过管理员确认</small></div>
      <div><span>待审核采集</span><strong>{String(pendingReview).padStart(2, "0")}</strong><small className="warning">需要人工判断</small></div>
      <div><span>待处理任务</span><strong>{String(openTasks).padStart(2, "0")}</strong><small>来源变化与复核提醒</small></div>
      <div><span>来源健康度</span><strong>{healthScore}%</strong><small>{sourceSummary}</small></div>
    </div>
    <div className="admin-process-banner"><div className="process-icon">⌁</div><div><strong>校招数据处理链路</strong><p>数据源 → 公开采集 → 原始数据 → 人工审核 → 正式招聘信息</p></div><span>不会自动覆盖已发布信息</span></div>
    <div className="admin-grid">
      <div className="surface admin-table"><div className="surface-heading"><div><span className="section-kicker">PROJECT MANAGEMENT</span><h3>最近更新的招聘项目</h3></div><button className="more-button" onClick={() => onTab("verifications")}>查看复核 <span>→</span></button></div><div className="table-head"><span>项目</span><span>状态</span><span>来源</span><span>最近核验</span><span>操作</span></div>{projects.slice(0, 7).map((project) => <button className="table-row" key={project.id} onClick={() => onOpen(project)}><span className="table-project"><i className={`company-mark micro ${project.logoTone}`}>{project.shortName.slice(0, 1)}</i><span><strong>{project.title.replace("2027届", "")}</strong><small>{project.company} · {project.batch}</small></span></span><span className={`status-text ${project.status}`}>{statusLabel[project.status]}</span><span className="source-cell">{project.sourceLevel}<small>{project.sourceName}</small></span><span className="verify-cell">{formatDate(project.verifiedAt)}</span><span className="row-more">•••</span></button>)}</div>
      <div className="admin-side"><div className="surface source-health"><div className="surface-heading"><div><span className="section-kicker">SOURCE HEALTH</span><h3>来源健康度</h3></div><span className="health-score">{healthScore}%</span></div>{sourceCounts.map(({ level, count }) => <div className="health-line" key={level}><span>{level} · 来源登记</span><b>{count}</b><i><em style={{ width: sourceSeed.length ? `${Math.round((count / sourceSeed.length) * 100)}%` : "0%" }} /></i></div>)}</div><div className="surface admin-shortcuts"><span className="section-kicker">QUICK ACTIONS</span><h3>下一步</h3><button onClick={() => onTab("review")}><span>✓</span>处理新发现 <b>→</b></button><button onClick={() => onTab("imports")}><span>▤</span>导入招聘Excel <b>→</b></button><button onClick={() => onTab("tasks")}><span>⚑</span>查看任务中心 <b>→</b></button></div></div>
    </div>
  </>;
}

function SourceManagement({ sources, onToggle, onCheck }: { sources: SourceRecord[]; onToggle: (id: string) => void; onCheck: (id: string) => void }) {
  const [filter, setFilter] = useState("全部");
  const filtered = sources.filter((source) => filter === "全部" || source.level === filter || source.status === filter);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">SOURCE REGISTRY</span><h2>数据源管理</h2><p>维护公开招聘来源、检查频率和内容指纹。</p></div><button className="primary-button" onClick={() => window.alert("数据源新建表单将在接入真实数据库后保存")}>＋ 新增数据源</button></div><div className="admin-filter-bar"><div className="admin-search"><span>⌕</span><input placeholder="搜索数据源或企业" /></div>{["全部", "A级", "B级", "C级", "D级", "待检查"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="source-card-list">{filtered.map((source) => <article className="source-card" key={source.id}><div className="source-card-top"><div><span className={`source-level-badge level-${source.level.slice(0, 1)}`}>{source.level}</span><strong>{source.name}</strong><small>{source.company} · {source.type}</small></div><span className={`source-status ${source.status === "运行中" ? "live" : source.status === "待检查" ? "pending" : "paused"}`}><i />{source.status}</span></div><div className="source-card-grid"><div><span>采集方式</span><strong>{source.method}</strong></div><div><span>检查频率</span><strong>{source.frequency}</strong></div><div><span>最后检查</span><strong>{source.lastChecked}</strong></div><div><span>最后成功采集</span><strong>{source.lastSuccess}</strong></div><div><span>页面指纹</span><strong className="mono-text">{source.fingerprint}</strong></div><div><span>人工审核</span><strong>{source.review ? "是" : "否"}</strong></div></div><div className="source-card-footer"><span>备注：{source.note}</span><div><button className="secondary-button" onClick={() => onToggle(source.id)}>{source.status === "已暂停" ? "恢复来源" : "暂停来源"}</button><button className="primary-button" onClick={() => onCheck(source.id)}>立即检查</button></div></div></article>)}</div></div>;
}

function ReviewWorkbench({ items, selectedId, onSelect, onAction }: { items: RawItem[]; selectedId: string; onSelect: (id: string) => void; onAction: (id: string, status: RawStatus, message: string) => void }) {
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  if (!selected) return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">RAW INGESTION REVIEW</span><h2>采集审核工作台</h2><p>原始采集数据、Excel导入和页面变化记录会在这里进入人工审核。</p></div><span className="review-guard">人工审核闸门</span></div><div className="surface empty-state"><div className="empty-state-icon">✓</div><h3>当前没有待审核原始数据</h3><p>新发现的数据会先进入 raw_collected_items，再由管理员判断是否转为正式招聘信息。</p></div></div>;
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">RAW INGESTION REVIEW</span><h2>采集审核工作台</h2><p>原始标题、正文和附件先在这里人工判断，审核通过后才转为正式信息。</p></div><span className="review-guard">人工审核闸门</span></div><div className="review-workbench"><div className="review-queue"><div className="queue-header"><strong>待处理数据</strong><span>{items.filter((item) => item.reviewStatus !== "已转正式" && item.reviewStatus !== "已驳回").length} 条</span></div>{items.map((item) => <button key={item.id} className={`queue-item ${selected?.id === item.id ? "active" : ""}`} onClick={() => onSelect(item.id)}><div><strong>{item.title}</strong><small>{item.source} · {item.collectedAt}</small></div><span className={`queue-status ${item.parseStatus === "失败" ? "danger" : item.reviewStatus === "审核中" ? "reviewing" : ""}`}>{item.parseStatus === "失败" ? "解析失败" : item.reviewStatus}</span></button>)}</div><div className="review-detail">{selected && <><div className="review-detail-head"><div><span className="source-level-badge level-A">原始记录</span><h3>{selected.title}</h3><p>{selected.source} · 采集于 {selected.collectedAt}</p></div><a className="secondary-button" href={selected.sourceUrl} target="_blank" rel="noreferrer">打开来源 <span>↗</span></a></div><div className="review-detail-tags"><span className={selected.parseStatus === "失败" ? "danger-tag" : "success-tag"}>解析{selected.parseStatus}</span><span className={selected.duplicateStatus === "疑似重复" ? "warning-tag" : "plain-tag"}>{selected.duplicateStatus}</span><span className="plain-tag">发布时间 {selected.publishedAt}</span></div><div className="raw-preview"><span>ORIGINAL CONTENT</span><h4>{selected.title}</h4><p>{selected.content}</p><div className="raw-summary"><b>解析摘要</b>{selected.summary}</div></div><div className="normalized-preview"><div><span>解析器</span><strong>{selected.parser}</strong></div><div><span>企业匹配</span><strong>{"待管理员确认"}</strong></div><div><span>正式项目</span><strong>{selected.duplicateStatus === "疑似重复" ? "存在候选项目" : "尚未创建"}</strong></div></div><div className="review-actions"><button className="secondary-button" onClick={() => onAction(selected.id, "暂不处理", "已暂存，稍后继续处理")}>暂不处理</button><button className="secondary-button danger-button" onClick={() => onAction(selected.id, "已驳回", "已驳回无效原始记录")}>驳回无效</button><button className="secondary-button" onClick={() => onAction(selected.id, "审核中", "已标记为疑似重复，等待进一步核验")}>标记重复</button><button className="primary-button" onClick={() => onAction(selected.id, "已转正式", "审核通过，已进入正式信息编辑")}>审核并转正式 <span>→</span></button></div></>}</div></div></div>;
}

function ImportPanel({ onDownload, onNotify }: { onDownload: () => void; onNotify: (message: string) => void }) {
  const [preview, setPreview] = useState(false);
  const [fileName, setFileName] = useState("");
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">EXCEL INGESTION</span><h2>Excel导入增强</h2><p>批量数据经过映射、校验、匹配和去重后，统一进入待审核状态。</p></div><button className="secondary-button" onClick={onDownload}>↓ 下载Excel模板</button></div><div className="import-steps"><span className="active"><b>01</b>上传文件</span><i>→</i><span className={preview ? "active" : ""}><b>02</b>字段映射</span><i>→</i><span className={preview ? "active" : ""}><b>03</b>预览校验</span><i>→</i><span><b>04</b>进入审核</span></div>{!preview ? <div className="upload-card"><div className="upload-icon">↑</div><h3>拖入招聘信息Excel</h3><p>支持 .xlsx、.xls、.csv，单次最多 5000 行</p><label className="primary-button">选择文件<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setFileName(file.name); setPreview(true); onNotify("文件已读取，等待字段映射和校验"); }} /></label><small>平台不会自动发布导入数据，确认后仍需管理员审核。</small></div> : <div className="import-preview"><div className="preview-header"><div><span className="success-tag">✓ 文件已读取</span><h3>{fileName}</h3><p>下一步执行字段映射、必填字段、日期、URL、企业、专业和重复校验。</p></div><button className="text-button" onClick={() => { setPreview(false); setFileName(""); }}>重新上传</button></div><div className="mapping-grid"><div><span>企业匹配</span><strong>待执行 · 关联企业目录</strong></div><div><span>招聘项目名称</span><strong>待执行 · 必填校验</strong></div><div><span>招聘时间</span><strong>待执行 · 日期格式校验</strong></div><div><span>官方链接</span><strong>待执行 · HTTPS URL校验</strong></div><div><span>专业标签</span><strong>待执行 · 官方专业目录匹配</strong></div><div><span>重复检测</span><strong>待执行 · 企业ID + 项目名称 + 毕业年份 + 批次</strong></div></div><div className="surface empty-state import-queue-note"><h3>等待提交校验</h3><p>文件确认后进入原始采集审核队列，不会直接写入已发布招聘信息。</p></div><button className="primary-button import-confirm" onClick={() => { setPreview(false); onNotify("已提交导入校验，等待管理员审核"); }}>提交校验并进入审核 <span>→</span></button></div>}</div>;
}

function VerificationPanel({ projects, onNotify, onOpen }: { projects: Project[]; onNotify: (message: string) => void; onOpen: (project: Project) => void }) {
  const items = useMemo(() => projects.filter((project) => ["ending", "recruiting", "upcoming"].includes(project.status)).slice(0, 8), [projects]);
  const endingCount = projects.filter((project) => project.status === "ending").length;
  const verificationCount = projects.filter((project) => project.officialPageStatus === "待复核").length;
  const linkIssueCount = projects.filter((project) => project.officialPageStatus === "无法访问").length;
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">VERIFICATION CONTROL</span><h2>信息复核</h2><p>异常只创建复核任务，不直接覆盖已发布招聘信息。</p></div><button className="primary-button" onClick={() => onNotify("已创建今日信息复核批次")}>运行每日复核 <span>↻</span></button></div><div className="verification-alerts"><div><span>即将截止</span><strong>{endingCount}</strong><small>7天内需要关注</small></div><div><span>待核验</span><strong>{verificationCount}</strong><small>需要人工打开确认</small></div><div><span>链接异常</span><strong>{linkIssueCount}</strong><small>需要人工打开确认</small></div><div><span>页面变化</span><strong>0</strong><small>暂无变化事件</small></div></div>{items.length ? <div className="surface verification-table"><div className="verification-row verification-head"><span>招聘项目</span><span>当前状态</span><span>最近核验</span><span>官方页面</span><span>下次核验</span><span>操作</span></div>{items.map((project) => { const needsReview = project.officialPageStatus === "待复核"; return <div className="verification-row" key={project.id}><span><strong>{project.title}</strong><small>{project.company} · {project.sourceLevel}来源</small></span><span className={`verification-state ${needsReview ? "warning" : "verified"}`}>{needsReview ? "待复核" : "已核验"}</span><span>{formatDate(project.verifiedAt)}</span><span className={needsReview ? "danger-copy" : "success-copy"}>{needsReview ? "需要人工确认" : "可访问"}</span><span>{needsReview ? "待安排" : "按频率"}</span><span><button className="text-button" onClick={() => { onOpen(project); onNotify("已打开招聘详情，请完成官方页面复核"); }}>打开</button><button className="text-button" onClick={() => onNotify("复核结果已记录，原始数据未被覆盖")}>核验</button></span></div>; })}</div> : <div className="surface empty-state"><h3>暂无复核记录</h3><p>每日检查发现异常后，会在这里创建管理员复核任务。</p></div>}</div>;
}

function TaskCenter({ tasks, onClaim, onComplete }: { tasks: AdminTask[]; onClaim: (task: AdminTask) => void; onComplete: (task: AdminTask) => void }) {
  const [filter, setFilter] = useState("全部");
  const visible = tasks.filter((task) => filter === "全部" || task.status === filter || task.priority === filter);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">ADMIN TASK CENTER</span><h2>任务中心</h2><p>认领、处理、完成和备注全部留痕。</p></div><span className="task-sla">当前开放任务 · {tasks.filter((task) => task.status !== "已完成").length}</span></div><div className="task-toolbar">{["全部", "待处理", "处理中", "高", "中"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="task-list">{visible.map((task) => <article className="task-card" key={task.id}><div className={`task-priority priority-${task.priority}`}>{task.priority}</div><div className="task-main"><div className="task-title-line"><span>{task.type}</span><strong>{task.title}</strong></div><p>{task.note}</p><small>{task.source} · 截止 {task.due}{task.assignee !== "—" ? ` · 负责人 ${task.assignee}` : ""}</small></div><div className="task-actions"><span className={`task-status status-${task.status === "已完成" ? "done" : task.status === "处理中" ? "working" : "open"}`}>{task.status}</span>{task.status === "待处理" && <button className="secondary-button" onClick={() => onClaim(task)}>认领</button>}{task.status !== "已完成" && task.status !== "待处理" && <button className="primary-button" onClick={() => onComplete(task)}>完成</button>}</div></article>)}</div></div>;
}
