"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApplicationStatus,
  Project,
  ProjectStatus,
  formatDate,
  formatDateWithWeekday,
  getMatch,
  majorOptions,
  notificationSeed,
  projects,
  regionOptions,
  siteConfig,
  statusClass,
  statusLabel,
} from "./data";
import AdminConsole from "./admin-console";

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

const navItems: { id: View; label: string; icon: string; badge?: string }[] = [
  { id: "home", label: "总览", icon: "⌂" },
  { id: "projects", label: "招聘信息", icon: "▤" },
  { id: "calendar", label: "招聘日历", icon: "□" },
  { id: "my-projects", label: "我的招聘", icon: "♡", badge: "4" },
  { id: "messages", label: "消息中心", icon: "◌", badge: "2" },
];

const trackerDefaults: Record<string, { status: ApplicationStatus; note: string }> = {
  p1: { status: "准备报名", note: "周日前完成网申，准备英文自我介绍" },
  p7: { status: "准备报名", note: "关注笔试时间，整理金融科技项目经历" },
  p10: { status: "已报名", note: "" },
};

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readLocalStorage("radar-favorites", ["p1", "p3", "p7", "p10"]));
  const [trackers, setTrackers] = useState<Record<string, { status: ApplicationStatus; note: string }>>(() => readLocalStorage("radar-trackers", trackerDefaults));
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [externalProject, setExternalProject] = useState<Project | null>(null);
  const [correctionProject, setCorrectionProject] = useState<Project | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [loggedIn, setLoggedIn] = useState(true);
  const [profile, setProfile] = useState<UserProfile>({
    name: "林同学",
    major: "计算机科学与技术",
    degree: "硕士",
    graduation: "2027",
    regions: ["北京", "上海", "深圳"],
    nationwide: true,
    acceptAnyMajor: true,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("radar-favorites", JSON.stringify(favoriteIds));
      window.localStorage.setItem("radar-trackers", JSON.stringify(trackers));
    } catch {
      // Device-local demo state is best effort only.
    }
  }, [favoriteIds, trackers]);

  function notify(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  }

  function toggleFavorite(project: Project) {
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    setFavoriteIds((current) => {
      const exists = current.includes(project.id);
      notify(exists ? "已取消收藏" : "已收藏，可在我的招聘中查看");
      return exists ? current.filter((id) => id !== project.id) : [...current, project.id];
    });
  }

  function updateTracker(project: Project, status: ApplicationStatus, note = "") {
    setTrackers((current) => ({ ...current, [project.id]: { status, note: note || current[project.id]?.note || "" } }));
    notify(`已标记为「${status}」`);
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
          <div className="brand-mark"><span>⌁</span></div>
          <div>
            <div className="brand-name">{siteConfig.name}</div>
            <div className="brand-subtitle">校园招聘信息雷达</div>
          </div>
        </div>

        <div className="sidebar-section-label">工作台</div>
        <nav className="side-nav" aria-label="主导航">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span className={`nav-badge ${item.id === "messages" ? "nav-badge-hot" : ""}`}>{item.id === "my-projects" ? favoriteIds.length : item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-section-label side-secondary-label">更多</div>
        <nav className="side-nav" aria-label="更多导航">
          <button className={`nav-item ${view === "profile" ? "active" : ""}`} onClick={() => navigate("profile")}><span className="nav-icon">◎</span><span>求职资料</span></button>
          <button className={`nav-item ${view === "admin" ? "active" : ""}`} onClick={() => navigate("admin")}><span className="nav-icon">▦</span><span>运营后台</span><span className="demo-mini">Beta</span></button>
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
          <button className="mobile-brand" onClick={() => navigate("home")}><span className="brand-mark small"><span>⌁</span></span><strong>{siteConfig.name}</strong></button>
          <div className="topbar-search">
            <span className="search-icon">⌕</span>
            <input aria-label="搜索招聘项目" value={search} onChange={(event) => { setSearch(event.target.value); if (view !== "projects") setView("projects"); }} placeholder="搜索企业、项目、专业或地区" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <span className="demo-pill"><span className="pulse-dot" />演示数据</span>
            <button className="icon-button" aria-label="帮助" onClick={() => navigate("about")}>?</button>
            <button className="icon-button notification-button" aria-label="消息中心" onClick={() => navigate("messages")}>♧<span /></button>
            <button className="top-avatar" onClick={() => setProfileOpen(true)}>林</button>
          </div>
        </header>

        <div className="page-content">
          {view === "home" && <Dashboard onNavigate={navigate} onOpen={setSelectedProject} onToggleFavorite={toggleFavorite} favoriteIds={favoriteIds} profile={profile} />}
          {view === "projects" && <ProjectsView search={search} setSearch={setSearch} filterOpen={filterOpen} setFilterOpen={setFilterOpen} onOpen={setSelectedProject} onToggleFavorite={toggleFavorite} favoriteIds={favoriteIds} profile={profile} />}
          {view === "calendar" && <CalendarView onOpen={setSelectedProject} />}
          {view === "my-projects" && <MyProjectsView projects={favoriteProjects} trackers={trackers} onOpen={setSelectedProject} onToggleFavorite={toggleFavorite} onUpdateTracker={updateTracker} />}
          {view === "messages" && <MessagesView />}
          {view === "profile" && <ProfileView profile={profile} onChange={setProfile} onSave={() => notify("求职资料已保存")} />}
          {view === "admin" && <AdminConsole onOpen={setSelectedProject} onNotify={notify} />}
          {view === "about" && <AboutView />}
        </div>
      </main>

      {selectedProject && <ProjectModal project={selectedProject} userMajor={profile.major} isFavorite={favoriteIds.includes(selectedProject.id)} tracker={trackers[selectedProject.id]} onClose={() => setSelectedProject(null)} onToggleFavorite={() => toggleFavorite(selectedProject)} onUpdateTracker={(status, note) => updateTracker(selectedProject, status, note)} onOpenExternal={() => setExternalProject(selectedProject)} onOpenCorrection={() => setCorrectionProject(selectedProject)} onNotify={notify} />}
      {externalProject && <ExternalLinkModal project={externalProject} onClose={() => setExternalProject(null)} />}
      {correctionProject && <CorrectionModal project={correctionProject} onClose={() => setCorrectionProject(null)} onSubmit={() => { setCorrectionProject(null); notify("纠错已提交，管理员会在核验后处理"); }} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={() => { setLoggedIn(true); setLoginOpen(false); notify("欢迎回来，林同学"); }} />}
      {profileOpen && <ProfileQuickPanel profile={profile} onClose={() => setProfileOpen(false)} onEdit={() => { setProfileOpen(false); navigate("profile"); }} onLogout={() => { setLoggedIn(false); setProfileOpen(false); notify("已退出演示账号", "info"); }} />}
      {toast && <div className={`toast ${toast.tone === "info" ? "toast-info" : ""}`}><span>{toast.tone === "info" ? "i" : "✓"}</span>{toast.message}</div>}
    </div>
  );
}

