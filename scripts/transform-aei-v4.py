#!/usr/bin/env python3
"""
Transform Anthropic Economic Index v4 CSV (flat) into the nested hierarchy
JSON format used by the automation-risk app.

Usage:
  python3 scripts/transform-aei-v4.py [--csv /path/to/aei_raw_claude_ai.csv]

If --csv not provided, reads from /tmp/aei_v4_global.csv (GLOBAL-only subset).

Outputs:
  data/onet/onetData-v4-2025-11.json   — Updated hierarchy with v4 metrics
"""

import csv
import json
import re
import sys
import os
from collections import defaultdict


def normalize_task_key(name):
    """Normalize task name for matching: lowercase, strip non-alphanumeric."""
    return re.sub(r"[^a-z0-9 ]", "", name.strip().lower()).strip()

CSV_PATH = "/tmp/aei_v4_global.csv"
HIERARCHY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "onet", "onetData.json")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "onet", "onetData-v4-2025-11.json")

# Collaboration types we care about (map to the 7 metric keys)
COLLAB_TO_METRIC = {
    "directive": "directive_pct",
    "feedback loop": "feedback_loop_pct",
    "validation": "validation_pct",
    "task iteration": "task_iteration_pct",
    "learning": "learning_pct",
}

# Automation sub-types
AUTOMATION_COLLABS = {"directive", "feedback loop"}
AUGMENTATION_COLLABS = {"validation", "task iteration", "learning"}


def load_v4_csv(csv_path):
    """Parse the v4 CSV and extract per-task metrics."""
    tasks = {}  # task_name_lower -> metrics dict

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            facet = row["facet"]
            variable = row["variable"]
            cluster = row["cluster_name"]
            try:
                value = float(row["value"])
            except (ValueError, TypeError):
                continue

            # --- Base task metrics (count, pct) ---
            if facet == "onet_task":
                task_key = normalize_task_key(cluster)
                if task_key not in tasks:
                    tasks[task_key] = {
                        "original_name": cluster.strip(),
                        "count": 0, "pct": 0,
                        "collaboration": {},
                        "success_rate": None,
                        "human_only_hours_mean": None,
                        "human_with_ai_hours_mean": None,
                        "human_education_years_mean": None,
                        "ai_autonomy_mean": None,
                    }
                if variable == "onet_task_count":
                    tasks[task_key]["count"] = value
                elif variable == "onet_task_pct":
                    tasks[task_key]["pct"] = value

            # --- Collaboration breakdown per task ---
            elif facet == "onet_task::collaboration" and variable == "onet_task_collaboration_pct":
                if "::" in cluster:
                    parts = cluster.rsplit("::", 1)
                    task_key = normalize_task_key(parts[0])
                    collab_type = parts[1].strip().lower()
                    if task_key not in tasks:
                        tasks[task_key] = {
                            "original_name": parts[0].strip(),
                            "count": 0, "pct": 0,
                            "collaboration": {},
                            "success_rate": None,
                            "human_only_hours_mean": None,
                            "human_with_ai_hours_mean": None,
                            "human_education_years_mean": None,
                            "ai_autonomy_mean": None,
                        }
                    tasks[task_key]["collaboration"][collab_type] = value

            # --- Task success (::yes percentage) ---
            elif facet == "onet_task::task_success" and variable == "onet_task_task_success_pct":
                if "::yes" in cluster:
                    task_key = normalize_task_key(cluster.replace("::yes", ""))
                    if task_key in tasks:
                        tasks[task_key]["success_rate"] = value / 100.0  # convert to 0-1

            # --- Human-only time (mean hours) ---
            elif facet == "onet_task::human_only_time" and variable == "onet_task_human_only_time_mean":
                task_key = normalize_task_key(cluster)
                if task_key in tasks:
                    tasks[task_key]["human_only_hours_mean"] = value

            # --- Human with AI time (mean hours) ---
            elif facet == "onet_task::human_with_ai_time" and variable == "onet_task_human_with_ai_time_mean":
                task_key = normalize_task_key(cluster)
                if task_key in tasks:
                    tasks[task_key]["human_with_ai_hours_mean"] = value

            # --- Human education years (mean) ---
            elif facet == "onet_task::human_education_years" and variable == "onet_task_human_education_years_mean":
                task_key = normalize_task_key(cluster)
                if task_key in tasks:
                    tasks[task_key]["human_education_years_mean"] = value

            # --- AI autonomy (mean) ---
            elif facet == "onet_task::ai_autonomy" and variable == "onet_task_ai_autonomy_mean":
                task_key = normalize_task_key(cluster)
                if task_key in tasks:
                    tasks[task_key]["ai_autonomy_mean"] = value

    # Derive automation_pct and augmentation_pct from collaboration breakdown
    for task_key, task_data in tasks.items():
        collab = task_data["collaboration"]
        if not collab:
            continue

        # Sum automation sub-types
        auto_sum = sum(collab.get(c, 0) for c in AUTOMATION_COLLABS)
        # Sum augmentation sub-types
        aug_sum = sum(collab.get(c, 0) for c in AUGMENTATION_COLLABS)

        total = auto_sum + aug_sum
        if total > 0:
            task_data["automation_pct"] = auto_sum / 100.0  # normalize to 0-1 fraction
            task_data["augmentation_pct"] = aug_sum / 100.0
        else:
            task_data["automation_pct"] = 0
            task_data["augmentation_pct"] = 0

        # Individual collaboration metrics (as fractions)
        for collab_name, metric_key in COLLAB_TO_METRIC.items():
            if collab_name in collab:
                task_data[metric_key] = collab.get(collab_name, 0) / 100.0

    return tasks


