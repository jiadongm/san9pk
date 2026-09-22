const $ = (id) => document.getElementById(id);
const state = { officers: [], scenarios: [], availability: [], factions: [], relationships: [], recommendations: [], selectedOfficerId: null, selectedAffinity: 25, officerVisibleLimit: 24, recommendationVisibleLimit: 10 };
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
  if ($("tactic-filter")) {
    const tactics = [...new Set(state.officers.flatMap((officer) => officer.tactics))].sort((a, b) => a.localeCompare(b, "zh-Hans"));
    tactics.forEach((tactic) => $("tactic-filter").add(new Option(tactic, tactic)));
  }
  if ($("scenario-filter")) {
    state.scenarios.forEach((scenario) => $("scenario-filter").add(new Option(`${scenario.year}年${scenario.month}月　${scenario.title}`, scenario.id)));
    renderFactionFilter();
  }
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

function firstAvailableLabel(officer, includeMonth = false) {
  if (!officer.firstAvailable) return "未记录";
  return `${officer.firstAvailable.year}年${includeMonth ? `${officer.firstAvailable.month}月` : ""}`;
}

function renderOfficers() {
  const all = visibleOfficers();
  const officers = all.slice(0, state.officerVisibleLimit);
  $("officer-status").textContent = `找到 ${all.length} 名武将，当前显示 ${officers.length} 名。`;
  $("officer-list").innerHTML = officers.map((officer) => `<button class="officer-card" type="button" data-officer-id="${officer.id}" aria-pressed="${officer.id === state.selectedOfficerId}"><strong>${officer.nameSimplified}</strong><span>统 ${officer.abilities.command}　武 ${officer.abilities.strength}　智 ${officer.abilities.intelligence}　政 ${officer.abilities.politics}</span><span>最早可用 ${firstAvailableLabel(officer)}</span><span class="affinity-position">相性圈位置 ${officer.affinity} / 149</span></button>`).join("") || "<p>没有符合条件的武将。</p>";
  $("load-more-officers").hidden = officers.length >= all.length;
  $("collapse-officers").hidden = state.officerVisibleLimit <= 24;
  document.querySelectorAll("[data-officer-id]").forEach((button) => button.addEventListener("click", () => { state.selectedOfficerId = Number(button.dataset.officerId); renderOfficers(); renderDetail(); }));
}

function renderDetail() {
  if (state.selectedOfficerId === null) return;
  const officer = state.officers.find((item) => item.id === state.selectedOfficerId);
  const available = state.availability.filter((item) => item.officerId === officer.id && item.presentAtStart).length;
  const related = state.relationships.filter((item) => item.officerIdA === officer.id || item.officerIdB === officer.id);
  const relationships = related.length ? related.map((item) => { const other = item.officerIdA === officer.id ? item.nameB : item.nameA; const label = item.type === "positive" ? `正向关系 +${item.intimacyBonus}` : "避免同队"; return `<li class="relationship-${item.type}"><b>${label}</b><br>${other}</li>`; }).join("") : "<li>未收录特殊关系。</li>";
  const traditionalName = officer.nameTraditional && officer.nameTraditional !== officer.nameSimplified ? `<span class="traditional-name">${officer.nameTraditional}</span>` : "";
  $("officer-detail").innerHTML = `<p class="panel-kicker">武将档案 · #${officer.id}</p><h3>${officer.nameSimplified}${traditionalName}</h3><ul class="detail-list"><li><b>能力</b><br>统率 ${officer.abilities.command}　武力 ${officer.abilities.strength}　智力 ${officer.abilities.intelligence}　政治 ${officer.abilities.politics}</li><li><b>最早可用剧本</b><br>${firstAvailableLabel(officer, true)}</li><li><b>相性位置</b><br>${officer.affinity} / 149</li><li><b>兵法</b><br>${officer.tactics.map((tactic) => `<span class="tag">${tactic}</span>`).join("") || "未记录"}</li><li><b>开局可用剧本</b><br>${available} 个</li><li><b>特殊关系</b><br>${relationships}</li></ul>`;
}

