"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApplicationStatus,
  Project,
  ProjectStatus,
  MatchLevel,
  BrandConfig,
  formatDate,
  formatDateWithWeekday,
  getMatch,
  explainMatch,
  hasExplicitDeadline,
  majorOptions,
  regionOptions,
  siteConfig,
  statusClass,
  statusLabel,
} from "./data";
import AdminConsole from "./admin-console";
import OpportunityHub from "./opportunity-hub";
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "../lib/reminders/deadline";

// The published catalog is populated only from /api/opportunities. The old
// browser fixture is intentionally not used as a production fallback.
let projects: Project[] = [];

type View = "home" | "projects" | "calendar" | "my-projects" | "messages" | "profile" | "admin" | "about";
type ToastTone = "success" | "info";
type Toast = { message: string; tone?: ToastTone } | null;
type UserProfile = {
  name: string;
  major: string;
  degree: string;
  graduation: string;
  regions: string[];
  nationwide: boolean;
  acceptAnyMajor: boolean;
};
type PersonalTaskStatus = "待处理" | "进行中" | "已完成" | "已取消";
type PersonalTask = { id: string; projectId?: string; title: string; status: PersonalTaskStatus; due?: string; suggested?: boolean };
type AppNotification = { id: string; opportunityId: string | null; type: string; title: string; body: string; actionUrl: string | null; readAt: string | null; createdAt: string };

const navItems: { id: View; label: string; icon: string; badge?: string }[] = [
  { id: "home", label: "总览", icon: "⌂" },
  { id: "projects", label: "招聘信息", icon: "▤" },
  { id: "calendar", label: "招聘日历", icon: "□" },
  { id: "my-projects", label: "我的招聘", icon: "♡" },
  { id: "messages", label: "消息中心", icon: "◌" },
];

const trackerDefaults: Record<string, { status: ApplicationStatus; note: string }> = {};
const personalTaskDefaults: PersonalTask[] = [];
const personalTaskStorageKey = "radar-personal-tasks-v2";

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function matchesOpportunityScope(project: Project, scope: string, profileMajor = ""): boolean {
  const season = String(project.recruitmentSeason ?? "").toUpperCase();
  switch (scope) {
    case "秋招":
      return season ? season === "AUTUMN" : /秋招|秋季/.test(project.batch);
    case "春招":
      return season ? season === "SPRING" : /春招|春季/.test(project.batch);
    case "央企":
      return project.opportunityType === "CENTRAL_SOE" || project.companyType === "央企";
    case "国企":
      return project.opportunityType === "CENTRAL_SOE" || project.opportunityType === "LOCAL_SOE" || ["央企", "地方国企", "国企"].includes(project.companyType);
    case "国考":
      return project.opportunityType === "NATIONAL_CIVIL_SERVICE";
    case "省考":
      return project.opportunityType === "PROVINCIAL_CIVIL_SERVICE";
    case "选调生":
      return project.opportunityType === "SELECTED_GRADUATE";
    case "事业单位/事业编":
      return project.opportunityType === "PUBLIC_INSTITUTION";
    case "军队文职":
      return project.opportunityType === "MILITARY_CIVILIAN";
    case "官方招聘入口":
      return project.displayType === "OFFICIAL_RECRUITMENT_ENTRY";
    case "大厂":
      return ["互联网公司", "科技企业", "知名企业"].includes(project.companyType);
    case "即将截止":
      return project.status === "ending";
    case "不限专业":
      return project.noMajorLimit;
    case "与我匹配":
      return ["明确匹配", "专业大类匹配", "不限专业"].includes(getMatch(project, profileMajor));
    default:
      return true;
  }
}

