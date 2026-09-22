#!/usr/bin/env python3
"""Build web-ready JSON from verified SAN9PK analysis CSV files."""

from __future__ import annotations

import argparse
import csv
import json
from itertools import combinations
from pathlib import Path
from typing import Any


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def number(value: str) -> int | float:
    return float(value) if "." in value else int(value)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", required=True, type=Path, help="Analysis project containing 03_validation/inspections")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    args = parser.parse_args()
    source = args.source_root / "03_validation" / "inspections"
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)

    core = read_csv(source / "phase1" / "officer_core_seed.csv")
    traditional_profiles = read_csv(Path(__file__).resolve().parents[1] / "data-source" / "officer-traditional-profiles.csv")
    biographies = read_csv(Path(__file__).resolve().parents[1] / "data-source" / "game-biographies.csv")
    availability = read_csv(source / "phase2" / "scenario_officer_availability.csv")
    first_available = read_csv(source / "phase2" / "historical_first_available_scenario.csv")
    factions = read_csv(source / "phase2" / "scenario_factions.csv")
    relationships = read_csv(source / "phase2" / "tactic_linkage_relationship_seed.csv")
    formations = read_csv(source / "phase3" / "formation_definitions.csv")
    recommendations = read_csv(source / "phase4" / "scenario_linkage_recommendations.csv")

    profiles_by_slot = {int(row["slot_id"]): row for row in traditional_profiles}
    biographies_by_slot = {int(row["slot_id"]): row for row in biographies}
    first_available_by_slot = {
        int(row["slot_id"]): {
            "year": int(row["first_observed_historical_year"]),
            "month": int(row["first_observed_historical_month"]),
            "scenarioId": row["first_observed_historical_scenario"],
        } if row["first_observed_historical_year"] else None
        for row in first_available
    }
    if len(traditional_profiles) != 650 or len(profiles_by_slot) != 650:
        raise ValueError("Traditional profiles must contain exactly 650 unique officer slots.")
    if len(biographies) != 650 or len(biographies_by_slot) != 650:
        raise ValueError("Game biographies must contain exactly 650 unique officer slots.")

    # These are reviewed display corrections keyed by immutable game slots.
    # Do not derive names by whole-string traditional/simplified conversion.
    display_name_overrides = {37: "王沈", 175: "孔伷", 284: "沈莹"}

    officers = [{
        "id": int(row["slot_id"]),
        "nameSimplified": display_name_overrides.get(int(row["slot_id"]), row["name_simplified"]),
        "nameTraditional": profiles_by_slot[int(row["slot_id"])]["name_traditional"],
        "searchAliases": list(dict.fromkeys([display_name_overrides.get(int(row["slot_id"]), row["name_simplified"]), row["name_simplified"], profiles_by_slot[int(row["slot_id"])]["name_traditional"]])),
        "biographyTraditional": biographies_by_slot[int(row["slot_id"])]["biography_traditional"],
        "abilities": {field: int(row[field]) for field in ("command", "strength", "intelligence", "politics")},
        "affinity": int(row["affinity"]),
        "tactics": row["tactics"].split("、") if row["tactics"] else [],
        "firstAvailable": first_available_by_slot.get(int(row["slot_id"])),
    } for row in core]
    officer_ids = {officer["id"] for officer in officers}
    officer_names_by_id = {officer["id"]: officer["nameSimplified"] for officer in officers}
    if len(officers) != 650 or len(officer_ids) != len(officers):
        raise ValueError("Officer IDs must contain exactly 650 unique records.")
    if any(profiles_by_slot[officer["id"]]["name_simplified"] != core[officer["id"]]["name_simplified"] for officer in officers):
        raise ValueError("Traditional profile names do not match the verified core officer list.")

    scenario_map: dict[str, dict[str, Any]] = {}
    availability_json = []
    for row in availability:
        scenario_map.setdefault(row["scenario_id"], {
            "id": row["scenario_id"], "year": int(row["scenario_year"]), "month": int(row["scenario_month"]),
            "title": row["scenario_title"], "dayRaw": int(row["scenario_day_raw"]),
        })
        availability_json.append({
            "scenarioId": row["scenario_id"], "officerId": int(row["slot_id"]), "statusCode": int(row["status_code_raw"]),
            "statusClass": row["status_class"], "presentAtStart": row["present_at_start"] == "1",
        })
    if len(scenario_map) != 20 or len(availability_json) != 14000:
        raise ValueError("Expected 20 scenarios and 14,000 scenario-officer availability records.")

    force_display_names = {175: "孔伷"}
    faction_json = [{
        "scenarioId": row["scenario_id"], "forceId": int(row["force_id"]),
        "leaderId": int(row["leader_slot_id"]), "leaderName": force_display_names.get(int(row["leader_slot_id"]), officer_names_by_id.get(int(row["leader_slot_id"]), row["leader_name"])),
        "capitalCityId": int(row["capital_city_id"]),
    } for row in factions]
    if len(faction_json) != 207:
        raise ValueError("Expected 207 validated scenario factions.")

    relationship_json = [{
        "officerIdA": int(row["slot_id_a"]), "nameA": officer_names_by_id.get(int(row["slot_id_a"]), row["name_a"]),
        "officerIdB": int(row["slot_id_b"]), "nameB": officer_names_by_id.get(int(row["slot_id_b"]), row["name_b"]),
        "type": row["relation_type"],
        "intimacyBonus": int(row["intimacy_bonus"]) if row["intimacy_bonus"] else None,
        "recommendation": row["recommendation"], "source": row["source"],
    } for row in relationships]
    negative_pairs = {frozenset((item["officerIdA"], item["officerIdB"])) for item in relationship_json if item["type"] == "negative"}

    formation_json = [{
        "id": int(row["formation_id"]), "nameSimplified": row["formation_simplified"],
        "environment": row["environment"], "role": row["role"], "tacticSystemHint": row["tactic_system_hint"],
        "rawValues": [int(row[f"raw_value_{index:02d}"]) for index in range(1, 9)], "recordHex": row["record_hex"],
    } for row in formations]

    availability_set = {(item["scenarioId"], item["officerId"]) for item in availability_json if item["presentAtStart"]}
    recommendation_json = []
    for row in recommendations:
        member_ids = [int(value) for value in row["slot_ids"].split("、")]
        if any(member_id not in officer_ids for member_id in member_ids):
            raise ValueError(f"Recommendation includes an unknown officer: {row['members']}")
        if any((row["scenario_id"], member_id) not in availability_set for member_id in member_ids):
            raise ValueError(f"Recommendation includes unavailable officer(s): {row['members']}")
        if any(frozenset(pair) in negative_pairs for pair in combinations(member_ids, 2)):
            raise ValueError(f"Recommendation includes a negative pair: {row['members']}")
        recommendation_json.append({
            "scenarioId": row["scenario_id"], "teamSize": int(row["team_size"]), "rank": int(row["rank"]),
            "forceId": int(row["force_id"]) if row["force_id"] else None,
            "forceLeaderId": int(row["force_leader_slot_id"]) if row["force_leader_slot_id"] else None,
            "forceLeaderName": force_display_names.get(int(row["force_leader_slot_id"]), officer_names_by_id[int(row["force_leader_slot_id"])]) if row["force_leader_slot_id"] else None,
            "candidatePoolSize": int(row["candidate_pool_size"]),
            "memberIds": member_ids, "members": [officer_names_by_id[member_id] for member_id in member_ids],
            "linkageScore": int(row["linkage_score"]), "meanPairScore": number(row["mean_pair_score"]),
            "minAffinityDistance": int(row["min_affinity_distance"]), "meanAffinityDistance": number(row["mean_affinity_distance"]),
            "intimacyBonusTotal": int(row["intimacy_bonus_total"]), "positiveRelationPairs": row["positive_relation_pairs"].split("；") if row["positive_relation_pairs"] else [],
            "commonTactics": row["common_tactics_all"].split("、") if row["common_tactics_all"] else [],
            "tacticSystemCoverage": row["tactic_system_coverage"].split("；") if row["tactic_system_coverage"] else [],
            "meanAbilities": {"command": number(row["mean_command"]), "strength": number(row["mean_strength"]), "intelligence": number(row["mean_intelligence"])},
            "meanCapability": number(row["mean_capability"]), "searchMethod": row["search_method"],
        })
    if len(recommendation_json) < 400:
        raise ValueError("Expected global and faction-specific recommendations.")

    write_json(output / "officers.json", officers)
    write_json(output / "scenarios.json", sorted(scenario_map.values(), key=lambda item: item["id"]))
    write_json(output / "scenario-availability.json", availability_json)
    write_json(output / "factions.json", faction_json)
    write_json(output / "relationships.json", relationship_json)
    write_json(output / "formations.json", formation_json)
    write_json(output / "recommendations.json", recommendation_json)
    write_json(output / "manifest.json", {
        "schemaVersion": 1,
        "counts": {"officers": len(officers), "scenarios": len(scenario_map), "factions": len(faction_json), "availabilityRecords": len(availability_json), "relationships": len(relationship_json), "formations": len(formation_json), "recommendations": len(recommendation_json)},
        "notes": ["Traditional-name aliases are available for all 650 officers.", "Game-original Traditional Chinese biographies are linked by officer slot ID and biography ID.", "Scenario faction membership is resolved from original scenario records.", "Recommendation scores do not hard-code unverified formation mechanics."],
    })
    print(f"Wrote web data to {output}")


if __name__ == "__main__":
    main()