function Dashboard({ onNavigate, onOpen, onToggleFavorite, favoriteIds, profile }: { onNavigate: (view: View) => void; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; favoriteIds: string[]; profile: { name: string; major: string; degree: string; graduation: string } }) {
  const focusProjects = projects.filter((project) => project.status === "ending" || project.recommended).slice(0, 4);
  const matchedCount = projects.filter((project) => ["明确匹配", "专业大类匹配", "不限专业"].includes(getMatch(project, profile.major))).length;
  return (
    <>
      <div className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-line" />{siteConfig.edition}校招季 · 早上好</div><h1>不错过每一次<br /><em>校招机会</em></h1><p className="hero-copy">根据你的专业、学历和求职方向，整理近期央企、国企和知名企业校园招聘信息。</p><div className="hero-actions"><button className="primary-button" onClick={() => onNavigate("profile")}>完善求职资料 <span>→</span></button><button className="text-button" onClick={() => onNavigate("projects")}>查看近期招聘 <span>↗</span></button></div></div>
        <div className="hero-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="radar-core"><span>⌁</span><small>RADAR</small></div><span className="float-chip chip-one">央企 <b>12</b></span><span className="float-chip chip-two">互联网 <b>8</b></span><span className="float-chip chip-three">今日新增 <b>06</b></span><span className="radar-signal signal-one" /><span className="radar-signal signal-two" /></div>
      </div>

      <div className="notice-strip"><span className="notice-icon">i</span><span>招聘信息来源于公开渠道，平台仅提供整理、筛选和提醒服务，最终信息请以招聘单位官方网站为准。</span><button onClick={() => onNavigate("about")}>了解详情 <span>→</span></button></div>

      <div className="stats-grid">
        <StatCard label="今日新增" value="06" suffix="条" trend="较昨日 +2" icon="✦" accent="orange" />
        <StatCard label="正在招聘" value="48" suffix="个" trend="持续更新中" icon="◒" accent="teal" />
        <StatCard label="7天内截止" value="09" suffix="个" trend="建议优先处理" icon="◷" accent="coral" />
        <StatCard label="与我匹配" value={String(matchedCount).padStart(2, "0")} suffix="个" trend="基于你的资料" icon="✧" accent="violet" />
      </div>

      <div className="section-heading"><div><span className="section-kicker">TODAY&apos;S FOCUS</span><h2>今天值得关注</h2></div><button className="link-button" onClick={() => onNavigate("projects")}>查看全部 <span>→</span></button></div>
      <div className="focus-grid">
        {focusProjects.map((project) => <ProjectCard key={project.id} project={project} compact onOpen={onOpen} onToggleFavorite={onToggleFavorite} isFavorite={favoriteIds.includes(project.id)} profileMajor={profile.major} />)}
      </div>

      <div className="lower-grid">
        <div className="surface profile-summary"><div className="surface-heading"><div><span className="section-kicker">YOUR RADAR</span><h3>你的求职雷达</h3></div><button className="more-button" onClick={() => onNavigate("profile")}>编辑 <span>↗</span></button></div><div className="profile-line"><div className="profile-avatar-large">林</div><div><strong>{profile.major}</strong><span>{profile.degree} · {profile.graduation}届 · {profile.name}</span></div></div><div className="radar-progress"><div className="progress-label"><span>资料完善度</span><strong>80%</strong></div><div className="progress-track"><i style={{ width: "80%" }} /></div></div><div className="match-callout"><span>✦</span><p>已为你找到 <b>{matchedCount} 个</b>可重点关注的项目</p><button onClick={() => onNavigate("projects")}>去看看</button></div></div>
        <div className="surface company-trends"><div className="surface-heading"><div><span className="section-kicker">HOT COMPANIES</span><h3>近期热门企业</h3></div><button className="more-button" onClick={() => onNavigate("projects")}>更多 <span>↗</span></button></div><div className="company-list">{[projects[2], projects[0], projects[6], projects[14]].map((project, index) => <button className="company-row" key={project.id} onClick={() => onOpen(project)}><span className={`company-mark tiny ${project.logoTone}`}>{project.shortName.slice(0, 1)}</span><span className="company-row-name"><strong>{project.company}</strong><small>{project.companyNature} · {project.companyType}</small></span><span className="company-row-count">{[8, 12, 5, 3][index]} 个项目 <span>›</span></span></button>)}</div></div>
      </div>
    </>
  );
}