export default function Home() {
  const [catalog, setCatalog] = useState<Project[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [view, setView] = useState<View>("home");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readLocalStorage("radar-favorites", []));
  const [trackers, setTrackers] = useState<Record<string, { status: ApplicationStatus; note: string }>>(() => readLocalStorage("radar-trackers", trackerDefaults));
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(() => readLocalStorage(personalTaskStorageKey, personalTaskDefaults));
  const [reminderSettings, setReminderSettings] = useState<Record<string, ReminderSettings>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [brand, setBrand] = useState<BrandConfig>(() => readLocalStorage("radar-brand-config", siteConfig));
  const [search, setSearch] = useState("");
  const [projectScope, setProjectScope] = useState("全部");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [externalProject, setExternalProject] = useState<Project | null>(null);
  const [correctionProject, setCorrectionProject] = useState<Project | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    major: "",
    degree: "本科",
    graduation: "2027",
    regions: [],
    nationwide: false,
    acceptAnyMajor: true,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/opportunities")
      .then((response) => response.json() as Promise<{ ok?: boolean; projects?: Project[] }>)
      .then((payload) => {
        if (!active) return;
        const next = payload.ok && Array.isArray(payload.projects) ? payload.projects : [];
        projects = next;
        setCatalog(next);
        setCatalogState(payload.ok ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!active) return;
        projects = [];
        setCatalog([]);
        setCatalogState("unavailable");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("radar-favorites", JSON.stringify(favoriteIds));
      window.localStorage.setItem("radar-trackers", JSON.stringify(trackers));
      window.localStorage.setItem(personalTaskStorageKey, JSON.stringify(personalTasks));
      window.localStorage.setItem("radar-brand-config", JSON.stringify(brand));
    } catch {
      // Local storage is limited to non-authoritative UI preferences until account APIs are connected.
    }
  }, [favoriteIds, trackers, personalTasks, brand]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() as Promise<{ authenticated?: boolean; user?: { displayName?: string } }> : null)
      .then((payload) => {
        if (!active || !payload?.authenticated) return;
        setLoggedIn(true);
        if (payload.user?.displayName) setProfile((current) => ({ ...current, name: payload.user!.displayName! }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    let active = true;
    fetch("/api/notifications")
      .then((response) => response.ok ? response.json() as Promise<{ notifications?: AppNotification[] }> : null)
      .then((payload) => { if (active && payload?.notifications) setNotifications(payload.notifications); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [loggedIn]);

  function notify(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  }

  async function toggleFavorite(project: Project) {
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    const exists = favoriteIds.includes(project.id);
    if (exists) {
      setFavoriteIds((current) => current.filter((id) => id !== project.id));
      try {
        const response = await fetch(`/api/favorites/${encodeURIComponent(project.id)}`, { method: "DELETE" });
        notify(response.ok ? "已取消收藏，未来截止提醒已关闭" : "已取消本地收藏，但提醒服务暂未同步", "info");
      } catch {
        notify("已取消本地收藏，但提醒服务暂未同步", "info");
      }
      return;
    }

    setFavoriteIds((current) => [...current, project.id]);
    if (hasExplicitDeadline(project)) setReminderSettings((current) => ({ ...current, [project.id]: DEFAULT_REMINDER_SETTINGS }));
    try {
      const response = await fetch(`/api/favorites/${encodeURIComponent(project.id)}`, { method: "POST" });
      if (response.ok) {
        const payload = await response.json() as { message?: string; reminderSettings?: ReminderSettings };
        if (payload.reminderSettings) setReminderSettings((current) => ({ ...current, [project.id]: payload.reminderSettings! }));
        notify(payload.message ?? (hasExplicitDeadline(project) ? "收藏成功，已为你开启报名截止提醒。" : "收藏成功。该项目暂未公布明确截止日期，时间更新后将提醒你。"));
      } else {
        notify(hasExplicitDeadline(project) ? "已收藏，但截止提醒服务尚未连接。" : "已收藏。该项目暂未公布明确截止日期。", "info");
      }
    } catch {
      notify(hasExplicitDeadline(project) ? "已收藏，但截止提醒服务尚未连接。" : "已收藏。该项目暂未公布明确截止日期。", "info");
    }
  }

  async function updateReminderSettings(project: Project, patch: Partial<ReminderSettings>) {
    const previous = reminderSettings[project.id] ?? DEFAULT_REMINDER_SETTINGS;
    const next = { ...previous, ...patch };
    setReminderSettings((current) => ({ ...current, [project.id]: next }));
    try {
      const response = await fetch("/api/reminders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ opportunityId: project.id, patch }) });
      if (!response.ok) throw new Error("reminder_persistence_unavailable");
      notify("提醒设置已保存");
    } catch {
      setReminderSettings((current) => ({ ...current, [project.id]: previous }));
      notify("提醒服务尚未连接，设置未保存", "info");
    }
  }

  async function markNotificationRead(notificationId: string) {
    setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
    try {
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, { method: "PATCH" });
    } catch {
      // The next database refresh restores the server state if the write failed.
    }
  }

  function updateTracker(project: Project, status: ApplicationStatus, note = "") {
    setTrackers((current) => ({ ...current, [project.id]: { status, note: note || current[project.id]?.note || "" } }));
    if (status === "已报名") {
      setPersonalTasks((current) => current.some((task) => task.projectId === project.id && task.title.includes("测评")) ? current : [...current, { id: `todo-${Date.now()}`, projectId: project.id, title: "关注测评通知", status: "待处理", due: "本周", suggested: true }]);
    }
    if (status === "已完成测评") {
      setPersonalTasks((current) => current.some((task) => task.projectId === project.id && task.title.includes("笔试")) ? current : [...current, { id: `todo-${Date.now()}`, projectId: project.id, title: "准备笔试", status: "待处理", due: "本周", suggested: true }]);
    }
    notify(`已标记为「${status}」`);
  }

  function addPersonalTask(title: string, projectId?: string) {
    setPersonalTasks((current) => [...current, { id: `todo-${Date.now()}`, projectId, title, status: "待处理", due: "自定义" }]);
    notify("待办事项已添加");
  }

  function togglePersonalTask(taskId: string) {
    setPersonalTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: task.status === "已完成" ? "待处理" : "已完成" } : task));
  }

  function navigate(nextView: View) {
    setView(nextView);
    setSearch("");
    setFilterOpen(false);
  }

  const favoriteProjects = projects.filter((project) => favoriteIds.includes(project.id));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup" onClick={() => navigate("home")} role="button" tabIndex={0}>
          <div className="brand-mark"><span>{brand.logoText}</span></div>
          <div>
            <div className="brand-name">{brand.name}</div>
            <div className="brand-subtitle">校园招聘信息雷达</div>
          </div>
        </div>

        <div className="sidebar-section-label">工作台</div>
        <nav className="side-nav" aria-label="主导航">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {((item.id === "messages" && notifications.some((notification) => !notification.readAt)) || item.id === "my-projects") && <span className={`nav-badge ${item.id === "messages" ? "nav-badge-hot" : ""}`}>{item.id === "my-projects" ? favoriteIds.length : notifications.filter((notification) => !notification.readAt).length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-section-label side-secondary-label">更多</div>
        <nav className="side-nav" aria-label="更多导航">
          <button className={`nav-item ${view === "profile" ? "active" : ""}`} onClick={() => navigate("profile")}><span className="nav-icon">◎</span><span>求职资料</span></button>
          <button className={`nav-item ${view === "admin" ? "active" : ""}`} onClick={() => navigate("admin")}><span className="nav-icon">▦</span><span>运营后台</span></button>
          <button className={`nav-item ${view === "about" ? "active" : ""}`} onClick={() => navigate("about")}><span className="nav-icon">i</span><span>关于平台</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-spark">✦</div>
            <div><strong>把机会留给准备好的人</strong><span>完善资料，匹配更精准</span></div>
          </div>
          <button className="user-mini" onClick={() => setProfileOpen(true)}>
            <span className="avatar">林</span>
            <span className="user-mini-text"><strong>{loggedIn ? profile.name : "未登录"}</strong><small>{loggedIn ? `${profile.graduation}届 · ${profile.degree}` : "登录后管理招聘"}</small></span>
            <span className="user-more">•••</span>
          </button>
        </div>
      </aside>

      <main className="main-column">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => navigate("home")}><span className="brand-mark small"><span>{brand.logoText}</span></span><strong>{brand.name}</strong></button>
          <div className="topbar-search">
            <span className="search-icon">⌕</span>
            <input aria-label="搜索招聘项目" value={search} onChange={(event) => { setSearch(event.target.value); if (view !== "projects") setView("projects"); }} placeholder="搜索企业、项目、专业或地区" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <span className="trust-pill"><span className="pulse-dot" />官方来源 · 人工核验</span>
            <button className="icon-button" aria-label="帮助" onClick={() => navigate("about")}>?</button>
            <button className="icon-button notification-button" aria-label="消息中心" onClick={() => navigate("messages")}>♧{notifications.some((notification) => !notification.readAt) && <span />}</button>
            <button className="icon-button mobile-admin-button" aria-label="运营后台" onClick={() => navigate("admin")}>▦</button>
            <button className="top-avatar" onClick={() => setProfileOpen(true)}>林</button>
          </div>
        </header>

        <div className="page-content">
          {catalogState === "loading" && <div className="surface empty-state catalog-unavailable"><h3>正在读取正式招聘数据</h3><p>招聘信息来源于公开渠道；真实数据只在数据库查询成功后显示，正在加载最新已审核信息。</p></div>}
          {catalogState === "unavailable" && <div className="surface empty-state catalog-unavailable"><h3>正式招聘数据暂时不可用</h3><p>数据库尚未连接或当前查询失败。平台不会用前端样例数据替代正式招聘信息。</p></div>}
          {view === "home" && catalogState === "ready" && <Dashboard brand={brand} onNavigate={navigate} onBrowseProjects={(scope) => { setProjectScope(scope); navigate("projects"); }} onLogin={() => setLoginOpen(true)} onOpen={setSelectedProject} onToggleFavorite={toggleFavorite} favoriteIds={favoriteIds} profile={profile} loggedIn={loggedIn} tasks={personalTasks} />}
          {view === "projects" && catalogState === "ready" && <ProjectsView initialScope={projectScope} search={search} setSearch={setSearch} filterOpen={filterOpen} setFilterOpen={setFilterOpen} onOpen={setSelectedProject} onToggleFavorite={toggleFavorite} favoriteIds={favoriteIds} profile={profile} />}
          {view === "calendar" && catalogState === "ready" && <CalendarView onOpen={setSelectedProject} />}
          {view === "my-projects" && <MyProjectsView projects={favoriteProjects} trackers={trackers} tasks={personalTasks} onOpen={setSelectedProject} onToggleFavorite={toggleFavorite} onUpdateTracker={updateTracker} onAddTask={addPersonalTask} onToggleTask={togglePersonalTask} />}
          {view === "messages" && <MessagesView notifications={notifications} onRead={markNotificationRead} />}
          {view === "profile" && <ProfileView profile={profile} onChange={setProfile} onSave={() => notify("求职资料已保存")} />}
          {view === "admin" && <AdminConsole projects={catalog} brand={brand} onBrandChange={setBrand} onOpen={setSelectedProject} onNotify={notify} />}
          {view === "about" && <AboutView brand={brand} />}
        </div>
      </main>

      {selectedProject && <ProjectModal project={selectedProject} userMajor={profile.major} isFavorite={favoriteIds.includes(selectedProject.id)} tracker={trackers[selectedProject.id]} reminderSettings={reminderSettings[selectedProject.id]} onClose={() => setSelectedProject(null)} onToggleFavorite={() => toggleFavorite(selectedProject)} onUpdateTracker={(status, note) => updateTracker(selectedProject, status, note)} onUpdateReminderSettings={(patch) => updateReminderSettings(selectedProject, patch)} onOpenExternal={() => setExternalProject(selectedProject)} onOpenCorrection={() => setCorrectionProject(selectedProject)} onNotify={notify} />}
      {externalProject && <ExternalLinkModal project={externalProject} onClose={() => setExternalProject(null)} />}
      {correctionProject && <CorrectionModal project={correctionProject} onClose={() => setCorrectionProject(null)} onSubmit={() => { setCorrectionProject(null); notify("纠错已提交，管理员会在核验后处理"); }} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={() => { window.location.assign("/signin-with-chatgpt?return_to=/"); }} />}
      {profileOpen && <ProfileQuickPanel profile={profile} onClose={() => setProfileOpen(false)} onEdit={() => { setProfileOpen(false); navigate("profile"); }} onLogout={() => { setLoggedIn(false); setProfileOpen(false); notify("已退出当前账号", "info"); }} />}
      {toast && <div className={`toast ${toast.tone === "info" ? "toast-info" : ""}`}><span>{toast.tone === "info" ? "i" : "✓"}</span>{toast.message}</div>}
    </div>
  );
}

function Dashboard({ brand, onNavigate, onBrowseProjects, onLogin, onOpen, onToggleFavorite, favoriteIds, profile, loggedIn, tasks }: { brand: BrandConfig; onNavigate: (view: View) => void; onBrowseProjects: (scope: string) => void; onLogin: () => void; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; favoriteIds: string[]; profile: { name: string; major: string; degree: string; graduation: string }; loggedIn: boolean; tasks: PersonalTask[] }) {
  const focusProjects = projects.filter((project) => project.status === "ending" || project.recommended).slice(0, 4);
  const hotCompanies = Array.from(new Map(projects.map((project) => [project.company, project])).values()).slice(0, 4);
  const matchedCount = projects.filter((project) => ["明确匹配", "专业大类匹配", "不限专业"].includes(getMatch(project, profile.major))).length;
  const pendingTasks = tasks.filter((task) => task.status !== "已完成" && task.status !== "已取消");
  const leadExplanation = projects[0] ? explainMatch(projects[0], profile.major) : { level: "暂无匹配依据" as MatchLevel, evidence: "当前没有可用于匹配的招聘信息。", needsManualReview: true, risk: "" };
  const enterpriseCount = projects.filter((project) => ["央企", "地方国企"].includes(project.companyType)).length;
  const internetCount = projects.filter((project) => ["互联网公司", "科技企业", "知名企业"].includes(project.companyType)).length;
  const publishedToday = projects.filter((project) => project.publishedAt === new Date().toISOString().slice(0, 10)).length;
  return (
    <>
      <div className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-line" />{brand.edition}求职季 · 早上好</div><h1>{brand.homeTitle}</h1><p className="hero-copy">{brand.homeSubtitle}</p><div className="hero-actions"><button className="primary-button" onClick={() => onNavigate("profile")}>填写专业，查看匹配 <span>→</span></button><button className="text-button" onClick={() => onNavigate("projects")}>查看近期机会 <span>↗</span></button></div></div>
        <div className="hero-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="radar-core"><span>⌁</span><small>RADAR</small></div><span className="float-chip chip-one">央国企 <b>{enterpriseCount}</b></span><span className="float-chip chip-two">知名企业 <b>{internetCount}</b></span><span className="float-chip chip-three">今日新增 <b>{publishedToday}</b></span><span className="radar-signal signal-one" /><span className="radar-signal signal-two" /></div>
      </div>

      <div className="notice-strip"><span className="notice-icon">i</span><span>招聘信息来源于公开渠道，平台仅提供整理、筛选和提醒服务，最终信息请以招聘单位官方网站为准。</span><button onClick={() => onNavigate("about")}>了解详情 <span>→</span></button></div>

      <button className="source-directory-promo" onClick={() => onBrowseProjects("官方招聘入口")}><span className="source-directory-promo-icon">↗</span><span><strong>官方招聘入口</strong><small>已核验但尚未形成具体批次的来源，会以官方入口形式进入招聘信息，方便你直接跳转官网。</small></span><b>查看入口 →</b></button>

      {loggedIn ? <div className="weekly-action-board"><div><span className="section-kicker">THIS WEEK&apos;S ACTIONS</span><h2>本周求职清单</h2><p>登录后优先处理与你当前报名进度直接相关的事项。</p></div><div className="weekly-action-stats"><div><strong>{pendingTasks.length}</strong><span>待处理任务</span></div><div><strong>{projects.filter((project) => project.status === "ending").length}</strong><span>近期截止</span></div><div><strong>{projects.filter((project) => ["明确匹配", "专业大类匹配", "不限专业"].includes(getMatch(project, profile.major))).length}</strong><span>新增匹配</span></div></div><button className="weekly-action-link" onClick={() => onNavigate("my-projects")}>管理我的进度 <span>→</span></button></div> : <div className="guest-value-board"><div><span className="section-kicker">WHY RADAR</span><h2>不是职位堆积，而是下一步行动</h2><p>按专业解释匹配、按时间整理节点、按来源追溯公告，帮你减少筛选和错过。</p></div><div className="guest-value-points"><span>✦ 专业匹配有依据</span><span>◷ 招聘时间更清晰</span><span>↗ 官方来源可追溯</span><span>♡ 收藏与进度管理</span></div><button className="primary-button" onClick={onLogin}>填写专业，查看匹配 <span>→</span></button></div>}
      <div className="match-evidence-strip"><span className="match-evidence-icon">✦</span><div><strong>匹配结果有依据 · {leadExplanation.level}</strong><p>{leadExplanation.evidence}</p></div><small>{leadExplanation.needsManualReview ? "需要人工核实" : "规则已解释"}</small></div>

      <OpportunityHub onBrowse={onBrowseProjects} />

      <div className="stats-grid">
        <StatCard label="真实数据" value={String(projects.length).padStart(2, "0")} suffix="条" trend="官方来源已核验" icon="✦" accent="orange" />
        <StatCard label="正在招聘" value={String(projects.filter((project) => project.status === "recruiting").length).padStart(2, "0")} suffix="个" trend="以官方页面为准" icon="◒" accent="teal" />
        <StatCard label="7天内截止" value={String(projects.filter((project) => project.status === "ending").length).padStart(2, "0")} suffix="个" trend="未确认不补写日期" icon="◷" accent="coral" />
        <StatCard label="与我匹配" value={String(matchedCount).padStart(2, "0")} suffix="个" trend="基于你的资料" icon="✧" accent="violet" />
      </div>

      <div className="section-heading"><div><span className="section-kicker">TODAY&apos;S FOCUS</span><h2>今天值得关注</h2></div><button className="link-button" onClick={() => onNavigate("projects")}>查看全部 <span>→</span></button></div>
      <div className="focus-grid">
        {focusProjects.map((project) => <ProjectCard key={project.id} project={project} compact onOpen={onOpen} onToggleFavorite={onToggleFavorite} isFavorite={favoriteIds.includes(project.id)} profileMajor={profile.major} />)}
      </div>

      <div className="lower-grid">
        <div className="surface profile-summary"><div className="surface-heading"><div><span className="section-kicker">YOUR RADAR</span><h3>你的求职雷达</h3></div><button className="more-button" onClick={() => onNavigate("profile")}>编辑 <span>↗</span></button></div><div className="profile-line"><div className="profile-avatar-large">{profile.name.slice(0, 1) || "·"}</div><div><strong>{profile.major || "尚未选择专业"}</strong><span>{profile.degree} · {profile.graduation}届 · {profile.name || "登录后保存资料"}</span></div></div><div className="radar-progress"><div className="progress-label"><span>资料完善度</span><strong>{profile.major ? "80%" : "20%"}</strong></div><div className="progress-track"><i style={{ width: profile.major ? "80%" : "20%" }} /></div></div><div className="match-callout"><span>✦</span><p>已为你找到 <b>{matchedCount} 个</b>可重点关注的项目</p><button onClick={() => onNavigate("projects")}>去看看</button></div></div>
        <div className="surface company-trends"><div className="surface-heading"><div><span className="section-kicker">HOT COMPANIES</span><h3>近期热门企业</h3></div><button className="more-button" onClick={() => onNavigate("projects")}>更多 <span>↗</span></button></div><div className="company-list">{hotCompanies.length ? hotCompanies.map((project) => <button className="company-row" key={project.company} onClick={() => onOpen(project)}><span className={`company-mark tiny ${project.logoTone}`}>{project.shortName.slice(0, 1)}</span><span className="company-row-name"><strong>{project.company}</strong><small>{project.companyNature} · {project.companyType}</small></span><span className="company-row-count">{projects.filter((item) => item.company === project.company).length} 个项目 <span>›</span></span></button>) : <div className="empty-inline">暂无已发布企业</div>}</div></div>
      </div>
    </>
  );
}

function StatCard({ label, value, suffix, trend, icon, accent }: { label: string; value: string; suffix: string; trend: string; icon: string; accent: string }) {
  return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{suffix}</small></div><span className="stat-trend">{trend}</span></div>;
}

function ProjectsView({ initialScope, search, setSearch, filterOpen, setFilterOpen, onOpen, onToggleFavorite, favoriteIds, profile }: { initialScope: string; search: string; setSearch: (value: string) => void; filterOpen: boolean; setFilterOpen: (value: boolean) => void; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; favoriteIds: string[]; profile: { major: string } }) {
  const [status, setStatus] = useState<"全部" | ProjectStatus>("全部");
  const [type, setType] = useState("全部类型");
  const [region, setRegion] = useState("全部地区");
  const [matchOnly, setMatchOnly] = useState(false);
  const [scope, setScope] = useState(initialScope);
  const filtered = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const textMatch = !query || `${project.company} ${project.title} ${project.originalMajors} ${project.regions.join(" ")}`.toLowerCase().includes(query);
    const scopeMatch = matchesOpportunityScope(project, scope, profile.major);
    return textMatch && scopeMatch && (status === "全部" || project.status === status) && (type === "全部类型" || project.companyType === type) && (region === "全部地区" || project.regions.includes(region)) && (!matchOnly || ["明确匹配", "专业大类匹配", "不限专业"].includes(getMatch(project, profile.major)));
  }), [search, scope, status, type, region, matchOnly, profile.major]);
  const scopes = ["全部", "秋招", "春招", "央企", "国企", "国考", "省考", "选调生", "事业单位/事业编", "军队文职", "官方招聘入口", "大厂", "即将截止", "不限专业", "与我匹配"];
  return <>
    <div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />RECRUITMENT RADAR</span><h1>招聘信息</h1><p>把分散的校招机会，整理成一张清晰的清单。</p></div><button className={`filter-button ${filterOpen ? "selected" : ""}`} onClick={() => setFilterOpen(!filterOpen)}><span>☷</span> 筛选 <b>{[type !== "全部类型", region !== "全部地区", matchOnly].filter(Boolean).length || ""}</b></button></div>
    <div className="opportunity-scope-tabs" aria-label="机会专区">{scopes.map((item) => <button key={item} className={scope === item ? "active" : ""} onClick={() => setScope(item)}>{item}</button>)}</div>
    <div className="list-caption"><span>批次口径</span><span className="caption-divider" /><span className="soft-text">春招 = 官方标注春季/春招批次；秋招 = 官方标注秋季/秋招批次；实习与专项招聘单独展示，不混入春秋招统计。</span></div>
    <div className="list-toolbar"><div className="list-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索企业、招聘项目、专业关键词" /></div><div className="result-count">共 <strong>{filtered.length}</strong> 个项目</div></div>
    {filterOpen && <div className="filter-panel"><FilterSelect label="招聘状态" value={status === "全部" ? "全部状态" : statusLabel[status]} onChange={(value) => setStatus(value === "全部状态" ? "全部" : (Object.entries(statusLabel).find(([, label]) => label === value)?.[0] as ProjectStatus))} options={["全部状态", "招聘中", "即将开始", "即将截止", "已截止"]} /><FilterSelect label="企业类型" value={type} onChange={setType} options={["全部类型", "央企", "地方国企", "互联网公司", "科技企业", "制造业企业", "金融企业", "知名企业"]} /><FilterSelect label="工作地区" value={region} onChange={setRegion} options={["全部地区", ...regionOptions]} /><label className="match-filter"><input type="checkbox" checked={matchOnly} onChange={(event) => setMatchOnly(event.target.checked)} /><span className="fake-checkbox">✓</span>只看与我匹配</label><button className="reset-button" onClick={() => { setScope("全部"); setStatus("全部"); setType("全部类型"); setRegion("全部地区"); setMatchOnly(false); }}>重置</button></div>}
    <div className="list-caption"><span>推荐排序</span><span className="caption-divider" /><span className="soft-text">优先展示与你专业匹配、近期截止的项目</span></div>
    <div className="project-list">{filtered.length ? filtered.map((project) => <ProjectCard key={project.id} project={project} onOpen={onOpen} onToggleFavorite={onToggleFavorite} isFavorite={favoriteIds.includes(project.id)} profileMajor={profile.major} />) : <EmptyState onReset={() => { setSearch(""); setScope("全部"); setStatus("全部"); setType("全部类型"); setRegion("全部地区"); setMatchOnly(false); }} />}</div>
  </>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="filter-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><b>⌄</b></label>;
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return <div className="empty-state"><div className="empty-mark">⌁</div><h3>没有找到匹配的项目</h3><p>换个关键词或放宽筛选条件，再试一次。</p><button className="secondary-button" onClick={onReset}>清除筛选</button></div>;
}

