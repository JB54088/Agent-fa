"use client";

import { useMemo, useState } from "react";
import { formatDate, projects, siteConfig, statusLabel, type BrandConfig, type Project } from "./data";

type AdminTab = "overview" | "sources" | "review" | "imports" | "verifications" | "tasks" | "settings";
type SourceStatus = "运行中" | "待检查" | "已暂停";
type RawStatus = "待审核" | "审核中" | "已转正式" | "已驳回" | "暂不处理";
type TaskStatus = "待处理" | "已认领" | "处理中" | "已完成";

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

const sourceSeed: SourceRecord[] = [
  { id: "s1", name: "华辰能源招聘官网", company: "华辰能源集团", type: "企业官网", level: "A级", method: "HTML页面", frequency: "每日", lastChecked: "今天 09:15", lastSuccess: "今天 09:15", fingerprint: "sha256:7a39…e81c", status: "运行中", review: true, note: "优先核验公告和报名入口" },
  { id: "s2", name: "星河云官方招聘账号", company: "星河云计算", type: "官方公众号", level: "B级", method: "人工录入", frequency: "每周", lastChecked: "昨天 16:40", lastSuccess: "昨天 16:40", fingerprint: "sha256:0d42…a990", status: "待检查", review: true, note: "需要保留原文截图或链接" },
  { id: "s3", name: "国能城建院招聘官网", company: "国能城市建设研究院", type: "招聘官网", level: "A级", method: "HTML页面", frequency: "每日", lastChecked: "今天 08:30", lastSuccess: "今天 08:30", fingerprint: "sha256:22c1…8c7b", status: "运行中", review: true, note: "页面变化需人工确认" },
  { id: "s4", name: "华东高校就业网", company: "多企业转载", type: "高校就业网", level: "C级", method: "PDF附件", frequency: "每周", lastChecked: "2026-08-05", lastSuccess: "2026-08-05", fingerprint: "sha256:aa10…39fd", status: "待检查", review: true, note: "必须追溯企业原始公告" },
  { id: "s5", name: "第三方招聘线索池", company: "未匹配企业", type: "第三方网站", level: "D级", method: "人工录入", frequency: "手动", lastChecked: "—", lastSuccess: "—", fingerprint: "未生成", status: "已暂停", review: true, note: "D级来源不得直接发布" },
];

const rawSeed: RawItem[] = [
  { id: "r1", title: "星河云计算2027届校园招聘公告", source: "星河云官方招聘账号", sourceUrl: "https://example.com/xinghe-cloud", collectedAt: "今天 10:22", publishedAt: "2026-08-06", parseStatus: "成功", reviewStatus: "待审核", duplicateStatus: "唯一", summary: "发现技术、产品、设计、运营多个方向，报名入口已识别。", content: "星河云计算2027届校园招聘正式启动，面向国内外高校应届毕业生开放技术、产品、设计、运营岗位。具体专业要求与报名安排以官方页面为准。", parser: "public-html-v1" },
  { id: "r2", title: "华辰能源集团秋季校园招聘补充公告", source: "华辰能源招聘官网", sourceUrl: "https://example.com/huachen-recruitment", collectedAt: "今天 09:16", publishedAt: "2026-08-06", parseStatus: "部分成功", reviewStatus: "审核中", duplicateStatus: "疑似重复", summary: "页面内容发生变化，截止时间字段与现有项目不一致。", content: "补充公告：部分地区岗位报名截止时间调整，专业要求和报名入口请以本公告及官方报名页面为准。", parser: "public-html-v1" },
  { id: "r3", title: "江南制造研究院2027届提前批招聘", source: "华东高校就业网", sourceUrl: "https://example.com/jiangnan-lab-pdf", collectedAt: "昨天 17:32", publishedAt: "2026-08-05", parseStatus: "成功", reviewStatus: "待审核", duplicateStatus: "唯一", summary: "PDF附件解析成功，尚未匹配企业标准名称。", content: "江南制造研究院发布2027届提前批招聘公告，岗位覆盖机械、电气、自动化、计算机等方向。", parser: "pdf-text-v2" },
  { id: "r4", title: "某科技公司招聘启事", source: "第三方招聘线索池", sourceUrl: "https://example.com/lead-104", collectedAt: "昨天 11:08", publishedAt: "—", parseStatus: "失败", reviewStatus: "待审核", duplicateStatus: "待判断", summary: "正文未能解析，只有标题和来源链接。", content: "原始页面暂无法读取正文，请管理员打开来源链接人工判断。", parser: "public-html-v1" },
];