function StatCard({ label, value, suffix, trend, icon, accent }: { label: string; value: string; suffix: string; trend: string; icon: string; accent: string }) {
  return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{suffix}</small></div><span className="stat-trend">{trend}</span></div>;
}

function ProjectsView({ search, setSearch, filterOpen, setFilterOpen, onOpen, onToggleFavorite, favoriteIds, profile }: { search: string; setSearch: (value: string) => void; filterOpen: boolean; setFilterOpen: (value: boolean) => void; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; favoriteIds: string[]; profile: { major: string } }) {
  const [status, setStatus] = useState<"全部" | ProjectStatus>("全部");
  const [type, setType] = useState("全部类型");
  const [region, setRegion] = useState("全部地区");
  const [matchOnly, setMatchOnly] = useState(false);
  const filtered = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const textMatch = !query || `${project.company} ${project.title} ${project.originalMajors} ${project.regions.join(" ")}`.toLowerCase().includes(query);
    return textMatch && (status === "全部" || project.status === status) && (type === "全部类型" || project.companyType === type) && (region === "全部地区" || project.regions.includes(region)) && (!matchOnly || ["明确匹配", "专业大类匹配", "不限专业"].includes(getMatch(project, profile.major)));
  }), [search, status, type, region, matchOnly, profile.major]);
  return <>
    <div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />RECRUITMENT RADAR</span><h1>招聘信息</h1><p>把分散的校招机会，整理成一张清晰的清单。</p></div><button className={`filter-button ${filterOpen ? "selected" : ""}`} onClick={() => setFilterOpen(!filterOpen)}><span>☷</span> 筛选 <b>{[type !== "全部类型", region !== "全部地区", matchOnly].filter(Boolean).length || ""}</b></button></div>
    <div className="list-toolbar"><div className="list-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索企业、招聘项目、专业关键词" /></div><div className="result-count">共 <strong>{filtered.length}</strong> 个项目</div></div>
    {filterOpen && <div className="filter-panel"><FilterSelect label="招聘状态" value={status === "全部" ? "全部状态" : statusLabel[status]} onChange={(value) => setStatus(value === "全部状态" ? "全部" : (Object.entries(statusLabel).find(([, label]) => label === value)?.[0] as ProjectStatus))} options={["全部状态", "招聘中", "即将开始", "即将截止", "已截止"]} /><FilterSelect label="企业类型" value={type} onChange={setType} options={["全部类型", "央企", "地方国企", "互联网公司", "科技企业", "制造业企业", "金融企业", "知名企业"]} /><FilterSelect label="工作地区" value={region} onChange={setRegion} options={["全部地区", ...regionOptions]} /><label className="match-filter"><input type="checkbox" checked={matchOnly} onChange={(event) => setMatchOnly(event.target.checked)} /><span className="fake-checkbox">✓</span>只看与我匹配</label><button className="reset-button" onClick={() => { setStatus("全部"); setType("全部类型"); setRegion("全部地区"); setMatchOnly(false); }}>重置</button></div>}
    <div className="list-caption"><span>推荐排序</span><span className="caption-divider" /><span className="soft-text">优先展示与你专业匹配、近期截止的项目</span></div>
    <div className="project-list">{filtered.length ? filtered.map((project) => <ProjectCard key={project.id} project={project} onOpen={onOpen} onToggleFavorite={onToggleFavorite} isFavorite={favoriteIds.includes(project.id)} profileMajor={profile.major} />) : <EmptyState onReset={() => { setSearch(""); setStatus("全部"); setType("全部类型"); setRegion("全部地区"); setMatchOnly(false); }} />}</div>
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
    <div className="card-topline"><div className={`company-mark ${project.logoTone}`}>{project.shortName.slice(0, 1)}</div><div className="project-heading"><div className="company-name-line"><strong>{project.company}</strong><span className="demo-tag">演示数据</span>{project.sourceLevel === "A级" && <span className="official-tag">官方来源</span>}</div><h3>{project.title}</h3></div><button className={`favorite-button ${isFavorite ? "hearted" : ""}`} aria-label={isFavorite ? "取消收藏" : "收藏项目"} onClick={(event) => { event.stopPropagation(); onToggleFavorite(project); }}>{isFavorite ? "♥" : "♡"}</button></div>
    <div className="project-tags"><span className={`status-tag ${statusClass[project.status]}`}><i />{statusLabel[project.status]}</span><span className="plain-tag">{project.companyType}</span><span className="plain-tag">{project.batch}</span>{match !== "暂无匹配依据" && <span className={`match-tag ${match === "不限专业" ? "match-any" : ""}`}>✦ {match}</span>}</div>
    <p className="project-summary">{project.originalMajors}</p>
    <div className="project-meta"><span><i className="meta-icon">⌖</i>{project.regions.slice(0, 3).join(" · ")}</span><span><i className="meta-icon">▣</i>{project.degrees.join(" / ")}</span><span className={project.status === "ending" ? "deadline-hot" : ""}><i className="meta-icon">◷</i>截止 {formatDate(project.deadline)}</span></div>
    {!compact && <div className="card-footer"><span>来源：{project.sourceName} <b className="source-level">{project.sourceLevel}</b></span><span>最近核验 {formatDate(project.verifiedAt)}</span><span className="card-open">查看详情 <b>→</b></span></div>}
  </article>;
}