function ProjectCard({ project, compact = false, onOpen, onToggleFavorite, isFavorite, profileMajor }: { project: Project; compact?: boolean; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; isFavorite: boolean; profileMajor: string }) {
  const match = getMatch(project, profileMajor);
  return <article className={`project-card ${compact ? "project-card-compact" : ""} ${project.pinned ? "is-pinned" : ""}`} onClick={() => onOpen(project)}>
    <div className="card-topline"><div className={`company-mark ${project.logoTone}`}>{project.shortName.slice(0, 1)}</div><div className="project-heading"><div className="company-name-line"><strong>{project.company}</strong><span className="official-tag">真实数据</span>{project.sourceLevel === "A级" && <span className="official-tag">官方来源</span>}</div><h3>{project.title}</h3></div><button className={`favorite-button ${isFavorite ? "hearted" : ""}`} aria-label={isFavorite ? "取消收藏" : "收藏项目"} onClick={(event) => { event.stopPropagation(); onToggleFavorite(project); }}>{isFavorite ? "♥" : "♡"}</button></div>
    <div className="project-tags"><span className={`status-tag ${statusClass[project.status]}`}><i />{project.displayType === "OFFICIAL_RECRUITMENT_ENTRY" ? "官方入口" : statusLabel[project.status]}</span><span className="plain-tag">{project.companyType}</span><span className="plain-tag">{project.batch}</span>{match !== "暂无匹配依据" && <span className={`match-tag ${match === "不限专业" ? "match-any" : ""}`}>✦ {match}</span>}</div>
    <p className="project-summary">{project.originalMajors}</p>
    <div className="project-meta"><span><i className="meta-icon">⌖</i>{project.regions.slice(0, 3).join(" · ")}</span><span><i className="meta-icon">▣</i>{project.degrees.join(" / ")}</span><span className={project.status === "ending" ? "deadline-hot" : ""}><i className="meta-icon">◷</i>截止 {formatDate(project.deadline)}</span></div>
    {!compact && <div className="card-footer"><span>来源：{project.sourceName} <b className="source-level">{project.sourceLevel}</b></span><span>最近核验 {formatDate(project.verifiedAt)}</span><span className="card-open">查看详情 <b>→</b></span></div>}
  </article>;
}

