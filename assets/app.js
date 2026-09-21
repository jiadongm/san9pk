const $ = (id) => document.getElementById(id);
const state = { officers: [], scenarios: [], availability: [], factions: [], relationships: [], recommendations: [], selectedOfficerId: null };
const dataVersion = new URL(import.meta.url).searchParams.get("v") || "1";

async function loadData() {
  const names = ["officers", "scenarios", "scenario-availability", "factions", "relationships", "recommendations", "manifest"];
  const data = await Promise.all(names.map(async (name) => {
    const response = await fetch(`data/${name}.json?v=${dataVersion}`);
    if (!response.ok) throw new Error(`无法读取 ${name}`);
    return response.json();
  }));
  [state.officers, state.scenarios, state.availability, state.factions, state.relationships, state.recommendations, state.manifest] = data;
}

function fillControls() {
  $("officer-count").textContent = state.manifest.counts.officers;
  $("scenario-count").textContent = state.manifest.counts.scenarios;
  $("recommendation-count").textContent = state.manifest.counts.recommendations;
  const tactics = [...new Set(state.officers.flatMap((officer) => officer.tactics))].sort((a, b) => a.localeCompare(b, "zh-Hans"));
  tactics.forEach((tactic) => $("tactic-filter").add(new Option(tactic, tactic)));
  state.scenarios.forEach((scenario) => $("scenario-filter").add(new Option(`${scenario.year}年${scenario.month}月　${scenario.title}`, scenario.id)));
  renderFactionFilter();
}

function renderFactionFilter() {
  const scenarioId = $("scenario-filter").value;
  const currentValue = $("faction-filter").value;
  const factions = state.factions.filter((faction) => faction.scenarioId === scenarioId);
  $("faction-filter").replaceChildren(new Option("全部开局武将", ""));
  factions.forEach((faction) => $("faction-filter").add(new Option(`${faction.leaderName}势力`, String(faction.forceId))));
  if (factions.some((faction) => String(faction.forceId) === currentValue)) $("faction-filter").value = currentValue;
}

function visibleOfficers() {
  const query = $("officer-search").value.trim().toLowerCase();
  const tactic = $("tactic-filter").value;
  const sort = $("officer-sort").value;
  const filtered = state.officers.filter((officer) => (!query || officer.searchAliases.some((alias) => alias.toLowerCase().includes(query))) && (!tactic || officer.tactics.includes(tactic)));
  return filtered.sort((a, b) => {
    if (sort === "name") return a.nameSimplified.localeCompare(b.nameSimplified, "zh-Hans");
    const aValue = sort === "affinity" ? a.affinity : a.abilities[sort];
    const bValue = sort === "affinity" ? b.affinity : b.abilities[sort];
    return bValue - aValue || a.nameSimplified.localeCompare(b.nameSimplified, "zh-Hans");
  });
}

function renderOfficers() {
  const all = visibleOfficers();
  const officers = all.slice(0, 24);
  $("officer-status").textContent = `找到 ${all.length} 名武将，当前显示前 ${officers.length} 名。`;
  $("officer-list").innerHTML = officers.map((officer) => `<button class="officer-card" type="button" data-officer-id="${officer.id}" aria-pressed="${officer.id === state.selectedOfficerId}"><strong>${officer.nameSimplified}</strong><span>统 ${officer.abilities.command}　武 ${officer.abilities.strength}　智 ${officer.abilities.intelligence}　政 ${officer.abilities.politics}</span><span class="affinity-position">相性圈位置 ${officer.affinity} / 149</span></button>`).join("") || "<p>没有符合条件的武将。</p>";
  document.querySelectorAll("[data-officer-id]").forEach((button) => button.addEventListener("click", () => { state.selectedOfficerId = Number(button.dataset.officerId); renderOfficers(); renderDetail(); }));
}