function CalendarView({ onOpen }: { onOpen: (project: Project) => void }) {
  const calendarEvents: Record<number, { label: string; type: "start" | "end"; project: Project }[]> = {};
  projects.forEach((project) => {
    const date = project.status === "upcoming" ? Number(project.startAt.slice(-2)) : Number(project.deadline.slice(-2));
    if (!calendarEvents[date]) calendarEvents[date] = [];
    calendarEvents[date].push({ label: project.status === "upcoming" ? "开始报名" : "报名截止", type: project.status === "upcoming" ? "start" : "end", project });
  });
  const days = Array.from({ length: 42 }, (_, index) => index - 5);
  return <>
    <div className="page-heading calendar-heading"><div><span className="eyebrow"><span className="eyebrow-line" />YOUR TIMELINE</span><h1>招聘日历</h1><p>把开始报名、报名截止和你的跟进节点放在同一张日历里。</p></div><div className="calendar-month"><button aria-label="上个月">‹</button><strong>2026年 8月</strong><button aria-label="下个月">›</button></div></div>
    <div className="calendar-layout"><div className="surface calendar-surface"><div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day, index) => { const inMonth = day > 0 && day <= 31; const events = inMonth ? calendarEvents[day] ?? [] : []; return <div className={`calendar-day ${!inMonth ? "muted-day" : ""} ${day === 6 ? "today-day" : ""}`} key={`${day}-${index}`}><span className="day-number">{inMonth ? day : day <= 0 ? 27 + day : day - 31}</span>{day === 6 && <span className="today-label">今天</span>}<div className="day-events">{events.slice(0, 2).map((event) => <button key={`${event.project.id}-${event.type}`} className={`calendar-event ${event.type}`} onClick={() => onOpen(event.project)}><b>{event.type === "end" ? "截止" : "开始"}</b><span>{event.project.shortName}</span></button>)}</div></div>; })}</div></div><aside className="calendar-aside"><div className="surface upcoming-panel"><div className="surface-heading"><div><span className="section-kicker">UP NEXT</span><h3>接下来</h3></div><span className="date-count">4 件</span></div>{projects.filter((project) => project.status !== "closed").slice(0, 4).map((project) => <button className="upcoming-row" key={project.id} onClick={() => onOpen(project)}><span className={`date-bullet ${project.status === "ending" ? "hot" : ""}`}><b>{formatDate(project.deadline).split("月")[1].replace("日", "")}</b><small>8月</small></span><span><strong>{project.status === "upcoming" ? "开始报名" : "报名截止"}</strong><small>{project.shortName}</small></span><i>›</i></button>)}</div><div className="surface legend-panel"><h4>日历说明</h4><div><span className="legend-dot start" />开始报名</div><div><span className="legend-dot end" />报名截止</div><div><span className="legend-dot mine" />我的跟进</div></div></aside></div>
  </>;
}