function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function calendarDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CalendarView({ onOpen }: { onOpen: (project: Project) => void }) {
  const today = new Date();
  const todayKey = calendarDateKey(today);
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(year, month, index - firstDayOffset + 1));
  const calendarEvents: Record<string, { type: "start" | "end"; project: Project }[]> = {};

  projects.forEach((project) => {
    const addEvent = (date: string, type: "start" | "end") => {
      if (!isCalendarDate(date)) return;
      const key = date;
      if (!calendarEvents[key]) calendarEvents[key] = [];
      calendarEvents[key].push({ type, project });
    };
    addEvent(project.startAt, "start");
    addEvent(project.deadline, "end");
  });

  const upcoming = projects
    .filter((project) => project.status !== "closed")
    .map((project) => {
      const hasDeadline = isCalendarDate(project.deadline);
      const date = hasDeadline ? project.deadline : isCalendarDate(project.startAt) ? project.startAt : "";
      return { project, date, type: hasDeadline ? "end" as const : "start" as const };
    })
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 4);

  return <>
    <div className="page-heading calendar-heading"><div><span className="eyebrow"><span className="eyebrow-line" />YOUR TIMELINE</span><h1>招聘日历</h1><p>把明确的开始报名和报名截止时间放在同一张日历里，未公布日期的项目不会被虚构安排。</p></div><div className="calendar-month"><button aria-label="上个月" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}>‹</button><strong>{year}年 {month + 1}月</strong><button aria-label="下个月" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}>›</button></div></div>
    <div className="calendar-layout"><div className="surface calendar-surface"><div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => { const key = calendarDateKey(day); const inMonth = day.getMonth() === month; const events = inMonth ? calendarEvents[key] ?? [] : []; return <div className={`calendar-day ${!inMonth ? "muted-day" : ""} ${key === todayKey ? "today-day" : ""}`} key={key}><span className="day-number">{day.getDate()}</span>{key === todayKey && <span className="today-label">今天</span>}<div className="day-events">{events.slice(0, 2).map((event) => <button key={`${event.project.id}-${event.type}-${key}`} className={`calendar-event ${event.type}`} onClick={() => onOpen(event.project)}><b>{event.type === "end" ? "截止" : "开始"}</b><span>{event.project.shortName}</span></button>)}</div></div>; })}</div></div><aside className="calendar-aside"><div className="surface upcoming-panel"><div className="surface-heading"><div><span className="section-kicker">UP NEXT</span><h3>接下来</h3></div><span className="date-count">{upcoming.length} 件</span></div>{upcoming.map(({ project, date, type }) => { const dateValue = new Date(`${date}T00:00:00`); return <button className="upcoming-row" key={project.id} onClick={() => onOpen(project)}><span className={`date-bullet ${type === "end" ? "hot" : ""}`}><b>{dateValue.getDate()}</b><small>{dateValue.getMonth() + 1}月</small></span><span><strong>{type === "end" ? "报名截止" : "开始报名"}</strong><small>{project.shortName}</small></span><i>›</i></button>; })}</div><div className="surface legend-panel"><h4>日历说明</h4><div><span className="legend-dot start" />开始报名</div><div><span className="legend-dot end" />报名截止</div><div><span className="legend-dot mine" />我的跟进</div></div></aside></div>
  </>;
}

