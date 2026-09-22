#!/usr/bin/env python3
"""Extract SAN9PK's original Traditional Chinese officer biographies.

The game files are read-only inputs.  A biography is joined to an officer by
the biography ID stored in that officer's ``prsn`` record (little-endian
uint16 at byte offset 14), never by a converted name.
"""

from __future__ import annotations

import argparse
import csv
import struct
from pathlib import Path


CORE_ROSTER_SIZE = 650
PERSON_RECORD_SIZE = 134


def parse_riff(path: Path) -> tuple[bytes, list[tuple[str, int, int]]]:
    raw = path.read_bytes()
    if raw[:4] != b"RIFF" or raw[8:12] != b"S9SC":
        raise ValueError(f"{path.name} is not an S9SC RIFF file")
    chunks = []
    offset = 12
    while offset + 8 <= len(raw):
        name = raw[offset : offset + 4].decode("ascii", "replace")
        size = struct.unpack_from("<I", raw, offset + 4)[0]
        data_offset = offset + 8
        if data_offset + size > len(raw):
            raise ValueError(f"Malformed {name!r} chunk in {path.name}")
        chunks.append((name, data_offset, size))
        offset = data_offset + size + (size & 1)
    if offset != len(raw):
        raise ValueError(f"Unexpected trailing data in {path.name}")
    return raw, chunks


def read_prsn(game_dir: Path) -> bytes:
    raw, chunks = parse_riff(game_dir / "D_Sce001.S9")
    matches = [(offset, size) for name, offset, size in chunks if name == "prsn"]
    if len(matches) != 1:
        raise ValueError("D_Sce001.S9 must contain exactly one prsn chunk")
    offset, size = matches[0]
    records = raw[offset : offset + size]
    if len(records) < CORE_ROSTER_SIZE * PERSON_RECORD_SIZE:
        raise ValueError("The prsn chunk is shorter than the 650-officer roster")
    return records


def decode_ls11(path: Path) -> bytes:
    """Decode the game's LS11 dictionary/LZ container."""
    raw = path.read_bytes()
    if raw[:4] != b"LS11" or len(raw) < 288:
        raise ValueError(f"{path.name} is not a valid LS11 file")
    dictionary = raw[16:272]
    compressed_size = int.from_bytes(raw[272:276], "big")
    decoded_size = int.from_bytes(raw[276:280], "big")
    data_offset = int.from_bytes(raw[280:284], "big")
    if data_offset != 288 or compressed_size != len(raw) - data_offset:
        raise ValueError(f"Unexpected LS11 layout in {path.name}")
    source = raw[data_offset:]
    bit_position = 0
    output = bytearray()

    def read_code() -> int:
        nonlocal bit_position
        first, width = 0, 0
        while True:
            if bit_position >= len(source) * 8:
                raise EOFError("LS11 code ends mid-stream")
            bit = (source[bit_position // 8] >> (7 - bit_position % 8)) & 1
            bit_position += 1
            width += 1
            first = (first << 1) | bit
            if not bit:
                break
        if bit_position + width > len(source) * 8:
            raise EOFError("LS11 suffix ends mid-stream")
        second = 0
        for _ in range(width):
            bit = (source[bit_position // 8] >> (7 - bit_position % 8)) & 1
            bit_position += 1
            second = (second << 1) | bit
        return first + second

    while len(output) < decoded_size:
        code = read_code()
        if code < 256:
            output.append(dictionary[code])
        else:
            distance = code - 256
            length = read_code() + 3
            if distance <= 0 or distance > len(output):
                raise ValueError("Invalid LS11 back-reference")
            for _ in range(length):
                output.append(output[-distance])
    if len(output) != decoded_size:
        raise ValueError("Incomplete LS11 decode")
    return bytes(output)


def read_biographies(game_dir: Path) -> list[str]:
    raw = decode_ls11(game_dir / "M_RtdnPK.s9")
    count = int.from_bytes(raw[:2], "little")
    if count != 679 or len(raw) < 2 + count * 4:
        raise ValueError("Unexpected M_RtdnPK biography table")
    offsets = struct.unpack_from(f"<{count}I", raw, 2)
    if offsets[0] != 2 + count * 4 or any(left >= right for left, right in zip(offsets, offsets[1:])):
        raise ValueError("Malformed M_RtdnPK biography offsets")
    biographies = []
    for index, start in enumerate(offsets):
        end = offsets[index + 1] if index + 1 < count else len(raw)
        # 0x05 is the game's display terminator; newlines are retained.
        # Four game strings use Big5-HKSCS extension characters (including
        # byte pair FA45), so plain CP950 would silently lose original text.
        text = raw[start:end].rstrip(b"\0\x05").decode("big5hkscs")
        if not text:
            raise ValueError(f"Empty biography at index {index}")
        biographies.append(text)
    return biographies


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game-dir", required=True, type=Path)
    parser.add_argument("--officer-core", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    with args.officer_core.open(encoding="utf-8-sig", newline="") as handle:
        officers = list(csv.DictReader(handle))
    if len(officers) != CORE_ROSTER_SIZE:
        raise ValueError(f"Expected {CORE_ROSTER_SIZE} core officers, found {len(officers)}")
    records = read_prsn(args.game_dir)
    biographies = read_biographies(args.game_dir)
    rows = []
    used_biography_ids = set()
    for officer in officers:
        slot_id = int(officer["slot_id"])
        start = slot_id * PERSON_RECORD_SIZE + 14
        biography_id = int.from_bytes(records[start : start + 2], "little")
        if biography_id >= len(biographies):
            raise ValueError(f"Biography index {biography_id} is outside M_RtdnPK for slot {slot_id}")
        if biography_id in used_biography_ids:
            raise ValueError(f"Biography index {biography_id} is duplicated in the core roster")
        used_biography_ids.add(biography_id)
        rows.append({"slot_id": slot_id, "biography_id": biography_id, "biography_traditional": biographies[biography_id]})
    if len(rows) != CORE_ROSTER_SIZE:
        raise ValueError("Biography extraction did not cover the full core roster")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["slot_id", "biography_id", "biography_traditional"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda item: item["slot_id"]))
    print(f"Wrote {len(rows)} game-original biographies to {args.output}")


if __name__ == "__main__":
    main()