function MyProjectsView({ projects: favoriteProjects, trackers, onOpen, onToggleFavorite, onUpdateTracker }: { projects: Project[]; trackers: Record<string, { status: ApplicationStatus; note: string }>; onOpen: (project: Project) => void; onToggleFavorite: (project: Project) => void; onUpdateTracker: (project: Project, status: ApplicationStatus, note?: string) => void }) {
  const [filter, setFilter] = useState<"全部" | ApplicationStatus>("全部");
  const list = favoriteProjects.filter((project) => filter === "全部" || trackers[project.id]?.status === filter);
  const statusList: ("全部" | ApplicationStatus)[] = ["全部", "准备报名", "已报名", "已完成测评", "已参加笔试", "已进入面试", "已结束"];
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />MY TRACKER</span><h1>我的招聘</h1><p>收藏、进度和备注都放在这里，按自己的节奏推进。</p></div><button className="secondary-button" onClick={() => setFilter("全部")}>导出清单 <span>↓</span></button></div><div className="tracker-summary"><div><strong>{favoriteProjects.length}</strong><span>已收藏</span></div><div><strong>{favoriteProjects.filter((project) => project.status === "ending").length}</strong><span>近期截止</span></div><div><strong>{Object.values(trackers).filter((item) => item.status === "已报名").length}</strong><span>已报名</span></div><div className="tracker-summary-note"><span>✦</span><p>建议先处理 <b>7天内截止</b> 的项目，避免错过窗口。</p></div></div><div className="status-tabs">{statusList.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item === "全部" && <small>{favoriteProjects.length}</small>}</button>)}</div><div className="project-list">{list.length ? list.map((project) => <article className="tracker-card" key={project.id} onClick={() => onOpen(project)}><div className={`company-mark ${project.logoTone}`}>{project.shortName.slice(0, 1)}</div><div className="tracker-main"><div className="company-name-line"><strong>{project.company}</strong><span className="demo-tag">演示数据</span></div><h3>{project.title}</h3><div className="tracker-line"><span className={`status-tag ${statusClass[project.status]}`}><i />{statusLabel[project.status]}</span><span>截止 {formatDate(project.deadline)}</span><span>✦ {getMatch(project)}</span></div>{trackers[project.id]?.note && <div className="note-line"><span>▰</span>{trackers[project.id].note}</div>}</div><div className="tracker-actions"><select value={trackers[project.id]?.status ?? "暂未处理"} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateTracker(project, event.target.value as ApplicationStatus)} aria-label={`${project.title}报名状态`}>{["暂未处理", "准备报名", "已报名", "已完成测评", "已参加笔试", "已进入面试", "已结束"].map((status) => <option key={status}>{status}</option>)}</select><button className="favorite-button hearted" onClick={(event) => { event.stopPropagation(); onToggleFavorite(project); }}>♥</button></div></article>) : <EmptyState onReset={() => setFilter("全部")} />}</div></>;
}

