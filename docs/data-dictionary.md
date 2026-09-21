# 数据字典

`data/` 中的 JSON 是互动网站的唯一运行时数据来源。每个文件均由 `scripts/build_data.py` 从已验证的分析 CSV 生成。

## officers.json

- `id`：游戏人物槽位 ID。
- `nameSimplified`：当前已验证的简体姓名。
- `nameTraditional`：与游戏槽位一一验证后的繁体姓名。
- `searchAliases`：网页检索用别名；包括经验证的简体和繁体姓名。拼音尚未加入。
- 游戏内人物小传尚未提取，因此当前不提供 `biography` 字段。
- `abilities`：统率、武力、智力、政治。
- `affinity`：0–149 的环状相性值。
- `tactics`：已掌握兵法。
- `firstAvailable`：最早被观察到可开局使用的历史剧本年月与剧本 ID；这是剧本可用性资料，并非尚未提取的游戏内部精确登场年份字段。无历史剧本开局记录时为 `null`。

## scenarios.json、scenario-availability.json 和 factions.json

`scenarios.json` 为 20 个剧本的元数据。`scenario-availability.json` 逐行给出剧本与武将的开局状态。`presentAtStart` 为 `true` 时才会进入该剧本的联携推荐候选池；状态 9 尚未验证，因此不会进入推荐。

`factions.json` 为从原始剧本记录验证的势力清单。每项包括剧本 ID、势力 ID、君主槽位与姓名、首府城池 ID；网页以“君主姓名＋势力”显示。无已验证所属势力的武将不会被归入任何势力成员池。

## relationships.json

每行是一对武将。`type` 为 `positive` 时，`intimacyBonus` 是当前采用的量化值；`negative` 表示应避免同队，未虚构数值扣分。

## formations.json

包含 28 种阵形及游戏记录中的八个原始字段。`tacticSystemHint` 只用于说明，不能当作已经完整实测的数值机制。

## recommendations.json

每个剧本提供全部开局武将的候选，也为每个已验证势力分别提供三人和五人候选；每组最多保留 30 个，供网页渐进显示。`forceId` 为 `null` 表示全部开局武将；否则候选只来自对应势力成员池。`linkageScore` 仅基于相性接近度和已量化正向关系；能力均值只用于同分排序。`searchMethod` 明确记录候选搜索法，不能解释为全组合最优证明。