function LegacyMyProjectsView({ projects: favoriteProjects, trackers, onOpen, onToggleFavorite, onUpdateTracker }: { projects: Project[]; trackers: Record<string, { status: ApplicationStatus; note: string }>; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; onUpdateTracker: (project: Project, status: ApplicationStatus, note?: string) => void }) {
  const [filter, setFilter] = useState<"全部" | ApplicationStatus>("全部");
  const list = favoriteProjects.filter((project) => filter === "全部" || trackers[project.id]?.status === filter);
  const statusList: ("全部" | ApplicationStatus)[] = ["全部", "准备报名", "已报名", "已完成测评", "已参加笔试", "已进入面试", "已结束"];
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />MY TRACKER</span><h1>我的招聘</h1><p>收藏、进度和备注都放在这里，按自己的节奏推进。</p></div><button className="secondary-button" onClick={() => setFilter("全部")}>导出清单 <span>↓</span></button></div><div className="tracker-summary"><div><strong>{favoriteProjects.length}</strong><span>已收藏</span></div><div><strong>{favoriteProjects.filter((project) => project.status === "ending").length}</strong><span>近期截止</span></div><div><strong>{Object.values(trackers).filter((item) => item.status === "已报名").length}</strong><span>已报名</span></div><div className="tracker-summary-note"><span>✦</span><p>建议先处理 <b>7天内截止</b> 的项目，避免错过窗口。</p></div></div><div className="status-tabs">{statusList.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item === "全部" && <small>{favoriteProjects.length}</small>}</button>)}</div><div className="project-list">{list.length ? list.map((project) => <article className="tracker-card" key={project.id} onClick={() => onOpen(project)}><div className={`company-mark ${project.logoTone}`}>{project.shortName.slice(0, 1)}</div><div className="tracker-main"><div className="company-name-line"><strong>{project.company}</strong><span className="official-tag">真实数据</span></div><h3>{project.title}</h3><div className="tracker-line"><span className={`status-tag ${statusClass[project.status]}`}><i />{statusLabel[project.status]}</span><span>截止 {formatDate(project.deadline)}</span><span>✦ {getMatch(project)}</span></div>{trackers[project.id]?.note && <div className="note-line"><span>▰</span>{trackers[project.id].note}</div>}</div><div className="tracker-actions"><select value={trackers[project.id]?.status ?? "暂未处理"} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateTracker(project, event.target.value as ApplicationStatus)} aria-label={`${project.title}报名状态`}>{["暂未处理", "准备报名", "已报名", "已完成测评", "已参加笔试", "已进入面试", "已结束"].map((status) => <option key={status}>{status}</option>)}</select><button className="favorite-button hearted" onClick={(event) => { event.stopPropagation(); onToggleFavorite(project); }}>♥</button></div></article>) : <EmptyState onReset={() => setFilter("全部")} />}</div></>;
}

function MyProjectsView({ projects: favoriteProjects, trackers, tasks, onOpen, onToggleFavorite, onUpdateTracker, onAddTask, onToggleTask }: { projects: Project[]; trackers: Record<string, { status: ApplicationStatus; note: string }>; tasks: PersonalTask[]; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; onUpdateTracker: (project: Project, status: ApplicationStatus, note?: string) => void; onAddTask: (title: string, projectId?: string) => void; onToggleTask: (taskId: string) => void }) {
  return <><PersonalTasksPanel tasks={tasks} projects={favoriteProjects} onAddTask={onAddTask} onToggleTask={onToggleTask} /><LegacyMyProjectsView projects={favoriteProjects} trackers={trackers} onOpen={onOpen} onToggleFavorite={onToggleFavorite} onUpdateTracker={onUpdateTracker} /></>;
}