const taskSeed: AdminTask[] = [
  { id: "t1", type: "页面内容发生变化", title: "华辰能源招聘官网页面发生变化", source: "华辰能源招聘官网", priority: "高", status: "待处理", assignee: "—", due: "今天", note: "需要核对报名截止时间是否调整" },
  { id: "t2", type: "新招聘待审核", title: "星河云计算2027届校园招聘公告", source: "星河云官方招聘账号", priority: "高", status: "处理中", assignee: "周老师", due: "今天", note: "等待补充标准专业标签" },
  { id: "t3", type: "官方链接失效", title: "望潮证券报名入口返回异常", source: "望潮证券官网", priority: "中", status: "待处理", assignee: "—", due: "明天", note: "公告入口仍可访问，报名入口需复核" },
  { id: "t4", type: "招聘即将截止", title: "江南制造研究院提前批将在7天内截止", source: "江南研究院官网", priority: "中", status: "已认领", assignee: "林老师", due: "明天", note: "已安排人工确认官方页面" },
  { id: "t5", type: "用户提交纠错", title: "用户反馈云启生活报名时间可能有误", source: "用户纠错", priority: "低", status: "待处理", assignee: "—", due: "本周", note: "等待用户提供官方页面线索" },
  { id: "t6", type: "数据解析失败", title: "第三方线索池原始正文解析失败", source: "第三方招聘线索池", priority: "低", status: "待处理", assignee: "—", due: "本周", note: "D级信息不能直接发布" },
];

const tabs: { id: AdminTab; label: string; icon: string }[] = [
  { id: "overview", label: "运营总览", icon: "⌂" },
  { id: "sources", label: "数据源管理", icon: "◎" },
  { id: "review", label: "采集审核", icon: "✓" },
  { id: "imports", label: "Excel导入", icon: "▤" },
  { id: "verifications", label: "信息复核", icon: "◷" },
  { id: "tasks", label: "任务中心", icon: "⚑" },
  { id: "settings", label: "站点配置", icon: "⚙" },
];