function renderAffinityRing() {
  const selected = state.selectedAffinity;
  const counts = new Map(state.officers.map((officer) => [officer.affinity, 0]));
  state.officers.forEach((officer) => counts.set(officer.affinity, (counts.get(officer.affinity) || 0) + 1));
  const points = Array.from({ length: 150 }, (_, position) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * position) / 150;
    const x = 200 + Math.cos(angle) * 151;
    const y = 200 + Math.sin(angle) * 151;
    const count = counts.get(position) || 0;
    return `<circle class="affinity-tick${position === selected ? " is-selected" : ""}${count ? " has-officers" : ""}" data-affinity-position="${position}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${position === selected ? 6 : count ? 3.5 : 2}" tabindex="0" role="button" aria-label="相性位置 ${position}，${count} 名武将" />`;
  }).join("");
  const labels = [0, 25, 50, 75, 100, 125].map((position) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * position) / 150;
    return `<text class="affinity-label" x="${(200 + Math.cos(angle) * 181).toFixed(2)}" y="${(204 + Math.sin(angle) * 181).toFixed(2)}">${position}</text>`;
  }).join("");
  $("affinity-ring").innerHTML = `<svg viewBox="0 0 400 400" role="group" aria-label="0 至 149 的相性圆环"><circle class="affinity-guide" cx="200" cy="200" r="151" />${points}${labels}<text class="affinity-center" x="200" y="190">相性位置</text><text class="affinity-value" x="200" y="220">${selected}</text></svg>`;
  document.querySelectorAll("[data-affinity-position]").forEach((point) => {
    const selectPosition = () => { state.selectedAffinity = Number(point.dataset.affinityPosition); state.selectedOfficerId = null; renderAffinityRing(); renderAffinityOfficers(); renderAffinityDetail(); };
    point.addEventListener("click", selectPosition);
    point.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPosition(); } });
  });
}

function renderAffinityOfficers() {
  const officers = state.officers.filter((officer) => officer.affinity === state.selectedAffinity).sort((a, b) => a.nameSimplified.localeCompare(b.nameSimplified, "zh-Hans"));
  $("affinity-status").textContent = `相性位置 ${state.selectedAffinity}：${officers.length} 名武将。`;
  $("affinity-officer-list").innerHTML = officers.map((officer) => `<button class="affinity-officer" type="button" data-affinity-officer-id="${officer.id}" aria-pressed="${officer.id === state.selectedOfficerId}"><strong>${officer.nameSimplified}</strong><span>统 ${officer.abilities.command}　武 ${officer.abilities.strength}　智 ${officer.abilities.intelligence}　政 ${officer.abilities.politics}</span></button>`).join("") || "<p>这个位置没有收录武将。</p>";
  document.querySelectorAll("[data-affinity-officer-id]").forEach((button) => button.addEventListener("click", () => { state.selectedOfficerId = Number(button.dataset.affinityOfficerId); renderAffinityOfficers(); renderAffinityDetail(); }));
}

function renderAffinityDetail() {
  const panel = $("affinity-detail");
  if (state.selectedOfficerId === null) {
    panel.innerHTML = `<p class="panel-kicker">相性位置 ${state.selectedAffinity}</p><h3>选择一位武将</h3><p>同一相性位置可能有多名武将。点击左侧姓名查看完整资料。</p>`;
    return;
  }
  const officer = state.officers.find((item) => item.id === state.selectedOfficerId);
  panel.innerHTML = `<p class="panel-kicker">相性位置 ${officer.affinity}</p><h3>${officer.nameSimplified}</h3><ul class="detail-list"><li><b>能力</b><br>统率 ${officer.abilities.command}　武力 ${officer.abilities.strength}　智力 ${officer.abilities.intelligence}　政治 ${officer.abilities.politics}</li><li><b>兵法</b><br>${officer.tactics.map((tactic) => `<span class="tag">${tactic}</span>`).join("") || "未记录"}</li><li><b>最早可用剧本</b><br>${firstAvailableLabel(officer, true)}</li></ul>`;
}

function abilityThresholds() {
  return Object.fromEntries(["command", "strength", "intelligence", "politics"].map((ability) => [ability, Number($(`threshold-${ability}`).value) || 0]));
}

function meetsAbilityThresholds(team, thresholds) {
  return Object.entries(thresholds).every(([ability, minimum]) => !minimum || team.memberIds.some((id) => state.officers.find((officer) => officer.id === id).abilities[ability] >= minimum));
}

