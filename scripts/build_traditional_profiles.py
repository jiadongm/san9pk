#!/usr/bin/env python3
"""Create verified traditional-name and biography profiles for the website."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path

import openpyxl


# OpenCC's standard conversion deliberately preserves or uses a few forms that
# differ from the game's verified simplified editor list. These entries were
# reviewed against the two supplied 650-officer sources.
GAME_NAME_OVERRIDES = {
    "李丰（魏）": "李丰", "乐𬘭": "乐綝", "张郃（魏）": "张合", "张颖": "张颍",
    "孟炅": "毛炅", "杨谡": "杨稷", "司马伷": "司马侑", "荀勗": "荀勖",
    "荀𫖮": "荀顗", "冯𬘘": "冯紞", "王濬": "王浚", "王沈": "王沉",
    "孔伷": "孔侑", "潘濬": "潘浚", "冷苞": "泠苞", "庞义": "庞羲",
    "马忠（蜀）": "马忠", "李丰（蜀）": "李丰", "寗随": "甯随", "刘璇": "刘璿",
    "郤正": "郄正", "朱俊": "朱儁", "孙𬘭": "孙綝", "孙钦": "孙歆",
    "陶濬": "陶浚", "步隲": "步骘", "孙𩅦（雨下单）": "孙潬", "沈莹": "沉莹",
    "马忠（吴）": "马忠", "袁燿": "袁耀", "张扬": "张杨",
}


def read_character_dictionary(path: Path) -> dict[str, str]:
    mapping = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        traditional, simplified = line.split("\t", maxsplit=1)
        mapping[traditional] = simplified.split()[0]
    return mapping


def convert_name(value: str, character_map: dict[str, str]) -> str:
    converted = "".join(character_map.get(character, character) for character in value)
    return GAME_NAME_OVERRIDES.get(converted, converted)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", required=True, type=Path)
    parser.add_argument("--core-csv", required=True, type=Path)
    parser.add_argument("--character-dictionary", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    character_map = read_character_dictionary(args.character_dictionary)
    with args.core_csv.open(encoding="utf-8-sig", newline="") as handle:
        core = list(csv.DictReader(handle))
    if len(core) != 650:
        raise ValueError(f"Expected 650 core officers, found {len(core)}.")

    core_by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    for officer in core:
        core_by_name[officer["name_simplified"]].append(officer)

    workbook = openpyxl.load_workbook(args.workbook, data_only=True, read_only=True)
    sheet = workbook["相性與小傳"]
    profiles = []
    used_slot_ids = set()
    for affinity, traditional_name, biography in sheet.iter_rows(min_row=7, max_col=3, values_only=True):
        if not isinstance(affinity, int) or not isinstance(traditional_name, str) or not isinstance(biography, str):
            raise ValueError("Unexpected traditional-profile workbook row.")
        simplified_name = convert_name(traditional_name, character_map)
        candidates = core_by_name[simplified_name]
        affinity_matches = [item for item in candidates if int(item["affinity"]) == affinity]
        if len(candidates) == 1:
            officer = candidates[0]
        elif len(affinity_matches) == 1:
            officer = affinity_matches[0]
        else:
            raise ValueError(f"Could not uniquely match {traditional_name} ({simplified_name}, affinity {affinity}).")
        slot_id = int(officer["slot_id"])
        if slot_id in used_slot_ids:
            raise ValueError(f"Duplicate profile match for slot {slot_id}: {traditional_name}.")
        used_slot_ids.add(slot_id)
        profiles.append({
            "slot_id": slot_id,
            "name_simplified": officer["name_simplified"],
            "name_traditional": traditional_name,
            "biography": biography,
            "source_affinity": affinity,
        })
    if len(profiles) != 650 or len(used_slot_ids) != 650:
        raise ValueError("Traditional profiles must match each of the 650 officers exactly once.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["slot_id", "name_simplified", "name_traditional", "biography", "source_affinity"])
        writer.writeheader()
        writer.writerows(sorted(profiles, key=lambda item: item["slot_id"]))
    print(f"Wrote {len(profiles)} traditional officer profiles to {args.output}")


if __name__ == "__main__":
    main()
