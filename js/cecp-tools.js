(function () {
  'use strict';

  const NAMES_KEY = 'cecp_tool_names_v1';
  const SCORE_KEY = 'cecp_tool_scoreboard_v1';

  // ---------- 工具函数 ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function shuffleArray(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  let sharedAudioCtx = null;
  function playTone(freqs) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
      if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
      const now = sharedAudioCtx.currentTime;
      freqs.forEach(function (freq, idx) {
        const osc = sharedAudioCtx.createOscillator();
        const gain = sharedAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(sharedAudioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.28);
      });
    } catch (e) {}
  }

  // ---------- 1. 返回官网按钮 & 顶部切换 ----------
  const backBtn = document.getElementById('cecpBackHome');
  if (backBtn && window.self !== window.top) {
    backBtn.classList.add('show');
  }

  const switchBtns = document.querySelectorAll('.cecp-switch-btn');
  const mainEl = document.getElementById('main');
  const panels = {
    year: document.getElementById('cecpYearPanel'),
    draw: document.getElementById('cecpDrawPanel'),
    score: document.getElementById('cecpScorePanel')
  };

  function switchTab(tab) {
    switchBtns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.cecpTab === tab);
    });
    if (mainEl) {
      mainEl.classList.toggle('cecp-hidden', tab !== 'timer');
    }
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].classList.toggle('show', key === tab);
    });
    if (tab === 'year') renderYearMatrix();
  }

  switchBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.cecpTab);
    });
  });

  // ---------- 2. 年度点阵进度 ----------
  function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function renderYearMatrix() {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);
    const totalDays = Math.round((endOfYear - startOfYear) / 86400000);
    const todayIdx = Math.floor((new Date(year, now.getMonth(), now.getDate()) - startOfYear) / 86400000) + 1;
    const yearPct = Math.round((todayIdx / totalDays) * 100);
    const weekNum = getISOWeek(now);

    const titleEl = document.getElementById('cecpMatrixTitle');
    const metaEl = document.getElementById('cecpMatrixMeta');
    const gridEl = document.getElementById('cecpDotGrid');
    const statsEl = document.getElementById('cecpMiniStats');
    if (!titleEl || !metaEl || !gridEl || !statsEl) return;

    titleEl.textContent = year + ' 年 · 第 ' + weekNum + ' 周';
    metaEl.textContent = todayIdx + '/' + totalDays + ' 天 (' + yearPct + '%)';

    const dots = [];
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, 0, i);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      let cls = 'cecp-day-dot';
      if (i < todayIdx) cls += ' past';
      else if (i === todayIdx) cls += ' today';
      dots.push('<div class="' + cls + '" title="' + dateStr + '"></div>');
    }
    gridEl.innerHTML = dots.join('');

    const startOfMonth = new Date(year, now.getMonth(), 1);
    const endOfMonth = new Date(year, now.getMonth() + 1, 1);
    const monthPct = ((now - startOfMonth) / (endOfMonth - startOfMonth)) * 100;

    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(year, now.getMonth(), now.getDate() - dayOfWeek);
    const weekPct = ((now - startOfWeek) / (7 * 86400000)) * 100;

    const startOfDay = new Date(year, now.getMonth(), now.getDate());
    const dayPct = ((now - startOfDay) / 86400000) * 100;

    statsEl.innerHTML = [
      { k: '本月已过', v: monthPct.toFixed(1) + '%' },
      { k: '本周已过', v: weekPct.toFixed(1) + '%' },
      { k: '今日已过', v: dayPct.toFixed(1) + '%' }
    ].map(function (s) {
      return '<div class="cecp-mini-stat"><div class="cecp-mini-val">' + s.v + '</div><div class="cecp-mini-key">' + s.k + '</div></div>';
    }).join('');
  }

  renderYearMatrix();

  // ---------- 3. 随机抽签 & 一键分组 ----------
  const namesInput = document.getElementById('cecpNamesInput');
  const namesCountEl = document.getElementById('cecpNamesCount');
  const fillNumbersBtn = document.getElementById('cecpFillNumbersBtn');
  const clearNamesBtn = document.getElementById('cecpClearNamesBtn');
  const subBtns = document.querySelectorAll('.cecp-sub-btn[data-draw-mode]');
  const drawModeBox = document.getElementById('cecpDrawModeBox');
  const groupModeBox = document.getElementById('cecpGroupModeBox');

  const drawPickCount = document.getElementById('cecpDrawPickCount');
  const drawNoRepeat = document.getElementById('cecpDrawNoRepeat');
  const drawRemainInfo = document.getElementById('cecpDrawRemainInfo');
  const drawStartBtn = document.getElementById('cecpDrawStartBtn');
  const drawResetPoolBtn = document.getElementById('cecpDrawResetPoolBtn');
  const drawResultBox = document.getElementById('cecpDrawResultBox');
  const drawHistoryWrap = document.getElementById('cecpDrawHistoryWrap');
  const drawHistoryPills = document.getElementById('cecpDrawHistoryPills');

  const groupPills = document.querySelectorAll('.cecp-group-pill');
  const groupCustomInput = document.getElementById('cecpGroupCustomCount');
  const groupStartBtn = document.getElementById('cecpGroupStartBtn');
  const groupCopyBtn = document.getElementById('cecpGroupCopyBtn');
  const groupsGrid = document.getElementById('cecpGroupsGrid');

  let drawnHistory = [];
  let isRolling = false;
  let rollTimer = null;
  let lastGroups = [];

  function parseNames() {
    if (!namesInput) return [];
    return namesInput.value
      .split(/[\n,，、]+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function updateNamesMeta() {
    const names = parseNames();
    if (namesCountEl) namesCountEl.textContent = '共 ' + names.length + ' 人';
    updatePoolStatus();
  }

  function getAvailablePool() {
    const names = parseNames();
    if (!drawNoRepeat || !drawNoRepeat.checked) return names;
    const usedCounts = {};
    drawnHistory.forEach(function (n) {
      usedCounts[n] = (usedCounts[n] || 0) + 1;
    });
    return names.filter(function (n) {
      if (usedCounts[n] > 0) {
        usedCounts[n]--;
        return false;
      }
      return true;
    });
  }

  function updatePoolStatus() {
    if (!drawRemainInfo) return;
    const total = parseNames().length;
    if (drawNoRepeat && drawNoRepeat.checked) {
      const remain = getAvailablePool().length;
      drawRemainInfo.textContent = '剩余 ' + remain + ' / ' + total;
    } else {
      drawRemainInfo.textContent = '可重复抽取';
    }
  }

  function renderDrawHistory() {
    if (!drawHistoryWrap || !drawHistoryPills) return;
    if (drawnHistory.length === 0) {
      drawHistoryWrap.style.display = 'none';
      drawHistoryPills.innerHTML = '';
      return;
    }
    drawHistoryWrap.style.display = 'block';
    drawHistoryPills.innerHTML = drawnHistory.map(function (name, idx) {
      return '<span class="cecp-history-pill">' + (idx + 1) + '. ' + escapeHtml(name) + '</span>';
    }).join('');
  }

  if (namesInput) {
    const savedNames = localStorage.getItem(NAMES_KEY);
    if (savedNames !== null) {
      namesInput.value = savedNames;
    } else {
      namesInput.value = '1号\n2号\n3号\n4号\n5号\n6号\n7号\n8号';
    }
    namesInput.addEventListener('input', function () {
      localStorage.setItem(NAMES_KEY, namesInput.value);
      updateNamesMeta();
    });
    updateNamesMeta();
  }

  if (fillNumbersBtn) {
    fillNumbersBtn.addEventListener('click', function () {
      const nums = [];
      for (let i = 1; i <= 20; i++) nums.push(i + '号');
      namesInput.value = nums.join('\n');
      localStorage.setItem(NAMES_KEY, namesInput.value);
      drawnHistory = [];
      renderDrawHistory();
      updateNamesMeta();
    });
  }

  if (clearNamesBtn) {
    clearNamesBtn.addEventListener('click', function () {
      namesInput.value = '';
      localStorage.setItem(NAMES_KEY, '');
      drawnHistory = [];
      renderDrawHistory();
      updateNamesMeta();
      if (drawResultBox) drawResultBox.innerHTML = '<span class="cecp-muted">请先在上方输入名单或编号</span>';
      if (groupsGrid) groupsGrid.innerHTML = '';
    });
  }

  subBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      subBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      const mode = btn.dataset.drawMode;
      if (drawModeBox) drawModeBox.style.display = mode === 'draw' ? 'block' : 'none';
      if (groupModeBox) groupModeBox.style.display = mode === 'group' ? 'block' : 'none';
    });
  });

  if (drawNoRepeat) {
    drawNoRepeat.addEventListener('change', updatePoolStatus);
  }

  if (drawResetPoolBtn) {
    drawResetPoolBtn.addEventListener('click', function () {
      drawnHistory = [];
      renderDrawHistory();
      updatePoolStatus();
      if (drawResultBox) drawResultBox.innerHTML = '<span class="cecp-muted">已重置抽签池，点击「开始抽签」</span>';
    });
  }

  if (drawStartBtn) {
    drawStartBtn.addEventListener('click', function () {
      if (isRolling) return;
      const allNames = parseNames();
      if (allNames.length === 0) {
        drawResultBox.innerHTML = '<span class="cecp-muted">名单为空，请先输入名单或点击「填入 1~20 号」</span>';
        return;
      }

      const pool = getAvailablePool();
      if (pool.length === 0) {
        drawResultBox.innerHTML = '<span class="cecp-muted">所有人已抽完，请点击「重置抽签池」继续</span>';
        return;
      }

      let count = parseInt(drawPickCount.value, 10) || 1;
      count = Math.max(1, Math.min(20, count));
      const actualCount = Math.min(count, pool.length);

      isRolling = true;
      drawStartBtn.disabled = true;
      let ticks = 0;
      const totalTicks = 12;

      rollTimer = setInterval(function () {
        ticks++;
        const preview = shuffleArray(pool).slice(0, actualCount);
        drawResultBox.innerHTML = '<div class="cecp-winner-list">' + preview.map(function (name) {
          return '<span class="cecp-winner-pill rolling">' + escapeHtml(name) + '</span>';
        }).join('') + '</div>';

        if (ticks >= totalTicks) {
          clearInterval(rollTimer);
          rollTimer = null;
          isRolling = false;
          drawStartBtn.disabled = false;

          const winners = shuffleArray(pool).slice(0, actualCount);
          drawResultBox.innerHTML = '<div class="cecp-winner-list">' + winners.map(function (name) {
            return '<span class="cecp-winner-pill pop">' + escapeHtml(name) + '</span>';
          }).join('') + '</div>';

          if (drawNoRepeat && drawNoRepeat.checked) {
            drawnHistory = drawnHistory.concat(winners);
            renderDrawHistory();
            updatePoolStatus();
          }
          playTone([523.25, 659.25, 783.99]);
        }
      }, 55);
    });
  }

  // 一键分组
  let targetGroupCount = 2;

  groupPills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      groupPills.forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      targetGroupCount = parseInt(pill.dataset.groups, 10) || 2;
      if (groupCustomInput) groupCustomInput.value = targetGroupCount;
    });
  });

  if (groupCustomInput) {
    groupCustomInput.addEventListener('input', function () {
      const val = parseInt(groupCustomInput.value, 10);
      if (!isNaN(val) && val >= 2 && val <= 12) {
        targetGroupCount = val;
        groupPills.forEach(function (p) {
          p.classList.toggle('active', parseInt(p.dataset.groups, 10) === val);
        });
      }
    });
  }

  if (groupStartBtn) {
    groupStartBtn.addEventListener('click', function () {
      const names = parseNames();
      if (names.length < 2) {
        groupsGrid.innerHTML = '<div class="cecp-muted" style="grid-column:1/-1;text-align:center;padding:16px 0;">至少需要 2 人才能分组哦</div>';
        lastGroups = [];
        return;
      }

      const k = Math.max(2, Math.min(12, Math.min(targetGroupCount, names.length)));
      const shuffled = shuffleArray(names);
      const groups = Array.from({ length: k }, function () { return []; });
      shuffled.forEach(function (name, idx) {
        groups[idx % k].push(name);
      });
      lastGroups = groups;

      groupsGrid.innerHTML = groups.map(function (members, idx) {
        return '<div class="cecp-group-card">' +
          '<div class="cecp-group-card-head"><span>第 ' + (idx + 1) + ' 组</span><span class="cecp-muted">' + members.length + ' 人</span></div>' +
          '<div class="cecp-group-members">' +
          members.map(function (m) { return '<span class="cecp-member-chip">' + escapeHtml(m) + '</span>'; }).join('') +
          '</div></div>';
      }).join('');
      playTone([587.33, 783.99]);
    });
  }

  if (groupCopyBtn) {
    groupCopyBtn.addEventListener('click', function () {
      if (!lastGroups.length) return;
      const text = lastGroups.map(function (members, idx) {
        return '【第 ' + (idx + 1) + ' 组】' + members.join('、');
      }).join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          const old = groupCopyBtn.textContent;
          groupCopyBtn.textContent = '已复制 ✓';
          setTimeout(function () { groupCopyBtn.textContent = old; }, 1200);
        }).catch(function () {});
      }
    });
  }

  // ---------- 4. 团契游戏计分板 ----------
  const TEAM_PRESETS = [
    { name: '红队', color: '#ef4444' },
    { name: '蓝队', color: '#3b82f6' },
    { name: '黄队', color: '#eab308' },
    { name: '绿队', color: '#22c55e' },
    { name: '紫队', color: '#a855f7' },
    { name: '橙队', color: '#f97316' }
  ];

  const scoreGrid = document.getElementById('cecpScoreGrid');
  const scoreAddTeamBtn = document.getElementById('cecpAddTeamBtn');
  const scoreResetBtn = document.getElementById('cecpResetScoreBtn');
  const scoreMuteBtn = document.getElementById('cecpScoreMuteBtn');
  const scoreFullscreenBtn = document.getElementById('cecpFullscreenBtn');

  let scoreMuted = false;
  let teams = [];

  function loadTeams() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCORE_KEY) || 'null');
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
    } catch (e) {}
    return [
      { id: 't1', name: '红队', color: '#ef4444', score: 0 },
      { id: 't2', name: '蓝队', color: '#3b82f6', score: 0 }
    ];
  }

  function saveTeams() {
    localStorage.setItem(SCORE_KEY, JSON.stringify(teams));
  }

  function renderScoreboard() {
    if (!scoreGrid) return;
    let maxScore = 0;
    teams.forEach(function (team) {
      if (team.score > maxScore) maxScore = team.score;
    });

    scoreGrid.innerHTML = teams.map(function (team, idx) {
      const isLeading = maxScore > 0 && team.score === maxScore;
      const canDelete = teams.length > 2;
      return '<div class="cecp-team-card' + (isLeading ? ' leading' : '') + '" data-team-idx="' + idx + '">' +
        '<div class="cecp-team-stripe" style="background:' + team.color + ';"></div>' +
        '<div class="cecp-team-head">' +
          '<span class="cecp-team-crown">' + (isLeading ? '👑' : '') + '</span>' +
          '<input type="text" class="cecp-team-name" value="' + escapeHtml(team.name) + '" maxlength="16" aria-label="队名" />' +
          (canDelete ? '<button type="button" class="cecp-team-del" title="删除队伍">✕</button>' : '<span style="width:22px;"></span>') +
        '</div>' +
        '<div class="cecp-team-score">' + team.score + '</div>' +
        '<div class="cecp-team-btns">' +
          '<button type="button" class="cecp-score-btn" data-delta="-1">-1</button>' +
          '<button type="button" class="cecp-score-btn plus" data-delta="1">+1</button>' +
          '<button type="button" class="cecp-score-btn plus5" data-delta="5">+5</button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (scoreAddTeamBtn) {
      scoreAddTeamBtn.disabled = teams.length >= 6;
    }
  }

  if (scoreGrid) {
    teams = loadTeams();
    renderScoreboard();

    scoreGrid.addEventListener('click', function (e) {
      const card = e.target.closest('.cecp-team-card');
      if (!card) return;
      const idx = parseInt(card.dataset.teamIdx, 10);
      if (isNaN(idx) || !teams[idx]) return;

      if (e.target.closest('.cecp-team-del')) {
        if (teams.length <= 2) return;
        teams.splice(idx, 1);
        saveTeams();
        renderScoreboard();
        return;
      }

      const btn = e.target.closest('.cecp-score-btn');
      if (btn) {
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        teams[idx].score = Math.max(0, teams[idx].score + delta);
        saveTeams();
        renderScoreboard();
        if (!scoreMuted) {
          playTone(delta > 0 ? [587.33, 880] : [392]);
        }
      }
    });

    scoreGrid.addEventListener('input', function (e) {
      if (!e.target.classList.contains('cecp-team-name')) return;
      const card = e.target.closest('.cecp-team-card');
      if (!card) return;
      const idx = parseInt(card.dataset.teamIdx, 10);
      if (!isNaN(idx) && teams[idx]) {
        teams[idx].name = e.target.value;
        saveTeams();
      }
    });
  }

  if (scoreAddTeamBtn) {
    scoreAddTeamBtn.addEventListener('click', function () {
      if (teams.length >= 6) return;
      const preset = TEAM_PRESETS[teams.length] || { name: '第' + (teams.length + 1) + '队', color: '#38bdf8' };
      teams.push({
        id: 't' + Date.now(),
        name: preset.name,
        color: preset.color,
        score: 0
      });
      saveTeams();
      renderScoreboard();
    });
  }

  if (scoreResetBtn) {
    scoreResetBtn.addEventListener('click', function () {
      teams.forEach(function (team) { team.score = 0; });
      saveTeams();
      renderScoreboard();
    });
  }

  if (scoreMuteBtn) {
    scoreMuteBtn.addEventListener('click', function () {
      scoreMuted = !scoreMuted;
      scoreMuteBtn.textContent = scoreMuted ? '🔇 静音' : '🔊 音效';
    });
  }

  if (scoreFullscreenBtn) {
    scoreFullscreenBtn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function () {});
      } else {
        document.exitFullscreen && document.exitFullscreen().catch(function () {});
      }
    });
  }
})();