function PersonalTasksPanel({ tasks, projects: favoriteProjects, onAddTask, onToggleTask }: { tasks: PersonalTask[]; projects: Project[]; onAddTask: (title: string, projectId?: string) => void; onToggleTask: (taskId: string) => void }) {
  const [draft, setDraft] = useState("");
  const activeTasks = tasks.filter((task) => task.status !== "已取消");
  return <div className="surface personal-task-board"><div className="surface-heading"><div><span className="section-kicker">PERSONAL ACTIONS</span><h3>我的求职待办</h3></div><span className="task-count">{activeTasks.filter((task) => task.status !== "已完成").length} 项待处理</span></div><p className="task-board-copy">把收藏的招聘项目变成下一步行动，系统会根据报名状态给出简单提示。</p><div className="task-add-row"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="添加待办，例如：修改技术岗位简历" onKeyDown={(event) => { if (event.key === "Enter" && draft.trim()) { onAddTask(draft.trim(), favoriteProjects[0]?.id); setDraft(""); } }} /><button className="primary-button" onClick={() => { if (draft.trim()) { onAddTask(draft.trim(), favoriteProjects[0]?.id); setDraft(""); } }}>＋ 添加待办</button></div><div className="personal-task-list">{activeTasks.slice(0, 5).map((task) => { const project = favoriteProjects.find((item) => item.id === task.projectId) ?? projects.find((item) => item.id === task.projectId); return <button className={`personal-task-row ${task.status === "已完成" ? "done" : ""}`} key={task.id} onClick={() => onToggleTask(task.id)}><span className="task-check">{task.status === "已完成" ? "✓" : ""}</span><span><strong>{task.title}</strong><small>{project ? project.shortName : "个人待办"} · {task.due ?? "自定义时间"}{task.suggested && <em>系统建议</em>}</small></span><b>{task.status === "已完成" ? "已完成" : task.status}</b></button>; })}</div></div>;
}

function MessagesView({ notifications, onRead }: { notifications: AppNotification[]; onRead: (id: string) => void }) {
  const messages = notifications.map((notification) => ({ id: notification.id, icon: "◷", title: notification.title, text: notification.body, time: notification.createdAt, unread: !notification.readAt, color: "teal" }));
  const hasMessages = messages.length > 0;
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />INBOX</span><h1>消息中心</h1><p>和你收藏的校招项目有关的重要变化，会在这里提醒你。</p></div></div>{hasMessages ? <><div className="message-banner"><div className="message-banner-icon">◷</div><div><strong>提醒已开启</strong><p>收藏项目的截止、开始和信息变化会在这里显示。</p></div><span className="plain-tag">站内提醒</span></div><div className="message-list">{messages.map((notification) => <article className={`message-card ${notification.unread ? "unread" : ""}`} key={notification.id}><div className={`message-icon ${notification.color}`}>{notification.icon}</div><div className="message-copy"><div><strong>{notification.title}</strong>{notification.unread && <span className="unread-dot" />}</div><p>{notification.text}</p><small>{notification.time}</small></div>{notification.unread && <button className="message-arrow" onClick={() => onRead(notification.id)} aria-label="标记已读">✓</button>}</article>)}</div></> : <div className="surface empty-state"><div className="empty-state-icon">◌</div><h3>暂无提醒</h3><p>收藏招聘后，我们会在重要报名时间前提醒你。</p></div>}</>;
}

type PublicSourceRecord = {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  level: string;
  discoveryStatus: string;
  statusLabel: string;
  normalFrequency: string;
  lastVerifiedAt: string | null;
  requiresManualReview: boolean;
  automationAllowed: boolean;
  note: string;
  opportunityCount: number;
};