export default function AdminConsole({ brand, onBrandChange, onOpen, onNotify }: { brand: BrandConfig; onBrandChange: (brand: BrandConfig) => void; onOpen: (project: Project) => void; onNotify: (message: string) => void }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [sources, setSources] = useState(sourceSeed);
  const [rawItems, setRawItems] = useState(rawSeed);
  const [tasksState, setTasksState] = useState(taskSeed);
  const [selectedRawId, setSelectedRawId] = useState("r1");

  const pendingReview = rawItems.filter((item) => ["待审核", "审核中"].includes(item.reviewStatus)).length;
  const openTasks = tasksState.filter((task) => task.status !== "已完成").length;

  function updateRaw(id: string, status: RawStatus, message: string) {
    setRawItems((current) => current.map((item) => item.id === id ? { ...item, reviewStatus: status } : item));
    onNotify(message);
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
    const sample = ["示例企业", "2027届校园招聘", "秋招", "2027", "本科、硕士", "计算机、软件工程等相关专业", "计算机科学与技术、软件工程", "工学", "北京、上海", "2026-08-06", "2026-08-10", "2026-09-01", "https://example.com/announcement", "https://example.com/apply", "示例招聘官网", "https://example.com/source", "A级", "已核验", "导入后仍需人工审核"];
    const csv = `\ufeff${header.join(",")}\n${sample.join(",")}\n`;
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
      <div className="admin-heading-actions"><span className="safe-collection-badge">⌁ 仅访问公开内容</span><button className="primary-button" onClick={() => setTab("review")}>进入审核队列 <span>→</span></button></div>
    </div>
    <div className="admin-tabs" role="tablist" aria-label="管理员功能">
      {tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id}><span>{item.icon}</span>{item.label}{item.id === "review" && pendingReview > 0 && <b>{pendingReview}</b>}{item.id === "tasks" && openTasks > 0 && <b>{openTasks}</b>}</button>)}
    </div>

    {tab === "overview" && <AdminOverview pendingReview={pendingReview} openTasks={openTasks} onTab={setTab} onOpen={onOpen} />}
    {tab === "sources" && <SourceManagement sources={sources} onToggle={(id) => { setSources((current) => current.map((source) => source.id === id ? { ...source, status: source.status === "已暂停" ? "待检查" : "已暂停" } : source)); onNotify("数据源状态已更新"); }} onCheck={(id) => { setSources((current) => current.map((source) => source.id === id ? { ...source, status: "运行中", lastChecked: "刚刚", lastSuccess: "刚刚" } : source)); onNotify("已创建一次公开页面检查任务"); }} />}
    {tab === "review" && <ReviewWorkbench items={rawItems} selectedId={selectedRawId} onSelect={setSelectedRawId} onAction={updateRaw} />}
    {tab === "imports" && <ImportPanel onDownload={downloadTemplate} onNotify={onNotify} />}
    {tab === "verifications" && <VerificationPanel onNotify={onNotify} onOpen={onOpen} />}
    {tab === "tasks" && <TaskCenter tasks={tasksState} onClaim={claimTask} onComplete={completeTask} />}
    {tab === "settings" && <BrandSettings brand={brand} onSave={(next) => { onBrandChange(next); onNotify("站点品牌配置已保存，前台已同步"); }} />}
  </>;
}

function BrandSettings({ brand, onSave }: { brand: BrandConfig; onSave: (brand: BrandConfig) => void }) {
  const [draft, setDraft] = useState<BrandConfig>(brand);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">SYSTEM CONFIGURATION</span><h2>站点品牌配置</h2><p>名称、Logo、首页标题和宣传文案通过配置管理，保存后同步到前台。</p></div><span className="safe-collection-badge">默认值可随时恢复</span></div><div className="brand-settings"><div className="surface brand-settings-card"><span className="section-kicker">BRAND SETTINGS</span><h3>产品对外信息</h3><p>当前演示版使用本地配置模拟后台保存；接入数据库后对应 system_configs 表。</p><div className="brand-form-grid"><label className="field"><span>产品名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field"><span>Logo文字</span><input value={draft.logoText} onChange={(event) => setDraft({ ...draft, logoText: event.target.value })} maxLength={3} /></label><label className="field"><span>当前服务届别</span><input value={draft.edition} onChange={(event) => setDraft({ ...draft, edition: event.target.value })} /></label><label className="field"><span>首页主标题</span><input value={draft.homeTitle} onChange={(event) => setDraft({ ...draft, homeTitle: event.target.value })} /></label><label className="field"><span>首页副标题 / 宣传文案</span><textarea value={draft.homeSubtitle} onChange={(event) => setDraft({ ...draft, homeSubtitle: event.target.value })} /></label><label className="field"><span>平台免责声明</span><textarea value={draft.disclaimer} onChange={(event) => setDraft({ ...draft, disclaimer: event.target.value })} /></label></div><div className="brand-form-actions"><button className="secondary-button" onClick={() => setDraft(siteConfig)}>恢复默认</button><button className="primary-button" onClick={() => onSave(draft)}>保存配置 <span>✓</span></button></div></div><div className="brand-preview"><span>LIVE PREVIEW</span><div className="preview-logo">{draft.logoText}</div><h3>{draft.homeTitle}</h3><p>{draft.homeSubtitle}</p><div className="config-row"><span>站点名称</span><strong>{draft.name}</strong></div><div className="config-row"><span>当前版本</span><strong>{draft.edition}</strong></div><div className="config-row"><span>数据策略</span><strong>演示数据 · 人工审核后发布</strong></div></div></div></div>;
}