function MessagesView() {
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />INBOX</span><h1>消息中心</h1><p>和你收藏的校招项目有关的重要变化，会在这里提醒你。</p></div><button className="secondary-button">全部标为已读</button></div><div className="message-banner"><div className="message-banner-icon">◷</div><div><strong>提醒已开启</strong><p>你有 4 个收藏项目正在接收报名截止提醒。</p></div><button>管理提醒 <span>→</span></button></div><div className="message-list">{notificationSeed.map((notification) => <article className={`message-card ${notification.unread ? "unread" : ""}`} key={notification.id}><div className={`message-icon ${notification.color}`}>{notification.icon}</div><div className="message-copy"><div><strong>{notification.title}</strong>{notification.unread && <span className="unread-dot" />}</div><p>{notification.text}</p><small>{notification.time}</small></div><button className="message-arrow">›</button></article>)}</div></>;
}

function ProfileView({ profile, onChange, onSave }: { profile: UserProfile; onChange: (profile: UserProfile) => void; onSave: () => void }) {
  function toggleRegion(region: string) { onChange({ ...profile, regions: profile.regions.includes(region) ? profile.regions.filter((item) => item !== region) : [...profile.regions, region] }); }
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />YOUR PROFILE</span><h1>求职资料</h1><p>告诉我们你的方向，校招雷达会用规则帮你找到值得关注的项目。</p></div><button className="primary-button" onClick={onSave}>保存资料 <span>✓</span></button></div><div className="profile-layout"><div className="surface form-surface"><div className="form-section"><div className="form-section-title"><span className="form-number">01</span><div><h3>基础信息</h3><p>用于计算毕业年份和学历匹配。</p></div></div><div className="form-grid"><label className="field"><span>称呼</span><input value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} /></label><label className="field"><span>毕业年份</span><select value={profile.graduation} onChange={(event) => onChange({ ...profile, graduation: event.target.value })}><option>2027</option><option>2028</option><option>2026</option><option>2029</option></select></label><label className="field"><span>当前学历</span><select value={profile.degree} onChange={(event) => onChange({ ...profile, degree: event.target.value })}><option>本科</option><option>硕士</option><option>博士</option></select></label><label className="field"><span>意向招聘类型</span><select defaultValue="央企、国企、互联网公司"><option>央企、国企、互联网公司</option><option>央企、国企</option><option>互联网公司、知名企业</option><option>全部类型</option></select></label></div></div><div className="form-section"><div className="form-section-title"><span className="form-number">02</span><div><h3>专业方向</h3><p>匹配结果仅作筛选参考，以官方要求为准。</p></div></div><div className="form-grid"><label className="field"><span>学科门类</span><select value={majorOptions.find((group) => group.majors.includes(profile.major))?.category ?? ""} onChange={(event) => onChange({ ...profile, major: majorOptions.find((group) => group.category === event.target.value)?.majors[0] ?? profile.major })}><option value="">请选择学科门类</option>{majorOptions.map((group) => <option key={group.category}>{group.category}</option>)}</select></label><label className="field"><span>具体专业</span><select value={profile.major} onChange={(event) => onChange({ ...profile, major: event.target.value })}>{majorOptions.flatMap((group) => group.majors).map((major) => <option key={major}>{major}</option>)}<option>其他专业</option></select></label></div><label className="check-row"><input type="checkbox" checked={profile.acceptAnyMajor} onChange={(event) => onChange({ ...profile, acceptAnyMajor: event.target.checked })} /><span className="fake-checkbox">✓</span><span><strong>愿意查看不限专业的招聘</strong><small>在匹配结果中展示不限专业项目</small></span></label></div><div className="form-section"><div className="form-section-title"><span className="form-number">03</span><div><h3>地区偏好</h3><p>可以多选，也可以接受全国岗位。</p></div></div><div className="region-picker">{regionOptions.filter((region) => region !== "全国").map((region) => <button key={region} className={profile.regions.includes(region) ? "selected" : ""} onClick={() => toggleRegion(region)}>{region}{profile.regions.includes(region) && <span>✓</span>}</button>)}</div><label className="check-row"><input type="checkbox" checked={profile.nationwide} onChange={(event) => onChange({ ...profile, nationwide: event.target.checked })} /><span className="fake-checkbox">✓</span><span><strong>接受全国岗位</strong><small>扩大可见项目范围</small></span></label></div></div><aside className="profile-aside"><div className="profile-score"><span className="score-label">PROFILE SCORE</span><div className="score-ring"><strong>80</strong><small>/ 100</small></div><h3>资料完成得不错</h3><p>再补充一下提醒偏好，匹配会更贴近你的节奏。</p><button onClick={onSave}>保存并更新雷达 <span>→</span></button></div><div className="tip-list"><h4>填写小提示</h4><div><span>01</span>专业选择越具体，匹配结果越有参考价值</div><div><span>02</span>地区可以多选，不设限也能发现新机会</div><div><span>03</span>信息仅用于筛选，不代表最终报名资格</div></div></aside></div></>;
}

