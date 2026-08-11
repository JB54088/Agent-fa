export type ViewKey = "health" | "diagnosis" | "root-cause" | "lineage" | "remediation" | "rules";

export type IssueType = "字段缺失" | "重复主体" | "跨系统数据冲突" | "字段异常" | "数据关联一致性异常";
export type RiskLevel = "高" | "中" | "低";
export type IssueStatus = "待诊断" | "分析中" | "待确认" | "整改中" | "待复检" | "已解决";
export type WorkOrderStatus = "待确认" | "整改中" | "待复检" | "已关闭";

export type DataAsset = {
  id: string;
  tableName: string;
  name: string;
  description: string;
  domain: string;
  recordCount: string;
  ownerDepartment: string;
  updateTime: string;
  healthScore: number;
  issueCount: number;
  sourceSystem: string;
};

export type QualityIssue = {
  id: string;
  tableName: string;
  tableLabel: string;
  field: string;
  fieldLabel: string;
  issueType: IssueType;
  risk: RiskLevel;
  confidence: number;
  foundAt: string;
  status: IssueStatus;
  description: string;
  sampleValue: string;
  systems: string[];
  rootCause?: string;
  impactSummary?: string;
};

export type LineageNode = {
  id: string;
  label: string;
  subLabel: string;
  type: "system" | "table" | "job" | "api" | "application";
  status: "healthy" | "warning" | "error";
  column: number;
  row: number;
  metadata: {
    owner: string;
    updateTime: string;
    recordCount: string;
    description: string;
  };
};

export type WorkOrder = {
  id: string;
  issueId: string;
  title: string;
  department: string;
  owner: string;
  priority: "P0" | "P1" | "P2";
  status: WorkOrderStatus;
  aiSuggestion: string;
  recheckResult: string;
  dueDate: string;
};

export const dataAssets: DataAsset[] = [
  { id: "asset-01", tableName: "enterprise_basic_info", name: "企业基本信息表", description: "承载企业主体基本登记信息与统一识别信息。", domain: "企业主体", recordCount: "126.3万", ownerDepartment: "省市场监管数据中心", updateTime: "2026-08-11 09:20", healthScore: 83, issueCount: 21, sourceSystem: "企业登记源系统" },
  { id: "asset-02", tableName: "legal_person_info", name: "法人信息表", description: "记录企业法定代表人、任职与证件关联信息。", domain: "企业主体", recordCount: "126.3万", ownerDepartment: "省市场监管数据中心", updateTime: "2026-08-11 09:16", healthScore: 91, issueCount: 8, sourceSystem: "企业登记源系统" },
  { id: "asset-03", tableName: "enterprise_registered_address", name: "企业注册地址表", description: "记录企业登记地址、行政区划与标准地址编码。", domain: "企业主体", recordCount: "125.9万", ownerDepartment: "省政务数据管理局", updateTime: "2026-08-11 08:45", healthScore: 78, issueCount: 17, sourceSystem: "地址标准化服务" },
  { id: "asset-04", tableName: "unified_social_credit_code", name: "统一社会信用代码表", description: "提供企业主体唯一标识及证照状态映射。", domain: "企业主体", recordCount: "126.4万", ownerDepartment: "省市场监管数据中心", updateTime: "2026-08-11 09:18", healthScore: 95, issueCount: 5, sourceSystem: "统一认证平台" },
  { id: "asset-05", tableName: "enterprise_change_record", name: "企业变更记录表", description: "记录企业名称、住所、法人及经营状态等变更事件。", domain: "企业变更", recordCount: "982.5万", ownerDepartment: "省市场监管数据中心", updateTime: "2026-08-11 07:58", healthScore: 76, issueCount: 26, sourceSystem: "企业登记源系统" },
  { id: "asset-06", tableName: "enterprise_operation_status", name: "企业经营状态表", description: "沉淀企业存续、注销、吊销等经营状态。", domain: "企业主体", recordCount: "126.3万", ownerDepartment: "省政务数据管理局", updateTime: "2026-08-10 23:41", healthScore: 68, issueCount: 31, sourceSystem: "企业登记源系统" },
  { id: "asset-07", tableName: "enterprise_relationship", name: "企业关联关系表", description: "记录企业与法人、股东、分支机构之间的关联关系。", domain: "关联关系", recordCount: "438.7万", ownerDepartment: "省政务数据管理局", updateTime: "2026-08-11 08:32", healthScore: 72, issueCount: 19, sourceSystem: "企业关系图谱" },
  { id: "asset-08", tableName: "enterprise_master_data", name: "企业主数据表", description: "向查询、画像、风险分析等下游应用提供统一企业主数据。", domain: "主数据", recordCount: "126.3万", ownerDepartment: "省大数据运营中心", updateTime: "2026-08-10 22:12", healthScore: 64, issueCount: 34, sourceSystem: "企业主数据平台" },
];