function renderRecommendations() {
  const scenarioId = $("scenario-filter").value;
  const forceId = $("faction-filter").value;
  const teamSize = Number(document.querySelector("input[name='team-size']:checked").value);
  const scenario = state.scenarios.find((item) => item.id === scenarioId);
  const allTeams = state.recommendations.filter((item) => item.scenarioId === scenarioId && item.teamSize === teamSize && (forceId ? item.forceId === Number(forceId) : item.forceId === null)).sort((a, b) => a.rank - b.rank);
  const thresholds = abilityThresholds();
  const teams = allTeams.filter((team) => meetsAbilityThresholds(team, thresholds));
  const faction = forceId ? state.factions.find((item) => item.scenarioId === scenarioId && item.forceId === Number(forceId)) : null;
  const scope = faction ? `${faction.leaderName}势力 · 已验证成员池 ${teams[0]?.candidatePoolSize ?? 0} 人` : "全部开局武将";
  const visibleTeams = teams.slice(0, state.recommendationVisibleLimit);
  const thresholdSummary = Object.entries(thresholds).filter(([, minimum]) => minimum).map(([ability, minimum]) => `${{ command: "统", strength: "武", intelligence: "智", politics: "政" }[ability]}≥${minimum}`).join("、");
  $("recommendation-note").textContent = `${scenario.title}（${scenario.year}年${scenario.month}月） · ${scope} · ${teamSize} 人高分候选${thresholdSummary ? ` · 队内最高值 ${thresholdSummary}` : ""}，显示 ${visibleTeams.length} / ${teams.length}${thresholdSummary ? `（原有 ${allTeams.length}）` : ""}。联携分不混入能力值；能力均值仅用于同分排序。`;
  const emptyMessage = thresholdSummary ? "当前能力门槛下没有符合的组合。" : faction ? "该势力没有足够的已验证成员生成此人数候选。" : "该剧本没有足够的开局武将生成此人数候选。";
  $("recommendation-list").innerHTML = visibleTeams.map((team) => `<article class="team-card"><header><span class="rank">候选 ${team.rank}</span><span class="score">联携分 ${team.linkageScore}</span></header><p class="team-members">${team.members.join(" · ")}</p><ul class="reason-list"><li>最小相性距离：${team.minAffinityDistance}；平均距离：${team.meanAffinityDistance}</li><li>${team.positiveRelationPairs.length ? `正向关系：${team.positiveRelationPairs.join("、")}` : "没有收录的特殊正向关系，以相性接近度为主。"}</li><li>${team.commonTactics.length ? `共同兵法：${team.commonTactics.join("、")}` : "没有三人／五人共同兵法。"}</li><li>${team.tacticSystemCoverage.length ? `兵法覆盖：${team.tacticSystemCoverage.join("；")}` : "未达到两人以上的已标注兵法体系。"}</li></ul></article>`).join("") || `<p>${emptyMessage}</p>`;
  $("load-more-recommendations").hidden = visibleTeams.length >= teams.length;
}

function initialiseListeners() {
  if ($("officer-search")) {
    ["officer-search", "tactic-filter", "officer-sort"].forEach((id) => $(id).addEventListener(id === "officer-search" ? "input" : "change", () => { state.officerVisibleLimit = 24; renderOfficers(); }));
    $("load-more-officers").addEventListener("click", () => { state.officerVisibleLimit += 24; renderOfficers(); });
    $("collapse-officers").addEventListener("click", () => { state.officerVisibleLimit = 24; renderOfficers(); });
  }
  if ($("scenario-filter")) {
    $("scenario-filter").addEventListener("change", () => { state.recommendationVisibleLimit = 10; renderFactionFilter(); renderRecommendations(); });
    $("faction-filter").addEventListener("change", () => { state.recommendationVisibleLimit = 10; renderRecommendations(); });
    document.querySelectorAll("input[name='team-size']").forEach((input) => input.addEventListener("change", () => { state.recommendationVisibleLimit = 10; renderRecommendations(); }));
    document.querySelectorAll(".ability-thresholds input").forEach((input) => input.addEventListener("input", () => { state.recommendationVisibleLimit = 10; renderRecommendations(); }));
    $("load-more-recommendations").addEventListener("click", () => { state.recommendationVisibleLimit += 10; renderRecommendations(); });
  }
}

async function initialise() {
  try { await loadData(); fillControls(); initialiseListeners(); if ($("officer-list")) renderOfficers(); if ($("recommendation-list")) renderRecommendations(); if ($("affinity-ring")) { renderAffinityRing(); renderAffinityOfficers(); renderAffinityDetail(); } }
  catch (error) { document.querySelector("main").innerHTML = `<p class="load-error">资料载入失败：${error.message}</p>`; }
}
initialise();