function AboutView() {
  return <><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line" />ABOUT RADAR</span><h1>关于校招雷达</h1><p>我们把公开渠道里的校招信息，整理成更容易行动的下一步。</p></div></div><div className="about-layout"><div className="surface about-main"><div className="about-quote">“少一点错过，多一点准备。”</div><p>校招雷达面向应届毕业生，聚合央企、国企、互联网公司和知名企业的公开校园招聘信息。你可以按专业、学历、地区和时间筛选机会，也可以收藏、设置提醒和记录报名进度。</p><div className="about-points"><div><span>01</span><strong>公开来源</strong><small>信息来自企业官网、官方账号与高校就业渠道</small></div><div><span>02</span><strong>规则匹配</strong><small>匹配结果帮助筛选，不替代招聘方审核</small></div><div><span>03</span><strong>保持更新</strong><small>展示最近核验时间和信息变更记录</small></div></div></div><div className="surface disclaimer-card"><span className="notice-icon">i</span><h3>重要说明</h3><p>本平台仅对公开招聘信息进行整理和展示，具体招聘条件、报名时间及岗位要求请以招聘单位官方网站发布的信息为准。</p><div className="source-legend"><strong>信息来源级别</strong><span><b>A</b> 企业官方招聘网站或政府网站</span><span><b>B</b> 企业官方公众号、官方招聘账号</span><span><b>C</b> 高校就业网站转载</span><span><b>D</b> 第三方平台或用户提交</span></div></div></div></>;
}

