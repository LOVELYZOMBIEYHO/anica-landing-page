# MotionLoom Action Library provenance

The following MotionLoom actions were converted from animation clips included with
Quaternius' Universal Animation Library 1 and the Character1 sample model. Those
source assets are released under CC0 1.0. The converted MotionLoom action data is
distributed under this repository's license.

| MotionLoom action | Character1 source clip |
| --- | --- |
| `standard_walk_loop` | `Walk_Loop` |
| `run_standard_loop` | `Jog_Fwd_Loop` |
| `listening_idle_loop` | `Idle_Loop` |
| `sit_down` | `Sitting_Enter` |
| `sit_idle_loop` | `Sitting_Idle_Loop` |

The identifiers and file paths are unchanged so existing Action Library consumers
remain compatible. `standard_walk_start` and `standard_walk_stop` are retained as
legacy compatibility members and are not part of this replacement phase.
`wave_greeting` and `stairs_up_loop` are also unchanged because Character1 has no
directly equivalent source clip.