function AdminOverview({ pendingReview, openTasks, onTab, onOpen }: { pendingReview: number; openTasks: number; onTab: (tab: AdminTab) => void; onOpen: (project: Project) => void }) {
  return <>
    <div className="admin-kpis">
      <div><span>已发布招聘</span><strong>{projects.length}</strong><small>全部经过管理员确认</small></div>
      <div><span>待审核采集</span><strong>{String(pendingReview).padStart(2, "0")}</strong><small className="warning">需要人工判断</small></div>
      <div><span>待处理任务</span><strong>{String(openTasks).padStart(2, "0")}</strong><small>来源变化与复核提醒</small></div>
      <div><span>来源健康度</span><strong>96%</strong><small>5个来源 · 公开访问</small></div>
    </div>
    <div className="admin-process-banner"><div className="process-icon">⌁</div><div><strong>校招数据处理链路</strong><p>数据源 → 公开采集 → 原始数据 → 人工审核 → 正式招聘信息</p></div><span>不会自动覆盖已发布信息</span></div>
    <div className="admin-grid">
      <div className="surface admin-table"><div className="surface-heading"><div><span className="section-kicker">PROJECT MANAGEMENT</span><h3>最近更新的招聘项目</h3></div><button className="more-button" onClick={() => onTab("verifications")}>查看复核 <span>→</span></button></div><div className="table-head"><span>项目</span><span>状态</span><span>来源</span><span>最近核验</span><span>操作</span></div>{projects.slice(0, 7).map((project) => <button className="table-row" key={project.id} onClick={() => onOpen(project)}><span className="table-project"><i className={`company-mark micro ${project.logoTone}`}>{project.shortName.slice(0, 1)}</i><span><strong>{project.title.replace("2027届", "")}</strong><small>{project.company} · {project.batch}</small></span></span><span className={`status-text ${project.status}`}>{statusLabel[project.status]}</span><span className="source-cell">{project.sourceLevel}<small>{project.sourceName}</small></span><span className="verify-cell">{formatDate(project.verifiedAt)}</span><span className="row-more">•••</span></button>)}</div>
      <div className="admin-side"><div className="surface source-health"><div className="surface-heading"><div><span className="section-kicker">SOURCE HEALTH</span><h3>来源健康度</h3></div><span className="health-score">96%</span></div><div className="health-line"><span>A级 · 企业官方</span><b>15</b><i><em style={{ width: "86%" }} /></i></div><div className="health-line"><span>B级 · 官方账号</span><b>03</b><i><em style={{ width: "28%" }} /></i></div><div className="health-line"><span>C级 · 高校转载</span><b>02</b><i><em style={{ width: "18%" }} /></i></div><div className="health-line"><span>D级 · 线索池</span><b>00</b><i><em style={{ width: "4%" }} /></i></div></div><div className="surface admin-shortcuts"><span className="section-kicker">QUICK ACTIONS</span><h3>下一步</h3><button onClick={() => onTab("review")}><span>✓</span>处理新发现 <b>→</b></button><button onClick={() => onTab("imports")}><span>▤</span>导入招聘Excel <b>→</b></button><button onClick={() => onTab("tasks")}><span>⚑</span>查看任务中心 <b>→</b></button></div></div>
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
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">RAW INGESTION REVIEW</span><h2>采集审核工作台</h2><p>原始标题、正文和附件先在这里人工判断，审核通过后才转为正式信息。</p></div><span className="review-guard">人工审核闸门</span></div><div className="review-workbench"><div className="review-queue"><div className="queue-header"><strong>待处理数据</strong><span>{items.filter((item) => item.reviewStatus !== "已转正式" && item.reviewStatus !== "已驳回").length} 条</span></div>{items.map((item) => <button key={item.id} className={`queue-item ${selected?.id === item.id ? "active" : ""}`} onClick={() => onSelect(item.id)}><div><strong>{item.title}</strong><small>{item.source} · {item.collectedAt}</small></div><span className={`queue-status ${item.parseStatus === "失败" ? "danger" : item.reviewStatus === "审核中" ? "reviewing" : ""}`}>{item.parseStatus === "失败" ? "解析失败" : item.reviewStatus}</span></button>)}</div><div className="review-detail">{selected && <><div className="review-detail-head"><div><span className="source-level-badge level-A">原始记录</span><h3>{selected.title}</h3><p>{selected.source} · 采集于 {selected.collectedAt}</p></div><a className="secondary-button" href={selected.sourceUrl} target="_blank" rel="noreferrer">打开来源 <span>↗</span></a></div><div className="review-detail-tags"><span className={selected.parseStatus === "失败" ? "danger-tag" : "success-tag"}>解析{selected.parseStatus}</span><span className={selected.duplicateStatus === "疑似重复" ? "warning-tag" : "plain-tag"}>{selected.duplicateStatus}</span><span className="plain-tag">发布时间 {selected.publishedAt}</span></div><div className="raw-preview"><span>ORIGINAL CONTENT</span><h4>{selected.title}</h4><p>{selected.content}</p><div className="raw-summary"><b>解析摘要</b>{selected.summary}</div></div><div className="normalized-preview"><div><span>解析器</span><strong>{selected.parser}</strong></div><div><span>企业匹配</span><strong>{selected.id === "r1" ? "星河云计算 · 已匹配" : "待管理员确认"}</strong></div><div><span>正式项目</span><strong>{selected.duplicateStatus === "疑似重复" ? "存在候选项目" : "尚未创建"}</strong></div></div><div className="review-actions"><button className="secondary-button" onClick={() => onAction(selected.id, "暂不处理", "已暂存，稍后继续处理")}>暂不处理</button><button className="secondary-button danger-button" onClick={() => onAction(selected.id, "已驳回", "已驳回无效原始记录")}>驳回无效</button><button className="secondary-button" onClick={() => onAction(selected.id, "审核中", "已标记为疑似重复，等待进一步核验")}>标记重复</button><button className="primary-button" onClick={() => onAction(selected.id, "已转正式", "审核通过，已进入正式信息编辑")}>审核并转正式 <span>→</span></button></div></>}</div></div></div>;
}

