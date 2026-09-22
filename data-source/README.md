# 人物繁体姓名来源

`officer-traditional-profiles.csv` 从已审核的《三國志IX》繁体中文资料表生成。每行都由经验证的游戏槽位 ID 固定关联到简体姓名和繁体姓名。

生成脚本会以 OpenCC 的 `TSCharacters.txt` 做基础繁简转换，并对游戏名单中已核对的异体字、译名差异和同名人物使用显式校正规则。它要求 650 名来源人物与 650 个游戏槽位严格一一匹配，否则会失败。

`game-biographies.csv` 由 `scripts/extract_game_biographies.py` 从本地游戏的 `M_RtdnPK.s9` 和 `D_Sce001.S9` 提取。小传以人物记录中的编号关联到槽位 ID，不按姓名匹配；文本保留游戏原始繁体中文，不做转换。
