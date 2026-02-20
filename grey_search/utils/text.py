from __future__ import annotations

from typing import Any


def openalex_abstract_to_text(inv_idx: Any) -> str:
    # OpenAlex gives inverted index: {"word":[pos1,pos2], ...}
    if not isinstance(inv_idx, dict):
        return ""
    positions = {}
    for word, pos_list in inv_idx.items():
        for pos in pos_list:
            positions[pos] = word
    return " ".join(positions[p] for p in sorted(positions.keys()))