function PublicSourceDirectory({ onOpenRecruitment }: { onOpenRecruitment: (sourceName: string) => void }) {
  const [sources, setSources] = useState<PublicSourceRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, verified: 0, needsReview: 0, enterprise: 0, nationalAndProvincial: 0, stateOwned: 0 });
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const categoryOptions = [
    { value: "全部", label: "全部" },
    { value: "ENTERPRISE", label: "重点企业" },
    { value: "NATIONAL_CIVIL_SERVICE", label: "国考" },
    { value: "PROVINCIAL_CIVIL_SERVICE", label: "省考" },
    { value: "CENTRAL_SOE", label: "央企" },
    { value: "LOCAL_SOE", label: "地方国企" },
    { value: "ENTERPRISE_DISCOVERY", label: "企业发现" },
  ];

  useEffect(() => {
    let active = true;
    fetch("/api/source-directory")
      .then((response) => response.json() as Promise<{ ok?: boolean; sources?: PublicSourceRecord[]; summary?: typeof summary }>)
      .then((payload) => {
        if (!active) return;
        if (!payload.ok || !Array.isArray(payload.sources)) {
          setState("unavailable");
          return;
        }
        setSources(payload.sources);
        if (payload.summary) setSummary(payload.summary);
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, []);

  const visible = sources.filter((source) => {
    const text = `${source.name} ${source.categoryLabel} ${source.sourceDomain ?? ""} ${source.note}`.toLowerCase();
    return (category === "全部" || source.category === category) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  });

  return <>
    <div className="page-heading source-directory-heading"><div><span className="eyebrow"><span className="eyebrow-line" />PUBLIC SOURCE DIRECTORY</span><h1>全国来源目录</h1><p>公开整理重点企业、国考、省考、央企和地方国企的官方信息入口。</p></div><span className="source-directory-status">来源档案公开展示</span></div>
    <div className="source-directory-guard"><span>i</span><div><strong>请先看清：来源目录不等同于招聘岗位</strong><p>这里只展示来源及核验状态。已有正式招聘项目的来源会标出数量并可直接查看；没有具体公告的来源不会被伪装成招聘岗位。</p></div></div>
    <div className="source-directory-summary"><div><strong>{summary.total}</strong><span>已登记来源</span></div><div><strong>{summary.verified}</strong><span>已核验入口</span></div><div><strong>{summary.needsReview}</strong><span>待人工核验</span></div><div><strong>{summary.enterprise}</strong><span>重点企业</span></div><div><strong>{summary.nationalAndProvincial}</strong><span>国考 / 省考</span></div><div><strong>{summary.stateOwned}</strong><span>央企 / 地方国企</span></div></div>
    <div className="source-directory-toolbar"><div className="list-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索来源名称、地区或域名" /></div><div className="source-directory-count">显示 <strong>{visible.length}</strong> 条</div></div>
    <div className="source-directory-filters" aria-label="来源分类">{categoryOptions.map((item) => <button key={item.value} className={category === item.value ? "active" : ""} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
    {state === "loading" && <div className="surface empty-state"><h3>正在读取来源目录</h3><p>只展示生产数据库中的正式来源档案。</p></div>}
    {state === "unavailable" && <div className="surface empty-state"><h3>来源目录暂时不可用</h3><p>数据库读取失败，平台不会用静态样例替代正式来源目录。</p></div>}
    {state === "ready" && <div className="source-directory-list">{visible.length ? visible.map((source) => <article className="source-directory-card" key={source.id}><div className="source-directory-card-top"><div><span className={`source-level-badge level-${source.level.slice(0, 1)}`}>{source.level}来源</span><strong>{source.name}</strong><small>{source.categoryLabel} · {source.sourceDomain ?? "官方入口待人工核验"}</small></div><span className={`source-directory-state ${source.discoveryStatus === "VERIFIED" ? "verified" : "pending"}`}><i />{source.statusLabel}</span></div><div className="source-directory-card-meta"><span>检查频率：{source.normalFrequency === "EVERY_7_DAYS" ? "每7天" : source.normalFrequency === "DAILY" ? "每日" : "人工检查"}</span><span>自动采集：{source.automationAllowed ? "允许" : "禁止"}</span><span>人工审核：{source.requiresManualReview ? "必须" : "否"}</span>{source.lastVerifiedAt && <span>最近核验：{source.lastVerifiedAt.slice(0, 10)}</span>}{source.opportunityCount > 0 && <span className="source-opportunity-count">已发布招聘：{source.opportunityCount} 个</span>}</div><p>{source.note || "暂无管理员备注"}</p><div className="source-directory-card-footer"><span>{source.opportunityCount > 0 ? "已关联正式招聘信息" : "仅作公开来源索引，不代表已有招聘岗位"}</span><div className="source-directory-card-actions">{source.opportunityCount > 0 && <button className="source-recruitment-link" onClick={() => onOpenRecruitment(source.name)}>查看招聘信息 →</button>}{source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noreferrer">打开官方入口 ↗</a> : <b>待人工补充官方入口</b>}</div></div></article>) : <div className="surface empty-state"><h3>没有匹配的来源</h3><p>换个关键词或切换来源分类。</p></div>}</div>}
  </>;
}

function ProfileView({ profile, onChange, onSave }: { profile: UserProfile; onChange: (profile: UserProfile) => void; onSave: () => void }) {
  function toggleRegion(region: string) { onChange({ ...profile, regions: profile.regions.includes(region) ? profile.regions.filter((item) => item !== region) : [...profile.regions, region] }); }
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />YOUR PROFILE</span><h1>求职资料</h1><p>告诉我们你的方向，校招雷达会用规则帮你找到值得关注的项目。</p></div><button className="primary-button" onClick={onSave}>保存资料 <span>✓</span></button></div><div className="profile-layout"><div className="surface form-surface"><div className="form-section"><div className="form-section-title"><span className="form-number">01</span><div><h3>基础信息</h3><p>用于计算毕业年份和学历匹配。</p></div></div><div className="form-grid"><label className="field"><span>称呼</span><input value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} /></label><label className="field"><span>毕业年份</span><select value={profile.graduation} onChange={(event) => onChange({ ...profile, graduation: event.target.value })}><option>2027</option><option>2028</option><option>2026</option><option>2029</option></select></label><label className="field"><span>当前学历</span><select value={profile.degree} onChange={(event) => onChange({ ...profile, degree: event.target.value })}><option>本科</option><option>硕士</option><option>博士</option></select></label><label className="field"><span>意向招聘类型</span><select defaultValue="央企、国企、互联网公司"><option>央企、国企、互联网公司</option><option>央企、国企</option><option>互联网公司、知名企业</option><option>全部类型</option></select></label></div></div><div className="form-section"><div className="form-section-title"><span className="form-number">02</span><div><h3>专业方向</h3><p>匹配结果仅作筛选参考，以官方要求为准。</p></div></div><div className="form-grid"><label className="field"><span>学科门类</span><select value={majorOptions.find((group) => group.majors.includes(profile.major))?.category ?? ""} onChange={(event) => onChange({ ...profile, major: majorOptions.find((group) => group.category === event.target.value)?.majors[0] ?? profile.major })}><option value="">请选择学科门类</option>{majorOptions.map((group) => <option key={group.category}>{group.category}</option>)}</select></label><label className="field"><span>具体专业</span><select value={profile.major} onChange={(event) => onChange({ ...profile, major: event.target.value })}>{majorOptions.flatMap((group) => group.majors).map((major) => <option key={major}>{major}</option>)}<option>其他专业</option></select></label></div><label className="check-row"><input type="checkbox" checked={profile.acceptAnyMajor} onChange={(event) => onChange({ ...profile, acceptAnyMajor: event.target.checked })} /><span className="fake-checkbox">✓</span><span><strong>愿意查看不限专业的招聘</strong><small>在匹配结果中展示不限专业项目</small></span></label></div><div className="form-section"><div className="form-section-title"><span className="form-number">03</span><div><h3>地区偏好</h3><p>可以多选，也可以接受全国岗位。</p></div></div><div className="region-picker">{regionOptions.filter((region) => region !== "全国").map((region) => <button key={region} className={profile.regions.includes(region) ? "selected" : ""} onClick={() => toggleRegion(region)}>{region}{profile.regions.includes(region) && <span>✓</span>}</button>)}</div><label className="check-row"><input type="checkbox" checked={profile.nationwide} onChange={(event) => onChange({ ...profile, nationwide: event.target.checked })} /><span className="fake-checkbox">✓</span><span><strong>接受全国岗位</strong><small>扩大可见项目范围</small></span></label></div></div><aside className="profile-aside"><div className="profile-score"><span className="score-label">PROFILE SCORE</span><div className="score-ring"><strong>80</strong><small>/ 100</small></div><h3>资料完成得不错</h3><p>再补充一下提醒偏好，匹配会更贴近你的节奏。</p><button onClick={onSave}>保存并更新雷达 <span>→</span></button></div><div className="tip-list"><h4>填写小提示</h4><div><span>01</span>专业选择越具体，匹配结果越有参考价值</div><div><span>02</span>地区可以多选，不设限也能发现新机会</div><div><span>03</span>信息仅用于筛选，不代表最终报名资格</div></div></aside></div></>;
}

function AboutView({ brand }: { brand: BrandConfig }) {
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />ABOUT RADAR</span><h1>关于{brand.name}</h1><p>{brand.marketingCopy}</p></div></div><div className="about-layout"><div className="surface about-main"><div className="about-quote">“少一点错过，多一点准备。”</div><p>{brand.marketingCopy}平台聚合企业、央国企及后续招录模块的公开信息，帮助你按专业、学历、地区和时间筛选机会，也可以收藏、设置提醒和记录申请进度。</p><div className="about-points"><div><span>01</span><strong>公开来源</strong><small>信息来自企业官网、官方账号与高校就业渠道</small></div><div><span>02</span><strong>规则匹配</strong><small>匹配结果帮助筛选，不替代招聘方审核</small></div><div><span>03</span><strong>保持更新</strong><small>展示最近核验时间和信息变更记录</small></div></div></div><div className="surface disclaimer-card"><span className="notice-icon">i</span><h3>重要说明</h3><p>{brand.disclaimer}</p><div className="source-legend"><strong>信息来源级别</strong><span><b>A</b> 企业官方招聘网站或政府网站</span><span><b>B</b> 企业官方公众号、官方招聘账号</span><span><b>C</b> 高校就业网站转载</span><span><b>D</b> 第三方平台或用户提交</span></div></div></div></>;
}

function ProjectModal({ project, userMajor, isFavorite, tracker, reminderSettings, onClose, onToggleFavorite, onUpdateTracker, onUpdateReminderSettings, onOpenExternal, onOpenCorrection, onNotify }: { project: Project; userMajor: string; isFavorite: boolean; tracker?: { status: ApplicationStatus; note: string }; reminderSettings?: ReminderSettings; onClose: () => void; onToggleFavorite: () => void; onUpdateTracker: (status: ApplicationStatus, note?: string) => void; onUpdateReminderSettings: (patch: Partial<ReminderSettings>) => void; onOpenExternal: () => void; onOpenCorrection: () => void; onNotify: (message: string) => void }) {
  const [note, setNote] = useState(tracker?.note ?? "");
  const match = getMatch(project, userMajor);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="project-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="关闭">×</button><div className="modal-header"><div className={`company-mark large ${project.logoTone}`}>{project.shortName.slice(0, 1)}</div><div><div className="company-name-line"><strong>{project.company}</strong><span className="official-tag">真实数据</span><span className="official-tag">{project.sourceLevel}来源</span></div><h2>{project.title}</h2><div className="project-tags"><span className={`status-tag ${statusClass[project.status]}`}><i />{project.displayType === "OFFICIAL_RECRUITMENT_ENTRY" ? "官方入口" : statusLabel[project.status]}</span><span className="plain-tag">{project.companyType}</span><span className="plain-tag">{project.batch}</span></div></div></div><div className="modal-deadline"><div><span>报名截止</span><strong>{project.displayType === "OFFICIAL_RECRUITMENT_ENTRY" ? "以官网公告为准" : formatDateWithWeekday(project.deadline)}</strong></div><div><span>报名开始</span><strong>{project.displayType === "OFFICIAL_RECRUITMENT_ENTRY" ? "尚未公布" : formatDateWithWeekday(project.startAt)}</strong></div><div><span>工作地区</span><strong>{project.regions.join(" · ")}</strong></div></div><div className="modal-body"><section><div className="detail-title"><span>01</span><h3>招聘简介</h3></div><p>{project.intro}</p><div className="detail-grid"><div><span>面向毕业年份</span><strong>{project.graduationYears.length ? project.graduationYears.map((year) => `${year}届`).join("、") : "以官方公告为准"}</strong></div><div><span>学历要求</span><strong>{project.degrees.join(" / ") || "以官方公告为准"}</strong></div><div><span>专业要求</span><strong>{project.originalMajors}</strong></div><div><span>标准专业标签</span><strong>{project.majors.length ? project.majors.join("、") : "以官方公告为准"}</strong></div></div></section><section className="match-result"><div className="detail-title"><span>02</span><h3>你的专业匹配</h3></div><div className={`match-result-box ${match === "不限专业" ? "any" : ""}`}><span className="match-result-icon">✦</span><div><strong>{match}</strong><p>{match === "明确匹配" ? "你的专业出现在招聘标准专业标签中。" : match === "不限专业" ? "该项目未限制专业，值得直接查看具体岗位。" : "根据专业大类和招聘原文整理，仅供筛选参考。"}</p></div></div><small className="match-disclaimer">专业匹配结果仅供信息筛选参考，是否符合报名条件请以招聘单位官方审核结果为准。</small></section><section><div className="detail-title"><span>03</span><h3>我的跟进</h3></div><div className="tracker-editor"><select value={tracker?.status ?? "暂未处理"} onChange={(event) => onUpdateTracker(event.target.value as ApplicationStatus)} aria-label="报名状态"><option>暂未处理</option><option>准备报名</option><option>已报名</option><option>已完成测评</option><option>已参加笔试</option><option>已进入面试</option><option>已结束</option></select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="添加一条个人备注，例如：周日前完成网申" /><button onClick={() => { onUpdateTracker(tracker?.status ?? "准备报名", note); onNotify("个人备注已保存"); }}>保存备注</button></div></section><ReminderControls project={project} isFavorite={isFavorite} settings={reminderSettings} onUpdate={onUpdateReminderSettings} /></div><div className="modal-footer"><div><span>来源：{project.sourceName}</span><span>最近核验：{formatDate(project.verifiedAt)}</span></div><div className="modal-actions">{project.announcementUrl && <a className="secondary-button" href={project.announcementUrl} target="_blank" rel="noreferrer">官方公告 <span>↗</span></a>}<button className="text-button correction-button" onClick={onOpenCorrection}>提交纠错</button><button className={`secondary-button favorite-action ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite}>{isFavorite ? "♥ 已收藏" : "♡ 收藏项目"}</button><button className="primary-button" onClick={onOpenExternal}>前往官方报名 <span>↗</span></button></div></div></div></div>;
}

function ReminderControls({ project, isFavorite, settings, onUpdate }: { project: Project; isFavorite: boolean; settings?: ReminderSettings; onUpdate: (patch: Partial<ReminderSettings>) => void }) {
  const eligible = hasExplicitDeadline(project);
  if (!eligible) return <div className="reminder-note"><span>◷</span><div><strong>{project.deadline ? "截止时间需要人工复核" : "暂未公布明确截止日期"}</strong><small>{project.deadline ? "当前不会生成固定日期倒计时提醒。" : "收藏后，时间更新并核验后才会生成截止提醒。"}</small></div></div>;
  const current = settings ?? DEFAULT_REMINDER_SETTINGS;
  return <section className="reminder-controls"><div className="detail-title"><span>04</span><h3>报名截止提醒</h3><span className={isFavorite && current.enabled ? "reminder-enabled" : "reminder-disabled"}>{isFavorite && current.enabled ? "已开启提醒" : "收藏后自动开启"}</span></div><div className="reminder-options"><label><input type="checkbox" checked={current.remind7Days} disabled={!isFavorite} onChange={(event) => onUpdate({ remind7Days: event.target.checked })} /><span>截止前7天</span></label><label><input type="checkbox" checked={current.remind3Days} disabled={!isFavorite} onChange={(event) => onUpdate({ remind3Days: event.target.checked })} /><span>截止前3天</span></label><label><input type="checkbox" checked={current.remind1Day} disabled={!isFavorite} onChange={(event) => onUpdate({ remind1Day: event.target.checked })} /><span>截止前1天</span></label><label><input type="checkbox" checked={current.remindSameDay} disabled={!isFavorite} onChange={(event) => onUpdate({ remindSameDay: event.target.checked })} /><span>当天提醒</span></label><label><input type="checkbox" checked={current.changeNotificationEnabled} disabled={!isFavorite} onChange={(event) => onUpdate({ changeNotificationEnabled: event.target.checked })} /><span>招聘信息变更</span></label></div><small className="reminder-footnote">{isFavorite ? "站内消息会在这里展示；取消收藏后，未来未发送提醒会被取消。" : "收藏这个项目后，系统会按选中的时间点创建站内提醒。"}</small></section>;
}

function CorrectionModal({ project, onClose, onSubmit }: { project: Project; onClose: () => void; onSubmit: () => void }) {
  const [type, setType] = useState("时间错误");
  const [content, setContent] = useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="small-modal correction-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="external-icon">✎</div><h3>提交信息纠错</h3><p className="correction-project">{project.title}</p><label className="login-field"><span>纠错类型</span><select value={type} onChange={(event) => setType(event.target.value)}><option>时间错误</option><option>官方链接失效</option><option>招聘已截止</option><option>专业要求错误</option><option>招聘信息重复</option><option>其他问题</option></select></label><label className="login-field"><span>补充说明</span><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="请尽量提供可核验的线索" /></label><div className="small-modal-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={onSubmit}>提交纠错 <span>→</span></button></div></div></div>;
}

function ExternalLinkModal({ project, onClose }: { project: Project; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="small-modal" onMouseDown={(event) => event.stopPropagation()}><div className="external-icon">↗</div><h3>即将前往第三方官方网站</h3><p>请注意核实网站域名和招聘信息，具体招聘条件、报名时间及岗位要求以招聘单位官方发布为准。</p><div className="external-domain">{project.link.replace("https://", "")}</div><div className="small-modal-actions"><button className="secondary-button" onClick={onClose}>返回查看</button><a className="primary-button" href={project.link} target="_blank" rel="noreferrer">继续访问 <span>↗</span></a></div></div></div>;
}

function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const [mode, setMode] = useState<"email" | "phone">("email");
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="login-mark">⌁</div><h2>欢迎回到校招雷达</h2><p>登录后收藏招聘项目，设置属于你的提醒。</p><div className="login-tabs"><button className={mode === "email" ? "active" : ""} onClick={() => setMode("email")}>邮箱登录</button><button className={mode === "phone" ? "active" : ""} onClick={() => setMode("phone")}>手机号登录</button></div>{mode === "email" ? <><label className="login-field"><span>邮箱</span><input placeholder="you@domain.cn" type="email" /></label><label className="login-field"><span>密码</span><input placeholder="请输入密码" type="password" /></label></> : <><label className="login-field"><span>手机号</span><input placeholder="请输入手机号" /></label><label className="login-field"><span>验证码</span><div className="code-input"><input placeholder="6位验证码" /><button>获取验证码</button></div></label></>}<button className="primary-button login-submit" onClick={onLogin}>登录并继续 <span>→</span></button><small className="login-terms">登录即代表你同意《用户协议》和《隐私政策》</small></div></div>;
}

function ProfileQuickPanel({ profile, onClose, onEdit, onLogout }: { profile: { name: string; major: string; degree: string; graduation: string }; onClose: () => void; onEdit: () => void; onLogout: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><aside className="quick-panel" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="quick-profile"><div className="profile-avatar-large">{profile.name.slice(0, 1) || "·"}</div><h3>{profile.name || "当前账号"}</h3><p>{profile.major || "尚未选择专业"}</p><span>{profile.degree} · {profile.graduation}届</span></div><div className="quick-links"><button onClick={onEdit}><span>◎</span>编辑求职资料 <b>→</b></button><button onClick={onClose}><span>◌</span>提醒设置 <b>→</b></button><button onClick={onClose}><span>◫</span>隐私与账号 <b>→</b></button></div><button className="logout-button" onClick={onLogout}>退出当前账号</button></aside></div>;
}