def update_hierarchy(hierarchy, v4_tasks):
    """Update existing hierarchy with v4 metrics, preserving structure."""
    matched = 0
    unmatched = 0

    sectors = hierarchy.get("onet_hierarchy", [])
    for sector in sectors:
        # Recompute sector-level pct from child roles
        sector_pct = 0
        sector_count = 0

        for role in sector.get("children", []):
            role_pct = 0
            role_count = 0

            for task in role.get("children", []):
                task_name = normalize_task_key(task.get("cluster_name", ""))
                v4 = v4_tasks.get(task_name)

                if v4:
                    matched += 1
                    # Update core metrics
                    task["variable"]["pct"] = {"global": {"GLOBAL": v4["pct"]}}
                    task["variable"]["count"] = {"global": {"GLOBAL": v4["count"]}}
                    role_pct += v4["pct"]
                    role_count += v4["count"]

                    # Update collaboration metrics
                    if "automation_pct" in v4:
                        task["variable"]["automation_pct"] = {"global": {"GLOBAL": v4["automation_pct"]}}
                    if "augmentation_pct" in v4:
                        task["variable"]["augmentation_pct"] = {"global": {"GLOBAL": v4["augmentation_pct"]}}
                    for metric_key in ["directive_pct", "feedback_loop_pct", "validation_pct", "task_iteration_pct", "learning_pct"]:
                        if metric_key in v4:
                            task["variable"][metric_key] = {"global": {"GLOBAL": v4[metric_key]}}

                    # Add new v4 metrics
                    if v4.get("success_rate") is not None:
                        task["variable"]["success_rate"] = {"global": {"GLOBAL": v4["success_rate"]}}
                    if v4.get("human_only_hours_mean") is not None:
                        task["variable"]["human_only_hours"] = {"global": {"GLOBAL": v4["human_only_hours_mean"]}}
                    if v4.get("human_with_ai_hours_mean") is not None:
                        task["variable"]["human_with_ai_hours"] = {"global": {"GLOBAL": v4["human_with_ai_hours_mean"]}}
                    if v4.get("human_education_years_mean") is not None:
                        task["variable"]["education_years"] = {"global": {"GLOBAL": v4["human_education_years_mean"]}}
                    if v4.get("ai_autonomy_mean") is not None:
                        task["variable"]["autonomy_level"] = {"global": {"GLOBAL": v4["ai_autonomy_mean"]}}
                else:
                    unmatched += 1
                    # Zero out metrics for tasks with no v4 data
                    for key in ["pct", "count", "automation_pct", "augmentation_pct",
                                "directive_pct", "feedback_loop_pct", "validation_pct",
                                "task_iteration_pct", "learning_pct"]:
                        task["variable"][key] = {"global": {"GLOBAL": 0}}

            # Update role-level aggregates
            role["variable"]["pct"] = {"global": {"GLOBAL": role_pct}}
            role["variable"]["count"] = {"global": {"GLOBAL": role_count}}
            sector_pct += role_pct
            sector_count += role_count

        # Update sector-level aggregates
        sector["variable"] = {"pct": {"global": {"GLOBAL": sector_pct}}}

    print(f"Matched: {matched} tasks, Unmatched: {unmatched} tasks")
    return hierarchy


def main():
    csv_path = CSV_PATH
    if "--csv" in sys.argv:
        idx = sys.argv.index("--csv")
        csv_path = sys.argv[idx + 1]

    print(f"Loading v4 CSV from {csv_path}...")
    v4_tasks = load_v4_csv(csv_path)
    print(f"Loaded {len(v4_tasks)} tasks from v4 data")

    # Show some stats
    with_collab = sum(1 for t in v4_tasks.values() if t.get("automation_pct", 0) > 0 or t.get("augmentation_pct", 0) > 0)
    with_success = sum(1 for t in v4_tasks.values() if t.get("success_rate") is not None)
    print(f"  Tasks with collaboration data: {with_collab}")
    print(f"  Tasks with success rate: {with_success}")

    print(f"\nLoading existing hierarchy from {HIERARCHY_PATH}...")
    with open(HIERARCHY_PATH, encoding="utf-8") as f:
        hierarchy = json.load(f)

    print("Updating hierarchy with v4 metrics...")
    updated = update_hierarchy(hierarchy, v4_tasks)

    print(f"Writing output to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(updated, f, separators=(",", ":"))

    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"Done! Output: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
