#!/usr/bin/env python3
"""Parse the official Chinese higher-education directories into versioned JSON.

The source PDFs are intentionally passed in by the operator. This keeps the
import auditable and avoids silently fetching a changing third-party copy.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

import pdfplumber


UNDERGRAD_SOURCE = {
    "directoryType": "undergraduate",
    "educationLevel": "undergraduate",
    "version": "2026",
    "title": "普通高等学校本科专业目录（2026年）",
    "publisher": "教育部",
    "sourceUrl": "https://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/W020260427440749576927.pdf",
    "noticeUrl": "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202604/t20260428_1435016.html",
    "effectiveFrom": "2026-04-07",
}

GRADUATE_SOURCE = {
    "directoryType": "graduate",
    "educationLevel": "graduate",
    "version": "2022",
    "title": "研究生教育学科专业目录（2022年）",
    "publisher": "国务院学位委员会、教育部",
    "sourceUrl": "https://www.moe.gov.cn/srcsite/a22/moe_833/202209/w020220914572994461110.pdf",
    "noticeUrl": "https://www.moe.gov.cn/srcsite/A22/moe_833/202209/t20220914_660828.html",
    "effectiveFrom": "2023-01-01",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def split_note(name: str) -> tuple[str, str | None]:
    name = clean_text(name)
    marker = "（注："
    if marker not in name:
        return name.replace("*", "").strip(), None
    title, note = name.split(marker, 1)
    return title.strip().replace("*", "").strip(), f"注：{note.rstrip('）').strip()}"


def parse_undergraduate(path: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    discipline: tuple[str, str] | None = None
    category: tuple[str, str] | None = None
    current: dict[str, Any] | None = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(layout=True) or ""
            for raw_line in text.splitlines():
                line = clean_text(raw_line)
                if not line or re.fullmatch(r"—\s*\d+\s*—", line):
                    continue

                match = re.match(r"^(\d{2})\s+学科门类：(.+)$", line)
                if match:
                    discipline = (match.group(1), clean_text(match.group(2)))
                    category = None
                    current = None
                    continue

                match = re.match(r"^(\d{4})\s+(.+)$", line)
                if match and match.group(1) != "2026":
                    category = (match.group(1), clean_text(match.group(2)))
                    current = None
                    continue

                match = re.match(r"^(\d{6,7}[TK]*)\s+(.+)$", line)
                if match:
                    code = match.group(1)
                    title, note = split_note(match.group(2))
                    if discipline is None:
                        raise ValueError(f"本科专业缺少学科门类: {code}")
                    current = {
                        "code": code,
                        "name": title,
                        "notes": note,
                        "disciplineCode": discipline[0],
                        "disciplineName": discipline[1],
                        "categoryCode": category[0] if category else None,
                        "categoryName": category[1] if category else discipline[1],
                        "educationLevel": "undergraduate",
                        "directoryVersion": "2026",
                        "isSpecial": code.endswith("T") or code.endswith("TK"),
                        "isNationalControl": code.endswith("K") or code.endswith("TK"),
                    }
                    items.append(current)
                    continue

                if current and not re.match(r"^\d", line):
                    continuation = clean_text(line)
                    current["name"] = clean_text(f"{current['name']}{continuation}")

    if len(items) != 883:
        raise ValueError(f"本科目录解析数量异常：期望 883，实际 {len(items)}")
    return items


def parse_graduate(path: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    discipline: tuple[str, str] | None = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(layout=True) or ""
            for raw_line in text.splitlines():
                line = clean_text(raw_line)
                if not line or re.fullmatch(r"—\s*\d+\s*—", line):
                    continue

                match = re.match(r"^(\d{2})\s+(.+)$", line)
                if match and not re.match(r"^\d{4}", line):
                    discipline = (match.group(1), clean_text(match.group(2)))
                    continue

                match = re.match(r"^(\d{4})\s+(.+)$", line)
                if match:
                    if discipline is None:
                        raise ValueError(f"研究生目录条目缺少学科门类: {line}")
                    raw_name = clean_text(match.group(2))
                    master_only = raw_name.endswith("*")
                    title, note = split_note(raw_name)
                    items.append(
                        {
                            "code": match.group(1),
                            "name": title,
                            "notes": note,
                            "disciplineCode": discipline[0],
                            "disciplineName": discipline[1],
                            "educationLevel": "graduate",
                            "directoryVersion": "2022",
                            "entryType": "professional_degree" if match.group(1)[2] == "5" else "discipline",
                            "isMasterOnly": master_only,
                        }
                    )

    if len(items) != 181:
        raise ValueError(f"研究生目录解析数量异常：期望 181，实际 {len(items)}")
    return items


def write_directory(output_dir: Path, metadata: dict[str, Any], items: list[dict[str, Any]], source_pdf: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        **metadata,
        "importedAt": date.today().isoformat(),
        "sourceFileName": source_pdf.name,
        "itemCount": len(items),
        "items": items,
    }
    output = output_dir / f"{metadata['directoryType']}-{metadata['version']}.json"
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{output}: {len(items)} 条")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--undergraduate-pdf", type=Path, required=True)
    parser.add_argument("--graduate-pdf", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data/major-directory"))
    args = parser.parse_args()
    write_directory(args.output_dir, UNDERGRAD_SOURCE, parse_undergraduate(args.undergraduate_pdf), args.undergraduate_pdf)
    write_directory(args.output_dir, GRADUATE_SOURCE, parse_graduate(args.graduate_pdf), args.graduate_pdf)


if __name__ == "__main__":
    main()