function renderDetail() {
  if (state.selectedOfficerId === null) return;
  const officer = state.officers.find((item) => item.id === state.selectedOfficerId);
  const available = state.availability.filter((item) => item.officerId === officer.id && item.presentAtStart).length;
  const related = state.relationships.filter((item) => item.officerIdA === officer.id || item.officerIdB === officer.id);
  const relationships = related.length ? related.map((item) => { const other = item.officerIdA === officer.id ? item.nameB : item.nameA; const label = item.type === "positive" ? `正向关系 +${item.intimacyBonus}` : "避免同队"; return `<li class="relationship-${item.type}"><b>${label}</b><br>${other}</li>`; }).join("") : "<li>未收录特殊关系。</li>";
  const traditionalName = officer.nameTraditional && officer.nameTraditional !== officer.nameSimplified ? `<span class="traditional-name">${officer.nameTraditional}</span>` : "";
  $("officer-detail").innerHTML = `<p class="panel-kicker">武将档案 · #${officer.id}</p><h3>${officer.nameSimplified}${traditionalName}</h3><ul class="detail-list"><li><b>能力</b><br>统率 ${officer.abilities.command}　武力 ${officer.abilities.strength}　智力 ${officer.abilities.intelligence}　政治 ${officer.abilities.politics}</li><li><b>相性位置</b><br>${officer.affinity} / 149（环状距离，不代表能力高低）</li><li><b>兵法</b><br>${officer.tactics.map((tactic) => `<span class="tag">${tactic}</span>`).join("") || "未记录"}</li><li><b>开局可用剧本</b><br>${available} 个</li><li><b>特殊关系</b><br>${relationships}</li></ul>`;
}

function renderRecommendations() {
  const scenarioId = $("scenario-filter").value;
  const forceId = $("faction-filter").value;
  const teamSize = Number(document.querySelector("input[name='team-size']:checked").value);
  const scenario = state.scenarios.find((item) => item.id === scenarioId);
  const teams = state.recommendations.filter((item) => item.scenarioId === scenarioId && item.teamSize === teamSize && (forceId ? item.forceId === Number(forceId) : item.forceId === null)).sort((a, b) => a.rank - b.rank);
  const faction = forceId ? state.factions.find((item) => item.scenarioId === scenarioId && item.forceId === Number(forceId)) : null;
  const scope = faction ? `${faction.leaderName}势力 · 已验证成员池 ${teams[0]?.candidatePoolSize ?? 0} 人` : "全部开局武将";
  $("recommendation-note").textContent = `${scenario.title}（${scenario.year}年${scenario.month}月） · ${scope} · ${teamSize} 人高分候选。联携分不混入能力值；能力均值仅用于同分排序。`;
  $("recommendation-list").innerHTML = teams.map((team) => `<article class="team-card"><header><span class="rank">候选 ${team.rank}</span><span class="score">联携分 ${team.linkageScore}</span></header><p class="team-members">${team.members.join(" · ")}</p><ul class="reason-list"><li>最小相性距离：${team.minAffinityDistance}；平均距离：${team.meanAffinityDistance}</li><li>${team.positiveRelationPairs.length ? `正向关系：${team.positiveRelationPairs.join("、")}` : "没有收录的特殊正向关系，以相性接近度为主。"}</li><li>${team.commonTactics.length ? `共同兵法：${team.commonTactics.join("、")}` : "没有三人／五人共同兵法。"}</li><li>${team.tacticSystemCoverage.length ? `兵法覆盖：${team.tacticSystemCoverage.join("；")}` : "未达到两人以上的已标注兵法体系。"}</li></ul></article>`).join("") || "<p>该势力没有足够的已验证成员生成此人数候选。</p>";
}

function initialiseListeners() {
  ["officer-search", "tactic-filter", "officer-sort"].forEach((id) => $(id).addEventListener(id === "officer-search" ? "input" : "change", renderOfficers));
  $("scenario-filter").addEventListener("change", () => { renderFactionFilter(); renderRecommendations(); });
  $("faction-filter").addEventListener("change", renderRecommendations);
  document.querySelectorAll("input[name='team-size']").forEach((input) => input.addEventListener("change", renderRecommendations));
}

async function initialise() {
  try { await loadData(); fillControls(); initialiseListeners(); renderOfficers(); renderRecommendations(); }
  catch (error) { document.querySelector("main").innerHTML = `<p class="load-error">资料载入失败：${error.message}</p>`; }
}
initialise();
