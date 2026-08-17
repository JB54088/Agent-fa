"use client";

type OpportunityHubProps = {
  onBrowse: (scope: string) => void;
};

const activeTypes = [
  { icon: "↗", title: "秋招", copy: "提前批、正式批与补录", tone: "orange", scope: "秋招" },
  { icon: "◒", title: "春招", copy: "春季校招与补录机会", tone: "teal", scope: "春招" },
  { icon: "▦", title: "央企", copy: "中央企业校园招聘", tone: "blue", scope: "央企" },
  { icon: "⌂", title: "地方国企", copy: "地方国企与专项招聘", tone: "green", scope: "国企" },
  { icon: "✦", title: "大厂与科技", copy: "互联网、科技与知名企业", tone: "violet", scope: "大厂" },
];

const reservedTypes = [
  { icon: "◇", title: "国考", copy: "公告与职位表能力预留" },
  { icon: "⌁", title: "省考 / 选调", copy: "各省招录时间表预留" },
  { icon: "□", title: "事业单位", copy: "岗位表与资格条件预留" },
  { icon: "✧", title: "军队文职", copy: "官方招考信息预留" },
];

export default function OpportunityHub({ onBrowse }: OpportunityHubProps) {
  return (
    <section className="opportunity-hub">
      <div className="opportunity-hub-heading">
        <div><span className="section-kicker">OPPORTUNITY MAP</span><h2>按机会类型，找到你的下一步</h2><p>统一机会模型承载招聘、招录与考试项目；第一版先把校招主流程做深。</p></div>
        <button className="link-button" onClick={() => onBrowse("全部")}>查看全部机会 <span>→</span></button>
      </div>
      <div className="opportunity-type-grid">
        {activeTypes.map((item) => <button key={item.title} className="opportunity-type-card" onClick={() => onBrowse(item.scope)}><span className={`opportunity-type-icon ${item.tone}`}>{item.icon}</span><span><strong>{item.title}</strong><small>{item.copy}</small></span><b>→</b></button>)}
      </div>
      <div className="reserved-opportunities">
        <div className="reserved-heading"><span>扩展入口</span><small>国考、省考、事业单位和军队文职暂不生成虚假职位数据</small></div>
        <div className="reserved-type-list">{reservedTypes.map((item) => <span key={item.title} className="reserved-type"><i>{item.icon}</i><strong>{item.title}</strong><small>{item.copy}</small><em>即将开放</em></span>)}</div>
      </div>
    </section>
  );
}
