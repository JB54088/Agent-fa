import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "school-recruitment-radar",
    mode: "demo",
    message: "演示数据服务正常。真实数据库与认证接口按 docs/product-design.md 接入。",
  });
}