function ImportPanel({ onDownload, onNotify }: { onDownload: () => void; onNotify: (message: string) => void }) {
  const [preview, setPreview] = useState(false);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">EXCEL INGESTION</span><h2>Excel导入增强</h2><p>批量数据经过映射、校验、匹配和去重后，统一进入待审核状态。</p></div><button className="secondary-button" onClick={onDownload}>↓ 下载Excel模板</button></div><div className="import-steps"><span className="active"><b>01</b>上传文件</span><i>→</i><span className={preview ? "active" : ""}><b>02</b>字段映射</span><i>→</i><span className={preview ? "active" : ""}><b>03</b>预览校验</span><i>→</i><span><b>04</b>进入审核</span></div>{!preview ? <div className="upload-card"><div className="upload-icon">↑</div><h3>拖入招聘信息Excel</h3><p>支持 .xlsx、.xls、.csv，单次最多 5000 行</p><label className="primary-button">选择文件<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={() => { setPreview(true); onNotify("文件已读取，进入字段映射预览"); }} /></label><small>平台不会自动发布导入数据，确认后仍需管理员审核。</small></div> : <div className="import-preview"><div className="preview-header"><div><span className="success-tag">✓ 文件已读取</span><h3>2027届校招信息导入.xlsx</h3><p>共 128 行 · 116 行通过基础校验 · 8 行需人工匹配 · 4 行疑似重复</p></div><button className="text-button" onClick={() => setPreview(false)}>重新上传</button></div><div className="mapping-grid"><div><span>企业名称</span><strong>企业名称 · 已匹配 116</strong></div><div><span>招聘项目名称</span><strong>招聘项目名称 · 必填通过</strong></div><div><span>招聘时间</span><strong>开始时间 / 截止时间 · 格式正确</strong></div><div><span>官方链接</span><strong>公告链接 / 报名链接 · 121条有效</strong></div><div><span>专业标签</span><strong>标准专业名称 · 8条待匹配</strong></div><div><span>重复检测</span><strong className="warning-copy">4条疑似重复</strong></div></div><div className="import-table"><div><span>行号</span><span>企业</span><span>招聘项目</span><span>校验结果</span><span>状态</span></div>{["华辰能源集团", "星河云计算", "安澜环保集团", "江南制造研究院"].map((company, index) => <div key={company}><span>0{index + 2}</span><span>{company}</span><span>{company}2027届校园招聘</span><span className={index === 3 ? "warning-copy" : "success-copy"}>{index === 3 ? "疑似重复" : "校验通过"}</span><span className="pending-copy">待审核</span></div>)}</div><button className="primary-button import-confirm" onClick={() => { setPreview(false); onNotify("128条记录已导入原始数据审核队列"); }}>确认导入并进入审核 <span>→</span></button></div>}</div>;
}