function ProjectModal({ project, userMajor, isFavorite, tracker, onClose, onToggleFavorite, onUpdateTracker, onOpenExternal, onOpenCorrection, onNotify }: { project: Project; userMajor: string; isFavorite: boolean; tracker?: { status: ApplicationStatus; note: string }; onClose: () => void; onToggleFavorite: () => void; onUpdateTracker: (status: ApplicationStatus, note?: string) => void; onOpenExternal: () => void; onOpenCorrection: () => void; onNotify: (message: string) => void }) {
  const [note, setNote] = useState(tracker?.note ?? "");
  const match = getMatch(project, userMajor);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="project-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="关闭">×</button><div className="modal-header"><div className={`company-mark large ${project.logoTone}`}>{project.shortName.slice(0, 1)}</div><div><div className="company-name-line"><strong>{project.company}</strong><span className="demo-tag">演示数据</span><span className="official-tag">{project.sourceLevel}来源</span></div><h2>{project.title}</h2><div className="project-tags"><span className={`status-tag ${statusClass[project.status]}`}><i />{statusLabel[project.status]}</span><span className="plain-tag">{project.companyType}</span><span className="plain-tag">{project.batch}</span></div></div></div><div className="modal-deadline"><div><span>报名截止</span><strong>{formatDateWithWeekday(project.deadline)}</strong></div><div><span>报名开始</span><strong>{formatDateWithWeekday(project.startAt)}</strong></div><div><span>工作地区</span><strong>{project.regions.join(" · ")}</strong></div></div><div className="modal-body"><section><div className="detail-title"><span>01</span><h3>招聘简介</h3></div><p>{project.intro}</p><div className="detail-grid"><div><span>面向毕业年份</span><strong>{project.graduationYears.map((year) => `${year}届`).join("、")}</strong></div><div><span>学历要求</span><strong>{project.degrees.join(" / ")}</strong></div><div><span>专业要求</span><strong>{project.originalMajors}</strong></div><div><span>标准专业标签</span><strong>{project.majors.length ? project.majors.join("、") : "不限专业"}</strong></div></div></section><section className="match-result"><div className="detail-title"><span>02</span><h3>你的专业匹配</h3></div><div className={`match-result-box ${match === "不限专业" ? "any" : ""}`}><span className="match-result-icon">✦</span><div><strong>{match}</strong><p>{match === "明确匹配" ? "你的专业出现在招聘标准专业标签中。" : match === "不限专业" ? "该项目未限制专业，值得直接查看具体岗位。" : "根据专业大类和招聘原文整理，仅供筛选参考。"}</p></div></div><small className="match-disclaimer">专业匹配结果仅供信息筛选参考，是否符合报名条件请以招聘单位官方审核结果为准。</small></section><section><div className="detail-title"><span>03</span><h3>我的跟进</h3></div><div className="tracker-editor"><select value={tracker?.status ?? "暂未处理"} onChange={(event) => onUpdateTracker(event.target.value as ApplicationStatus)} aria-label="报名状态"><option>暂未处理</option><option>准备报名</option><option>已报名</option><option>已完成测评</option><option>已参加笔试</option><option>已进入面试</option><option>已结束</option></select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="添加一条个人备注，例如：周日前完成网申" /><button onClick={() => { onUpdateTracker(tracker?.status ?? "准备报名", note); onNotify("个人备注已保存"); }}>保存备注</button></div></section></div><div className="modal-footer"><div><span>来源：{project.sourceName}</span><span>最近核验：{formatDate(project.verifiedAt)}</span></div><div className="modal-actions"><button className="text-button correction-button" onClick={onOpenCorrection}>提交纠错</button><button className={`secondary-button favorite-action ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite}>{isFavorite ? "♥ 已收藏" : "♡ 收藏项目"}</button><button className="primary-button" onClick={onOpenExternal}>前往官方报名 <span>↗</span></button></div></div></div></div>;
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="login-mark">⌁</div><h2>欢迎回到校招雷达</h2><p>登录后收藏招聘项目，设置属于你的提醒。</p><div className="login-tabs"><button className={mode === "email" ? "active" : ""} onClick={() => setMode("email")}>邮箱登录</button><button className={mode === "phone" ? "active" : ""} onClick={() => setMode("phone")}>手机号登录</button></div>{mode === "email" ? <><label className="login-field"><span>邮箱</span><input placeholder="name@example.com" type="email" /></label><label className="login-field"><span>密码</span><input placeholder="请输入密码" type="password" /></label></> : <><label className="login-field"><span>手机号</span><input placeholder="请输入手机号" /></label><label className="login-field"><span>验证码</span><div className="code-input"><input placeholder="6位验证码" /><button>获取验证码</button></div></label></>}<button className="primary-button login-submit" onClick={onLogin}>登录并继续 <span>→</span></button><small className="login-terms">登录即代表你同意《用户协议》和《隐私政策》</small></div></div>;
}

function ProfileQuickPanel({ profile, onClose, onEdit, onLogout }: { profile: { name: string; major: string; degree: string; graduation: string }; onClose: () => void; onEdit: () => void; onLogout: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><aside className="quick-panel" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="quick-profile"><div className="profile-avatar-large">林</div><h3>{profile.name}</h3><p>{profile.major}</p><span>{profile.degree} · {profile.graduation}届</span></div><div className="quick-links"><button onClick={onEdit}><span>◎</span>编辑求职资料 <b>→</b></button><button onClick={onClose}><span>◌</span>提醒设置 <b>→</b></button><button onClick={onClose}><span>◫</span>隐私与账号 <b>→</b></button></div><button className="logout-button" onClick={onLogout}>退出当前演示账号</button></aside></div>;
}
