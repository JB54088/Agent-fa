import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "school-recruitment-radar",
    mode: "curated-public-data",
    message: "公开招聘数据服务正常；正式数据需经过来源核验和管理员审核。",
  });
}