function VerificationPanel({ onNotify, onOpen }: { onNotify: (message: string) => void; onOpen: (project: Project) => void }) {
  const items = useMemo(() => projects.filter((project) => ["ending", "recruiting", "upcoming"].includes(project.status)).slice(0, 8), []);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">VERIFICATION CONTROL</span><h2>信息复核</h2><p>异常只创建复核任务，不直接覆盖已发布招聘信息。</p></div><button className="primary-button" onClick={() => onNotify("已创建今日信息复核批次")}>运行每日复核 <span>↻</span></button></div><div className="verification-alerts"><div><span>即将截止</span><strong>09</strong><small>7天内需要关注</small></div><div><span>待核验</span><strong>03</strong><small>超过设定核验周期</small></div><div><span>链接异常</span><strong>02</strong><small>需要人工打开确认</small></div><div><span>页面变化</span><strong>01</strong><small>已进入审核队列</small></div></div><div className="surface verification-table"><div className="verification-row verification-head"><span>招聘项目</span><span>当前状态</span><span>最近核验</span><span>官方页面</span><span>下次核验</span><span>操作</span></div>{items.map((project, index) => <div className="verification-row" key={project.id}><span><strong>{project.title}</strong><small>{project.company} · {project.sourceLevel}来源</small></span><span className={`verification-state ${index === 2 ? "warning" : "verified"}`}>{index === 2 ? "待复核" : "已核验"}</span><span>{formatDate(project.verifiedAt)}</span><span className={index === 2 ? "danger-copy" : "success-copy"}>{index === 2 ? "内容有变化" : "可访问"}</span><span>{index === 2 ? "今天" : "3天后"}</span><span><button className="text-button" onClick={() => { onOpen(project); onNotify("已打开招聘详情，请完成官方页面复核"); }}>打开</button><button className="text-button" onClick={() => onNotify("复核结果已记录，原始数据未被覆盖")}>核验</button></span></div>)}</div></div>;
}

function TaskCenter({ tasks, onClaim, onComplete }: { tasks: AdminTask[]; onClaim: (task: AdminTask) => void; onComplete: (task: AdminTask) => void }) {
  const [filter, setFilter] = useState("全部");
  const visible = tasks.filter((task) => filter === "全部" || task.status === filter || task.priority === filter);
  return <div className="admin-section"><div className="admin-panel-heading"><div><span className="section-kicker">ADMIN TASK CENTER</span><h2>任务中心</h2><p>认领、处理、完成和备注全部留痕。</p></div><span className="task-sla">今日SLA · 6/8</span></div><div className="task-toolbar">{["全部", "待处理", "处理中", "高", "中"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="task-list">{visible.map((task) => <article className="task-card" key={task.id}><div className={`task-priority priority-${task.priority}`}>{task.priority}</div><div className="task-main"><div className="task-title-line"><span>{task.type}</span><strong>{task.title}</strong></div><p>{task.note}</p><small>{task.source} · 截止 {task.due}{task.assignee !== "—" ? ` · 负责人 ${task.assignee}` : ""}</small></div><div className="task-actions"><span className={`task-status status-${task.status === "已完成" ? "done" : task.status === "处理中" ? "working" : "open"}`}>{task.status}</span>{task.status === "待处理" && <button className="secondary-button" onClick={() => onClaim(task)}>认领</button>}{task.status !== "已完成" && task.status !== "待处理" && <button className="primary-button" onClick={() => onComplete(task)}>完成</button>}</div></article>)}</div></div>;
}
