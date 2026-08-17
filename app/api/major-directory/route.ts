import { NextResponse } from "next/server";
import { officialMajorDirectories, searchMajorDirectory } from "../../major-directory";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const educationLevel = url.searchParams.get("educationLevel") === "graduate" ? "graduate" : "undergraduate";
  const version = url.searchParams.get("version");
  const directory = officialMajorDirectories.find((item) => item.educationLevel === educationLevel && (!version || item.version === version));

  if (!directory) {
    return NextResponse.json({ ok: false, error: "directory_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    directory: {
      type: directory.directoryType,
      version: directory.version,
      title: directory.title,
      publisher: directory.publisher,
      sourceUrl: directory.sourceUrl,
      noticeUrl: directory.noticeUrl,
      itemCount: directory.itemCount,
    },
    items: searchMajorDirectory(query, educationLevel),
  });
}