function makeIssue(input: {
  id: string;
  tableName: string;
  tableLabel: string;
  field: string;
  fieldLabel: string;
  issueType: IssueType;
  risk: RiskLevel;
  confidence: number;
  foundAt: string;
  description: string;
  sampleValue: string;
  systems?: string[];
  status?: IssueStatus;
  rootCause?: string;
  impactSummary?: string;
}): QualityIssue {
  return {
    ...input,
    systems: input.systems ?? ["企业基础库", "企业主数据"],
    status: input.status ?? "待诊断",
  };
}

export const qualityIssues: QualityIssue[] = [
  makeIssue({ id: "Q-2026-0001", tableName: "enterprise_operation_status", tableLabel: "企业经营状态表", field: "operation_status", fieldLabel: "经营状态", issueType: "跨系统数据冲突", risk: "高", confidence: 92, foundAt: "2026-08-11 09:24", description: "同一企业主体在三个业务系统中返回不同经营状态。", sampleValue: "系统 A：正常经营 / 系统 B：已注销 / 系统 C：正常经营", systems: ["企业登记源系统", "企业主数据", "企业画像"], rootCause: "权威源系统于 2026-07-18 更新经营状态，但下游 ETL 增量同步任务执行失败，企业主数据系统未同步最新状态。", impactSummary: "影响 4 张下游数据表、2 个数据服务 API、1 个企业画像应用。" }),
  makeIssue({ id: "Q-2026-0002", tableName: "enterprise_master_data", tableLabel: "企业主数据表", field: "enterprise_name", fieldLabel: "企业名称", issueType: "重复主体", risk: "高", confidence: 97, foundAt: "2026-08-11 09:07", description: "同一统一社会信用代码对应两条企业主数据记录，名称仅存在简称差异。", sampleValue: "福建海峡数字科技有限公司 / 福建海峡数字科技（集团）有限公司", systems: ["企业主数据", "企业关系图谱"] }),
  makeIssue({ id: "Q-2026-0003", tableName: "enterprise_basic_info", tableLabel: "企业基本信息表", field: "registered_capital", fieldLabel: "注册资本", issueType: "字段异常", risk: "中", confidence: 89, foundAt: "2026-08-11 08:52", description: "注册资本金额较历史记录增长 120 倍，超过同类企业变更阈值。", sampleValue: "历史：500 万元 / 当前：6 亿元", systems: ["企业登记源系统", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0004", tableName: "legal_person_info", tableLabel: "法人信息表", field: "legal_person_name", fieldLabel: "法定代表人姓名", issueType: "字段缺失", risk: "高", confidence: 99, foundAt: "2026-08-11 08:44", description: "法人信息表中 3,812 条企业记录缺少法定代表人姓名。", sampleValue: "legal_person_name = NULL", systems: ["企业登记源系统", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0005", tableName: "enterprise_relationship", tableLabel: "企业关联关系表", field: "shareholder_code", fieldLabel: "股东统一社会信用代码", issueType: "数据关联一致性异常", risk: "高", confidence: 94, foundAt: "2026-08-11 08:31", description: "关联关系中的股东统一社会信用代码在统一社会信用代码表中无法匹配。", sampleValue: "91350100MA8X7K2P4Q → 未找到主体", systems: ["企业关系图谱", "统一认证平台"] }),
  makeIssue({ id: "Q-2026-0006", tableName: "enterprise_registered_address", tableLabel: "企业注册地址表", field: "district_code", fieldLabel: "行政区划代码", issueType: "字段异常", risk: "中", confidence: 91, foundAt: "2026-08-11 08:12", description: "地址文本对应的行政区划代码已失效，疑似沿用旧区划编码。", sampleValue: "350102（鼓楼区旧编码）", systems: ["地址标准化服务", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0007", tableName: "enterprise_change_record", tableLabel: "企业变更记录表", field: "change_effective_date", fieldLabel: "变更生效日期", issueType: "字段缺失", risk: "中", confidence: 96, foundAt: "2026-08-11 07:55", description: "近一周接入的企业变更事件缺少变更生效日期。", sampleValue: "2026-08-10 录入的 1,204 条记录为空", systems: ["企业登记源系统", "企业变更记录"] }),
  makeIssue({ id: "Q-2026-0008", tableName: "enterprise_operation_status", tableLabel: "企业经营状态表", field: "status_code", fieldLabel: "经营状态编码", issueType: "跨系统数据冲突", risk: "中", confidence: 88, foundAt: "2026-08-10 22:41", description: "源系统状态编码与主数据平台枚举映射不一致。", sampleValue: "源系统：注销 / 主数据：吊销", systems: ["企业登记源系统", "企业主数据"] }),
  makeIssue({ id: "Q-2026-0009", tableName: "enterprise_basic_info", tableLabel: "企业基本信息表", field: "establishment_date", fieldLabel: "成立日期", issueType: "字段异常", risk: "低", confidence: 86, foundAt: "2026-08-10 21:18", description: "成立日期晚于最近一次企业名称变更日期。", sampleValue: "成立日期：2026-05-02 / 变更日期：2026-03-16", systems: ["企业基础库", "企业变更记录"] }),
  makeIssue({ id: "Q-2026-0010", tableName: "enterprise_master_data", tableLabel: "企业主数据表", field: "unified_credit_code", fieldLabel: "统一社会信用代码", issueType: "重复主体", risk: "高", confidence: 98, foundAt: "2026-08-10 20:37", description: "统一社会信用代码去空格后出现重复主键。", sampleValue: "91350100MA2Y4R8F8D 与 91350100 MA2Y4R8F8D", systems: ["企业主数据", "统一认证平台"] }),
  makeIssue({ id: "Q-2026-0011", tableName: "enterprise_relationship", tableLabel: "企业关联关系表", field: "relationship_type", fieldLabel: "关联关系类型", issueType: "字段缺失", risk: "中", confidence: 90, foundAt: "2026-08-10 19:54", description: "部分历史关联关系只有两端主体，没有关系类型。", sampleValue: "relationship_type = NULL", systems: ["企业关系图谱", "企业主数据"] }),
  makeIssue({ id: "Q-2026-0012", tableName: "enterprise_registered_address", tableLabel: "企业注册地址表", field: "address_text", fieldLabel: "注册地址文本", issueType: "字段缺失", risk: "高", confidence: 99, foundAt: "2026-08-10 18:22", description: "注册地址表存在企业主体编码，但地址文本为空。", sampleValue: "enterprise_id=3501000001842 / address_text=NULL", systems: ["地址标准化服务", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0013", tableName: "enterprise_basic_info", tableLabel: "企业基本信息表", field: "enterprise_name", fieldLabel: "企业名称", issueType: "跨系统数据冲突", risk: "中", confidence: 87, foundAt: "2026-08-10 17:15", description: "企业名称在登记源与企业画像中的更新时间相差超过 48 小时。", sampleValue: "源系统：福建清源环保科技有限公司 / 画像：福建清源环保有限公司", systems: ["企业登记源系统", "企业画像"] }),
  makeIssue({ id: "Q-2026-0014", tableName: "enterprise_change_record", tableLabel: "企业变更记录表", field: "change_type", fieldLabel: "变更事项类型", issueType: "字段异常", risk: "低", confidence: 84, foundAt: "2026-08-10 16:43", description: "变更事项类型出现未注册的历史枚举值。", sampleValue: "change_type=法人信息调整", systems: ["企业变更记录", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0015", tableName: "enterprise_master_data", tableLabel: "企业主数据表", field: "registered_address_id", fieldLabel: "注册地址主键", issueType: "数据关联一致性异常", risk: "中", confidence: 95, foundAt: "2026-08-10 15:28", description: "企业主数据中的注册地址主键在注册地址表中不存在。", sampleValue: "address_id=ADDR-201910-8842 → 未找到记录", systems: ["企业主数据", "企业注册地址表"] }),
  makeIssue({ id: "Q-2026-0016", tableName: "legal_person_info", tableLabel: "法人信息表", field: "id_card_type", fieldLabel: "证件类型", issueType: "字段缺失", risk: "中", confidence: 93, foundAt: "2026-08-10 14:46", description: "法人姓名已入库，但证件类型在迁移批次中未补齐。", sampleValue: "id_card_type=NULL / legal_person_name=林某某", systems: ["企业登记源系统", "法人信息表"] }),
  makeIssue({ id: "Q-2026-0017", tableName: "enterprise_operation_status", tableLabel: "企业经营状态表", field: "status_update_time", fieldLabel: "状态更新时间", issueType: "字段异常", risk: "中", confidence: 92, foundAt: "2026-08-10 13:39", description: "状态更新时间早于源系统事件时间，存在时钟或同步延迟。", sampleValue: "源事件：2026-08-09 20:16 / 主数据：2026-08-08 23:50", systems: ["企业登记源系统", "企业主数据"] }),
  makeIssue({ id: "Q-2026-0018", tableName: "enterprise_relationship", tableLabel: "企业关联关系表", field: "enterprise_id", fieldLabel: "企业主体编码", issueType: "数据关联一致性异常", risk: "高", confidence: 96, foundAt: "2026-08-10 12:18", description: "关系表中的企业主体编码指向已归档主体，未完成主键迁移。", sampleValue: "enterprise_id=3501000000678 → 主体已归档", systems: ["企业关系图谱", "企业主数据"] }),
  makeIssue({ id: "Q-2026-0019", tableName: "enterprise_basic_info", tableLabel: "企业基本信息表", field: "registered_capital_currency", fieldLabel: "注册资本币种", issueType: "字段缺失", risk: "低", confidence: 85, foundAt: "2026-08-10 11:02", description: "部分注册资本记录没有明确币种，无法参与跨境主体统计。", sampleValue: "registered_capital_currency=NULL", systems: ["企业登记源系统", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0020", tableName: "enterprise_operation_status", tableLabel: "企业经营状态表", field: "operation_status", fieldLabel: "经营状态", issueType: "跨系统数据冲突", risk: "高", confidence: 90, foundAt: "2026-08-10 10:26", description: "企业主数据为存续，风险分析服务读取为吊销。", sampleValue: "主数据：正常经营 / 风险分析 API：吊销", systems: ["企业主数据", "风险分析 API"] }),
  makeIssue({ id: "Q-2026-0021", tableName: "enterprise_master_data", tableLabel: "企业主数据表", field: "enterprise_name_pinyin", fieldLabel: "企业名称拼音", issueType: "字段异常", risk: "低", confidence: 82, foundAt: "2026-08-10 09:17", description: "拼音字段包含全角标点，导致检索分词命中率下降。", sampleValue: "FU JIAN  ·  QING YUAN", systems: ["企业主数据", "企业查询 API"] }),
  makeIssue({ id: "Q-2026-0022", tableName: "enterprise_change_record", tableLabel: "企业变更记录表", field: "source_event_id", fieldLabel: "源事件编号", issueType: "重复主体", risk: "中", confidence: 94, foundAt: "2026-08-09 18:36", description: "同一源事件编号被重复写入两次，可能触发重复变更。", sampleValue: "EVT-20260809-004271 出现 2 次", systems: ["企业登记源系统", "企业变更记录"] }),
  makeIssue({ id: "Q-2026-0023", tableName: "enterprise_registered_address", tableLabel: "企业注册地址表", field: "postal_code", fieldLabel: "邮政编码", issueType: "字段异常", risk: "低", confidence: 79, foundAt: "2026-08-09 16:48", description: "地址所在行政区与邮政编码前缀不一致。", sampleValue: "福州市仓山区 / 350100", systems: ["地址标准化服务", "企业基础库"] }),
  makeIssue({ id: "Q-2026-0024", tableName: "legal_person_info", tableLabel: "法人信息表", field: "legal_person_code", fieldLabel: "法人主体编码", issueType: "数据关联一致性异常", risk: "中", confidence: 91, foundAt: "2026-08-09 15:10", description: "法人主体编码无法在企业主数据中解析为有效自然人主体。", sampleValue: "LP-350100-008421 → 未找到主体", systems: ["法人信息表", "企业主数据"] }),
  makeIssue({ id: "Q-2026-0025", tableName: "enterprise_basic_info", tableLabel: "企业基本信息表", field: "enterprise_nature", fieldLabel: "企业性质", issueType: "跨系统数据冲突", risk: "中", confidence: 88, foundAt: "2026-08-09 13:24", description: "企业性质在基础库与统计主题库中使用了不同枚举。", sampleValue: "基础库：国有控股 / 统计库：国有企业", systems: ["企业基础库", "企业画像"] }),
  makeIssue({ id: "Q-2026-0026", tableName: "enterprise_operation_status", tableLabel: "企业经营状态表", field: "operation_status", fieldLabel: "经营状态", issueType: "字段缺失", risk: "高", confidence: 98, foundAt: "2026-08-09 11:06", description: "增量补数批次中存在企业主体编码，但经营状态为空。", sampleValue: "1,086 条记录 operation_status=NULL", systems: ["企业登记源系统", "企业主数据"] }),
  makeIssue({ id: "Q-2026-0027", tableName: "enterprise_relationship", tableLabel: "企业关联关系表", field: "share_ratio", fieldLabel: "持股比例", issueType: "字段异常", risk: "中", confidence: 89, foundAt: "2026-08-09 09:42", description: "持股比例超出 0-100% 业务约束。", sampleValue: "share_ratio=120.00", systems: ["企业关系图谱", "风险分析 API"] }),
  makeIssue({ id: "Q-2026-0028", tableName: "enterprise_master_data", tableLabel: "企业主数据表", field: "parent_enterprise_id", fieldLabel: "上级主体编码", issueType: "数据关联一致性异常", risk: "中", confidence: 93, foundAt: "2026-08-08 17:19", description: "集团层级关系出现自关联，影响企业集团画像。", sampleValue: "enterprise_id=3501000002217 / parent_id=3501000002217", systems: ["企业主数据", "企业关系图谱"] }),
  makeIssue({ id: "Q-2026-0029", tableName: "enterprise_change_record", tableLabel: "企业变更记录表", field: "operator_name", fieldLabel: "变更操作人", issueType: "字段缺失", risk: "低", confidence: 86, foundAt: "2026-08-08 15:48", description: "部分历史变更记录没有保留源系统操作人。", sampleValue: "operator_name=NULL / event_source=历史迁移", systems: ["企业变更记录", "企业登记源系统"] }),
  makeIssue({ id: "Q-2026-0030", tableName: "enterprise_basic_info", tableLabel: "企业基本信息表", field: "credit_code", fieldLabel: "统一社会信用代码", issueType: "重复主体", risk: "高", confidence: 99, foundAt: "2026-08-08 13:12", description: "企业基本信息表存在一组主体编码与统一社会信用代码一对多映射。", sampleValue: "91350100MA2K7X6P1A → 2 条主体记录", systems: ["企业基础库", "统一认证平台"] }),
];

export const trendData = [
  { label: "07-15", score: 65, issues: 168 },
  { label: "07-18", score: 67, issues: 154 },
  { label: "07-21", score: 68, issues: 151 },
  { label: "07-24", score: 69, issues: 146 },
  { label: "07-27", score: 70, issues: 142 },
  { label: "07-30", score: 71, issues: 139 },
  { label: "08-02", score: 71, issues: 138 },
  { label: "08-05", score: 72, issues: 137 },
  { label: "08-08", score: 72, issues: 137 },
  { label: "08-11", score: 72, issues: 137 },
];

export const issueTypeDistribution: Array<{ label: string; value: number; tone: string; type?: IssueType }> = [
  { label: "跨系统冲突", value: 31, tone: "teal", type: "跨系统数据冲突" },
  { label: "重复主体", value: 26, tone: "orange", type: "重复主体" },
  { label: "字段异常", value: 62, tone: "purple", type: "字段异常" },
  { label: "其他", value: 18, tone: "slate" },
];

export const riskDistribution = [
  { label: "高风险", value: 18, tone: "danger" },
  { label: "中风险", value: 54, tone: "warning" },
  { label: "低风险", value: 65, tone: "safe" },
];

export const lineageNodes: LineageNode[] = [
  { id: "source-registration", label: "企业登记源系统", subLabel: "权威源 · 系统", type: "system", status: "healthy", column: 1, row: 2, metadata: { owner: "省市场监管数据中心", updateTime: "2026-08-11 09:18", recordCount: "126.4万", description: "企业注册、变更、经营状态的权威来源。" } },
  { id: "source-change", label: "企业变更事件流", subLabel: "Kafka Topic · 数据流", type: "job", status: "warning", column: 1, row: 4, metadata: { owner: "省市场监管数据中心", updateTime: "2026-08-11 07:58", recordCount: "982.5万", description: "承载企业名称、法人、经营状态等变更事件。" } },
  { id: "base-enterprise", label: "企业基础库", subLabel: "enterprise_basic_info", type: "table", status: "healthy", column: 2, row: 2, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 09:20", recordCount: "126.3万", description: "企业主体基础信息标准化存储。" } },
  { id: "base-status", label: "经营状态主题库", subLabel: "enterprise_operation_status", type: "table", status: "error", column: 2, row: 4, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-10 23:41", recordCount: "126.3万", description: "存储企业存续、注销、吊销等经营状态。" } },
  { id: "etl-increment", label: "ETL 增量同步任务", subLabel: "job · 每 30 分钟", type: "job", status: "error", column: 3, row: 4, metadata: { owner: "省大数据运营中心", updateTime: "2026-07-18 02:30", recordCount: "失败 1 次", description: "负责将经营状态变更同步至企业主数据。" } },
  { id: "master-data", label: "企业主数据", subLabel: "enterprise_master_data", type: "table", status: "error", column: 3, row: 2, metadata: { owner: "省大数据运营中心", updateTime: "2026-07-17 23:56", recordCount: "126.3万", description: "向下游数据服务提供统一企业主体信息。" } },
  { id: "quality-job", label: "数据质量校验任务", subLabel: "rule engine · 137 个问题", type: "job", status: "warning", column: 3, row: 6, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 09:24", recordCount: "规则 286 条", description: "按字段、跨表、跨系统规则执行质量校验。" } },
  { id: "query-api", label: "企业查询 API", subLabel: "service · v3.6", type: "api", status: "warning", column: 4, row: 1, metadata: { owner: "省大数据运营中心", updateTime: "2026-08-11 08:57", recordCount: "日均 42.6 万次", description: "为政务服务与企业查询场景提供主体查询。" } },
  { id: "risk-api", label: "风险分析 API", subLabel: "service · v2.9", type: "api", status: "warning", column: 4, row: 3, metadata: { owner: "省大数据运营中心", updateTime: "2026-08-11 08:45", recordCount: "日均 8.4 万次", description: "为风险识别服务提供企业经营状态与关联关系。" } },
  { id: "portrait-app", label: "企业画像应用", subLabel: "application · 政企版", type: "application", status: "warning", column: 5, row: 2, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 08:42", recordCount: "活跃用户 1,284", description: "面向业务人员的企业画像与综合研判应用。" } },
  { id: "relationship", label: "企业关系图谱", subLabel: "enterprise_relationship", type: "table", status: "warning", column: 2, row: 7, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 08:32", recordCount: "438.7万", description: "沉淀企业、法人、股东、分支机构关联关系。" } },
  { id: "address", label: "地址标准化服务", subLabel: "service · v1.8", type: "api", status: "healthy", column: 2, row: 9, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 08:45", recordCount: "日均 16.2 万次", description: "将原始地址映射至标准行政区划与地址编码。" } },
  { id: "search-index", label: "主体检索索引", subLabel: "ElasticSearch · index", type: "table", status: "healthy", column: 4, row: 7, metadata: { owner: "省大数据运营中心", updateTime: "2026-08-11 09:02", recordCount: "126.3万", description: "为企业名称、信用代码检索提供索引。" } },
  { id: "risk-app", label: "重点企业风险看板", subLabel: "application · 风险监测", type: "application", status: "warning", column: 5, row: 5, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 08:36", recordCount: "监测主体 18.6万", description: "展示重点企业风险与经营状态变化。" } },
  { id: "archive", label: "历史归档库", subLabel: "archive · cold storage", type: "table", status: "healthy", column: 1, row: 8, metadata: { owner: "省大数据运营中心", updateTime: "2026-08-01 03:10", recordCount: "4,286万", description: "保留企业主体历史版本与变更快照。" } },
  { id: "rule-center", label: "治理规则中心", subLabel: "rule catalog · 286 条", type: "job", status: "healthy", column: 4, row: 9, metadata: { owner: "省政务数据管理局", updateTime: "2026-08-11 08:10", recordCount: "启用 244 条", description: "统一管理字段、跨表、跨系统数据质量规则。" } },
];

export const workOrdersSeed: WorkOrder[] = [
  { id: "WO-2026-0118", issueId: "Q-2026-0007", title: "补齐企业变更生效日期并回溯校验", department: "省市场监管数据中心", owner: "王思远", priority: "P1", status: "待确认", aiSuggestion: "回查企业变更明细，补齐变更生效日期并重跑完整性规则。", recheckResult: "待复检", dueDate: "2026-08-12" },
  { id: "WO-2026-0117", issueId: "Q-2026-0002", title: "合并重复企业主体并保留主记录", department: "省政务数据管理局", owner: "林晓青", priority: "P0", status: "整改中", aiSuggestion: "以统一社会信用代码为主键，执行主体合并并刷新关系图谱。", recheckResult: "待复检", dueDate: "2026-08-13" },
  { id: "WO-2026-0116", issueId: "Q-2026-0005", title: "补齐股东主体映射并修复关系链路", department: "省政务数据管理局", owner: "郑宇航", priority: "P1", status: "整改中", aiSuggestion: "对未匹配股东编码回查统一认证平台，补建主体映射。", recheckResult: "待复检", dueDate: "2026-08-15" },
  { id: "WO-2026-0115", issueId: "Q-2026-0004", title: "补采法人姓名并校验主体完整性", department: "省市场监管数据中心", owner: "王思远", priority: "P1", status: "待复检", aiSuggestion: "回查法人登记明细，对缺失记录进行增量补采。", recheckResult: "完整性提升 2.8%", dueDate: "2026-08-11" },
  { id: "WO-2026-0114", issueId: "Q-2026-0012", title: "重新执行注册地址标准化任务", department: "省政务数据管理局", owner: "周宁", priority: "P1", status: "已关闭", aiSuggestion: "对地址文本为空的企业执行源数据回补与标准化。", recheckResult: "已通过", dueDate: "2026-08-10" },
  { id: "WO-2026-0113", issueId: "Q-2026-0008", title: "统一经营状态枚举映射配置", department: "省大数据运营中心", owner: "高鹏", priority: "P1", status: "已关闭", aiSuggestion: "将吊销、注销、存续等状态统一映射至主题域标准码表。", recheckResult: "已通过", dueDate: "2026-08-09" },
  { id: "WO-2026-0112", issueId: "Q-2026-0017", title: "核对状态更新时间与事件时间口径", department: "省市场监管数据中心", owner: "张晨", priority: "P2", status: "已关闭", aiSuggestion: "统一源事件时间与入库时间字段口径，增加时钟偏差监测。", recheckResult: "已通过", dueDate: "2026-08-08" },
  { id: "WO-2026-0111", issueId: "Q-2026-0022", title: "清理重复变更事件并增加幂等校验", department: "省市场监管数据中心", owner: "谢雨欣", priority: "P1", status: "已关闭", aiSuggestion: "以源事件编号与主体编码建立联合唯一约束。", recheckResult: "已通过", dueDate: "2026-08-07" },
  { id: "WO-2026-0110", issueId: "Q-2026-0027", title: "修复企业关系持股比例校验规则", department: "省政务数据管理局", owner: "叶文博", priority: "P2", status: "已关闭", aiSuggestion: "补充持股比例 0-100% 约束并回溯异常记录。", recheckResult: "已通过", dueDate: "2026-08-07" },
  { id: "WO-2026-0109", issueId: "Q-2026-0028", title: "修复集团主体自关联关系", department: "省大数据运营中心", owner: "许安琪", priority: "P1", status: "已关闭", aiSuggestion: "以主体层级规则校验自关联，并重新生成集团画像。", recheckResult: "已通过", dueDate: "2026-08-06" },
];

export const aiAnalysisSteps = [
  { label: "读取元数据", detail: "已获取企业经营状态表的字段定义、主键与更新时间。" },
  { label: "校验数据质量规则", detail: "已匹配跨系统一致性规则 Q-STATUS-004。" },
  { label: "分析上下游数据血缘", detail: "已定位 4 张下游表、2 个 API 与 1 个画像应用。" },
  { label: "对比历史异常", detail: "发现 2026-07-18 同步窗口存在一次 ETL 失败记录。" },
  { label: "检查数据更新时间", detail: "源系统更新时间领先企业主数据 17 小时 26 分。" },
  { label: "输出根因判断", detail: "已形成根因、影响范围与整改建议。" },
];

export const issueTypeOptions: Array<{ label: string; value?: IssueType }> = [
  { label: "全部问题" },
  { label: "跨系统冲突", value: "跨系统数据冲突" },
  { label: "重复主体", value: "重复主体" },
  { label: "字段异常", value: "字段异常" },
  { label: "字段缺失", value: "字段缺失" },
  { label: "关联一致性", value: "数据关联一致性异常" },
];
