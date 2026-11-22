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

  let toastEl = null;
  let toastTimer = null;
  function showToast(msg) {
    if (!msg) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'cecp-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.classList.remove('show');
    }, 1600);
  }

  function bindConfirmButton(btn, armedText, onConfirm) {
    if (!btn) return;
    const defaultText = btn.textContent;
    let armed = false;
    let disarmTimer = null;

    function reset() {
      armed = false;
      if (disarmTimer) {
        clearTimeout(disarmTimer);
        disarmTimer = null;
      }
      btn.textContent = defaultText;
      btn.classList.remove('cecp-btn-danger');
    }

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      if (!armed) {
        armed = true;
        btn.textContent = armedText;
        btn.classList.add('cecp-btn-danger');
        disarmTimer = setTimeout(reset, 3000);
      } else {
        reset();
        onConfirm();
      }
    });
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

  const catBtns = document.querySelectorAll('.cecp-cat-btn');
  const switchBtns = document.querySelectorAll('.cecp-switch-btn');
  const mainEl = document.getElementById('main');
  const panels = {
    flip: document.getElementById('cecpFlipPanel'),
    year: document.getElementById('cecpYearPanel'),
    stage: document.getElementById('cecpStagePanel'),
    sound: document.getElementById('cecpSoundPanel'),
    wheel: document.getElementById('cecpWheelPanel'),
    draw: document.getElementById('cecpDrawPanel'),
    score: document.getElementById('cecpScorePanel')
  };

  const TAB_TO_CAT = {
    timer: 'time',
    flip: 'time',
    year: 'time',
    stage: 'event',
    sound: 'event',
    wheel: 'game',
    draw: 'game',
    score: 'game'
  };
  const lastTabByCat = { time: 'timer', event: 'stage', game: 'wheel' };

  let onSwitchCallbacks = {};
  let onLeaveCallbacks = {};
  let currentActiveTab = 'timer';
  let pureEnteredFullscreen = false;
  const pureExitBtn = document.getElementById('cecpPureExitBtn');

  function refreshActiveWheel() {
    if (panels.wheel && panels.wheel.classList.contains('show') && typeof drawWheel === 'function') {
      requestAnimationFrame(drawWheel);
    }
  }

  function enterPureMode() {
    document.body.classList.add('cecp-pure-mode');
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      pureEnteredFullscreen = true;
      document.documentElement.requestFullscreen().catch(function () {
        pureEnteredFullscreen = false;
      });
    }
    refreshActiveWheel();
  }

  function exitPureMode() {
    document.body.classList.remove('cecp-pure-mode');
    if (pureEnteredFullscreen && document.fullscreenElement && document.exitFullscreen) {
      pureEnteredFullscreen = false;
      document.exitFullscreen().catch(function () {});
    }
    refreshActiveWheel();
  }

  if (pureExitBtn) {
    pureExitBtn.addEventListener('click', exitPureMode);
  }

  function showCategoryBar(cat) {
    catBtns.forEach(function (c) {
      c.classList.toggle('active', c.dataset.cecpCat === cat);
    });
    switchBtns.forEach(function (b) {
      b.classList.toggle('group-hidden', b.dataset.cecpGroup !== cat);
    });
  }

  function switchTab(tab) {
    if (document.body.classList.contains('cecp-pure-mode')) {
      exitPureMode();
    }
    if (currentActiveTab && currentActiveTab !== tab && onLeaveCallbacks[currentActiveTab]) {
      onLeaveCallbacks[currentActiveTab]();
    }
    currentActiveTab = tab;

    const cat = TAB_TO_CAT[tab] || 'time';
    lastTabByCat[cat] = tab;
    showCategoryBar(cat);

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
    window.scrollTo(0, 0);
    if (onSwitchCallbacks[tab]) onSwitchCallbacks[tab]();
  }

  catBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const cat = btn.dataset.cecpCat;
      const targetTab = lastTabByCat[cat] || 'timer';
      switchTab(targetTab);
    });
  });

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
  const fillBtns = document.querySelectorAll('.cecp-fill-btn[data-fill-max]');
  const clearNamesBtn = document.getElementById('cecpClearNamesBtn');
  const drawMuteBtn = document.getElementById('cecpDrawMuteBtn');
  const drawPureBtn = document.getElementById('cecpDrawPureBtn');
  const subBtns = document.querySelectorAll('.cecp-sub-btn[data-draw-mode]');
  const drawModeBox = document.getElementById('cecpDrawModeBox');
  const groupModeBox = document.getElementById('cecpGroupModeBox');

  const drawPickCount = document.getElementById('cecpDrawPickCount');
  const drawNoRepeat = document.getElementById('cecpDrawNoRepeat');
  const drawRemainInfo = document.getElementById('cecpDrawRemainInfo');
  const drawStartBtn = document.getElementById('cecpDrawStartBtn');
  const drawResetPoolBtn = document.getElementById('cecpDrawResetPoolBtn');
  const drawClearHistoryBtn = document.getElementById('cecpDrawClearHistoryBtn');
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
  let drawMuted = false;

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

  fillBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const max = parseInt(btn.dataset.fillMax, 10) || 20;
      const nums = [];
      for (let i = 1; i <= max; i++) nums.push(i + '号');
      namesInput.value = nums.join('\n');
      localStorage.setItem(NAMES_KEY, namesInput.value);
      drawnHistory = [];
      renderDrawHistory();
      updateNamesMeta();
    });
  });

  if (drawMuteBtn) {
    drawMuteBtn.addEventListener('click', function () {
      drawMuted = !drawMuted;
      drawMuteBtn.textContent = drawMuted ? '🔇 静音' : '🔊 音效';
    });
  }

  if (drawPureBtn) {
    drawPureBtn.addEventListener('click', enterPureMode);
  }

  bindConfirmButton(drawClearHistoryBtn, '确认清空?', function () {
    drawnHistory = [];
    renderDrawHistory();
    updatePoolStatus();
    showToast('已清空抽中记录');
  });

  bindConfirmButton(clearNamesBtn, '确认清空?', function () {
    namesInput.value = '';
    localStorage.setItem(NAMES_KEY, '');
    drawnHistory = [];
    renderDrawHistory();
    updateNamesMeta();
    if (drawResultBox) drawResultBox.innerHTML = '<span class="cecp-muted">请先在上方输入名单或编号</span>';
    if (groupsGrid) groupsGrid.innerHTML = '';
    showToast('已清空名单');
  });

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
      showToast('已重置抽签池');
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
          if (!drawMuted) {
            playTone([523.25, 659.25, 783.99]);
          }
          if (typeof launchConfetti === 'function') {
            launchConfetti();
          }
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
          showToast('已复制分组结果');
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
        const prevScore = teams[idx].score;
        const nextScore = Math.max(0, prevScore + delta);
        const actualDelta = nextScore - prevScore;
        teams[idx].score = nextScore;
        saveTeams();
        renderScoreboard();
        if (!scoreMuted) {
          playTone(delta > 0 ? [587.33, 880] : [392]);
        }
        if (actualDelta !== 0) {
          const newCard = scoreGrid.querySelector('.cecp-team-card[data-team-idx="' + idx + '"]');
          if (newCard) {
            const scoreEl = newCard.querySelector('.cecp-team-score');
            if (scoreEl) {
              scoreEl.classList.remove('bump');
              void scoreEl.offsetWidth;
              scoreEl.classList.add('bump');
            }
            const floatEl = document.createElement('span');
            floatEl.className = 'cecp-score-float ' + (actualDelta >= 5 ? 'plus5' : actualDelta > 0 ? 'plus1' : 'minus');
            floatEl.textContent = (actualDelta > 0 ? '+' : '') + actualDelta;
            newCard.appendChild(floatEl);
            setTimeout(function () {
              if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
            }, 680);
          }
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

  bindConfirmButton(scoreResetBtn, '确认清零?', function () {
    teams.forEach(function (team) { team.score = 0; });
    saveTeams();
    renderScoreboard();
    showToast('已清零全部队伍分数');
  });

  if (scoreMuteBtn) {
    scoreMuteBtn.addEventListener('click', function () {
      scoreMuted = !scoreMuted;
      scoreMuteBtn.textContent = scoreMuted ? '🔇 静音' : '🔊 音效';
    });
  }

  if (scoreFullscreenBtn) {
    scoreFullscreenBtn.addEventListener('click', enterPureMode);
  }

  // ---------- 5. 聚会大屏倒计时 / 提示牌 ----------
  const STAGE_KEY = 'cecp_tool_stage_v1';
  const STAGE_PRESETS = {
    worship: {
      badge: '主日崇拜',
      title: '主日崇拜即将开始',
      subtitle: '请预备心安静等候，愿神赐福今日聚会',
      minutes: 10
    },
    youth: {
      badge: '青年团契',
      title: '青年团契即将开始',
      subtitle: '欢迎来到青年团契，一起敬拜、分享、成长',
      minutes: 10
    },
    group: {
      badge: '小组讨论',
      title: '小组自由讨论时间',
      subtitle: '请各小组围绕今日主题自由分享与代祷',
      minutes: 15
    },
    break: {
      badge: '中场休息',
      title: '中场休息时间',
      subtitle: '欢迎享用茶点交通，稍后继续聚会',
      minutes: 10
    }
  };

  const stageModeBtns = document.querySelectorAll('.cecp-sub-btn[data-stage-mode]');
  const stagePresetBtns = document.querySelectorAll('.cecp-stage-preset[data-stage-preset]');
  const stageTitleInput = document.getElementById('cecpStageTitleInput');
  const stageSubInput = document.getElementById('cecpStageSubInput');
  const stageBadgeEl = document.getElementById('cecpStageBadge');
  const stageTitleDisplay = document.getElementById('cecpStageTitleDisplay');
  const stageTimeDisplay = document.getElementById('cecpStageTimeDisplay');
  const stageProgressTrack = document.getElementById('cecpStageProgressTrack');
  const stageProgressFill = document.getElementById('cecpStageProgressFill');
  const stageSubDisplay = document.getElementById('cecpStageSubDisplay');
  const stageDurationGroup = document.getElementById('cecpStageDurationGroup');
  const stageTargetGroup = document.getElementById('cecpStageTargetGroup');
  const stageClockGroup = document.getElementById('cecpStageClockGroup');
  const stageMinBtns = document.querySelectorAll('.cecp-stage-min-btn[data-stage-mins]');
  const stageMinInput = document.getElementById('cecpStageMinInput');
  const stageTargetInput = document.getElementById('cecpStageTargetInput');
  const stageMuteBtn = document.getElementById('cecpStageMuteBtn');
  const stageResetBtn = document.getElementById('cecpStageResetBtn');
  const stageStartBtn = document.getElementById('cecpStageStartBtn');
  const stagePureBtn = document.getElementById('cecpStagePureBtn');

  let stageCfg = {
    mode: 'countdown',
    badge: '主日崇拜',
    title: '主日崇拜即将开始',
    subtitle: '请预备心安静等候，愿神赐福今日聚会',
    minutes: 10,
    targetTime: '14:40'
  };

  try {
    const savedStage = JSON.parse(localStorage.getItem(STAGE_KEY) || 'null');
    if (savedStage && typeof savedStage === 'object') {
      stageCfg = Object.assign(stageCfg, savedStage);
    }
  } catch (e) {}

  let stageMuted = false;
  let stageTotalSec = Math.max(60, (parseInt(stageCfg.minutes, 10) || 10) * 60);
  let stageRemainingSec = stageTotalSec;
  let stageState = 'ready'; // ready | running | paused | done
  let stageEndMs = null;
  let stageTicker = null;

  function saveStageCfg() {
    localStorage.setItem(STAGE_KEY, JSON.stringify(stageCfg));
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) {
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function syncStageTexts() {
    if (stageTitleDisplay) stageTitleDisplay.textContent = stageCfg.title || '聚会提示';
    if (stageSubDisplay) stageSubDisplay.textContent = stageCfg.subtitle || '';
  }

  function stopStageTicker() {
    if (stageTicker) {
      clearInterval(stageTicker);
      stageTicker = null;
    }
  }

  function updateStageTargetOrClock() {
    const now = new Date();
    if (stageCfg.mode === 'clock') {
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const pad = function (n) { return String(n).padStart(2, '0'); };
      if (stageBadgeEl) {
        stageBadgeEl.textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + weekdays[now.getDay()];
      }
      if (stageTimeDisplay) {
        stageTimeDisplay.classList.remove('warn', 'done');
        stageTimeDisplay.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      }
      if (stageProgressTrack) stageProgressTrack.style.display = 'none';
      return;
    }

    if (stageCfg.mode === 'target') {
      const parts = String(stageCfg.targetTime || '14:40').split(':');
      const hh = parseInt(parts[0], 10) || 0;
      const mm = parseInt(parts[1], 10) || 0;
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      const diffSec = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
      if (stageBadgeEl) stageBadgeEl.textContent = (stageCfg.badge || '聚会提示') + ' · 目标 ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      if (stageTimeDisplay) {
        stageTimeDisplay.textContent = formatDuration(diffSec);
        stageTimeDisplay.classList.toggle('warn', diffSec > 0 && diffSec <= 60);
        stageTimeDisplay.classList.toggle('done', diffSec === 0);
      }
      if (stageProgressTrack) stageProgressTrack.style.display = 'none';
    }
  }

  function renderStageDisplay() {
    syncStageTexts();

    if (stageCfg.mode === 'countdown') {
      if (stageProgressTrack) stageProgressTrack.style.display = 'block';
      if (stageBadgeEl) {
        const statusSuffix = stageState === 'running' ? '进行中' : stageState === 'paused' ? '已暂停' : stageState === 'done' ? '时间到' : '即将开始';
        stageBadgeEl.textContent = (stageCfg.badge ? stageCfg.badge + ' · ' : '') + statusSuffix;
      }
      if (stageTimeDisplay) {
        stageTimeDisplay.textContent = formatDuration(stageRemainingSec);
        stageTimeDisplay.classList.toggle('warn', stageRemainingSec > 0 && stageRemainingSec <= 60 && stageState === 'running');
        stageTimeDisplay.classList.toggle('done', stageRemainingSec === 0 || stageState === 'done');
      }
      if (stageProgressFill) {
        const pct = stageTotalSec > 0 ? (stageRemainingSec / stageTotalSec) * 100 : 0;
        stageProgressFill.style.width = Math.max(0, Math.min(100, pct)).toFixed(2) + '%';
        stageProgressFill.classList.toggle('warn', stageRemainingSec > 0 && stageRemainingSec <= 60 && stageState === 'running');
        stageProgressFill.classList.toggle('done', stageRemainingSec === 0 || stageState === 'done');
      }
      if (stageStartBtn) {
        stageStartBtn.textContent = stageState === 'running' ? '暂停' : stageState === 'paused' ? '继续' : '开始';
      }
    } else {
      updateStageTargetOrClock();
    }
  }

  function stageCountdownTick() {
    if (stageCfg.mode !== 'countdown' || stageState !== 'running' || !stageEndMs) return;
    const diff = Math.max(0, Math.ceil((stageEndMs - Date.now()) / 1000));
    stageRemainingSec = diff;
    renderStageDisplay();
    if (diff <= 0) {
      stopStageTicker();
      stageState = 'done';
      stageEndMs = null;
      renderStageDisplay();
      if (!stageMuted) {
        playTone([523.25, 659.25, 783.99, 1046.5]);
      }
    }
  }

  function applyStageModeUI(mode) {
    stageCfg.mode = mode;
    saveStageCfg();
    stopStageTicker();
    stageModeBtns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.stageMode === mode);
    });
    if (stageDurationGroup) stageDurationGroup.style.display = mode === 'countdown' ? 'flex' : 'none';
    if (stageTargetGroup) stageTargetGroup.style.display = mode === 'target' ? 'flex' : 'none';
    if (stageClockGroup) stageClockGroup.style.display = mode === 'clock' ? 'flex' : 'none';
    if (stageStartBtn) stageStartBtn.style.display = mode === 'countdown' ? 'inline-flex' : 'none';
    if (stageResetBtn) stageResetBtn.style.display = mode === 'countdown' ? 'inline-flex' : 'none';

    if (mode === 'countdown') {
      if (stageState === 'running' && stageEndMs) {
        stageTicker = setInterval(stageCountdownTick, 250);
      }
    } else {
      stageState = 'ready';
      stageEndMs = null;
      stageTicker = setInterval(updateStageTargetOrClock, 500);
    }
    renderStageDisplay();
  }

  function setStageMinutes(mins) {
    const safe = Math.max(1, Math.min(180, parseInt(mins, 10) || 10));
    stageCfg.minutes = safe;
    saveStageCfg();
    stopStageTicker();
    stageState = 'ready';
    stageEndMs = null;
    stageTotalSec = safe * 60;
    stageRemainingSec = stageTotalSec;
    if (stageMinInput) stageMinInput.value = safe;
    stageMinBtns.forEach(function (b) {
      b.classList.toggle('cecp-btn-primary', parseInt(b.dataset.stageMins, 10) === safe);
    });
    renderStageDisplay();
  }

  if (stageTitleInput) {
    stageTitleInput.value = stageCfg.title;
    stageTitleInput.addEventListener('input', function () {
      stageCfg.title = stageTitleInput.value;
      saveStageCfg();
      syncStageTexts();
    });
  }

  if (stageSubInput) {
    stageSubInput.value = stageCfg.subtitle;
    stageSubInput.addEventListener('input', function () {
      stageCfg.subtitle = stageSubInput.value;
      saveStageCfg();
      syncStageTexts();
    });
  }

  if (stageTargetInput) {
    stageTargetInput.value = stageCfg.targetTime || '14:40';
    stageTargetInput.addEventListener('change', function () {
      stageCfg.targetTime = stageTargetInput.value || '14:40';
      saveStageCfg();
      renderStageDisplay();
    });
  }

  stageModeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyStageModeUI(btn.dataset.stageMode);
    });
  });

  stagePresetBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const preset = STAGE_PRESETS[btn.dataset.stagePreset];
      if (!preset) return;
      stagePresetBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      stageCfg.badge = preset.badge;
      stageCfg.title = preset.title;
      stageCfg.subtitle = preset.subtitle;
      if (stageTitleInput) stageTitleInput.value = preset.title;
      if (stageSubInput) stageSubInput.value = preset.subtitle;
      setStageMinutes(preset.minutes);
      showToast('已切换：' + preset.badge);
    });
  });

  stageMinBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setStageMinutes(btn.dataset.stageMins);
    });
  });

  if (stageMinInput) {
    stageMinInput.value = stageCfg.minutes || 10;
    stageMinInput.addEventListener('input', function () {
      const val = parseInt(stageMinInput.value, 10);
      if (!isNaN(val) && val > 0) setStageMinutes(val);
    });
  }

  if (stageStartBtn) {
    stageStartBtn.addEventListener('click', function () {
      if (stageCfg.mode !== 'countdown') return;
      if (stageState === 'running') {
        stageCountdownTick();
        stopStageTicker();
        stageState = 'paused';
        stageEndMs = null;
        renderStageDisplay();
        return;
      }
      if (stageRemainingSec <= 0) stageRemainingSec = stageTotalSec;
      stageEndMs = Date.now() + stageRemainingSec * 1000;
      stageState = 'running';
      renderStageDisplay();
      stageTicker = setInterval(stageCountdownTick, 250);
    });
  }

  if (stageResetBtn) {
    stageResetBtn.addEventListener('click', function () {
      stopStageTicker();
      stageState = 'ready';
      stageEndMs = null;
      stageRemainingSec = stageTotalSec;
      renderStageDisplay();
    });
  }

  if (stageMuteBtn) {
    stageMuteBtn.addEventListener('click', function () {
      stageMuted = !stageMuted;
      stageMuteBtn.textContent = stageMuted ? '🔇 静音' : '🔊 音效';
    });
  }

  if (stagePureBtn) {
    stagePureBtn.addEventListener('click', enterPureMode);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('cecp-pure-mode')) {
      exitPureMode();
      return;
    }
    if (e.code === 'Space' && document.body.classList.contains('cecp-pure-mode')) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (panels.wheel && panels.wheel.classList.contains('show')) {
        e.preventDefault();
        spinWheel();
      } else if (panels.draw && panels.draw.classList.contains('show') && drawStartBtn && drawModeBox && drawModeBox.style.display !== 'none') {
        e.preventDefault();
        drawStartBtn.click();
      }
    }
  });

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && pureEnteredFullscreen) {
      pureEnteredFullscreen = false;
      document.body.classList.remove('cecp-pure-mode');
      refreshActiveWheel();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      if (stageCfg.mode === 'countdown' && stageState === 'running') {
        stageCountdownTick();
      } else if (stageCfg.mode !== 'countdown') {
        updateStageTargetOrClock();
      }
    }
  });

  setStageMinutes(stageCfg.minutes || 10);
  applyStageModeUI(stageCfg.mode || 'countdown');
  onSwitchCallbacks.stage = renderStageDisplay;

  // ---------- 6. 互动大转盘 + 彩带礼花 ----------
  const WHEEL_KEY = 'cecp_tool_wheel_v1';
  const WHEEL_COLORS = ['#2f81f7', '#d97706', '#10b981', '#8b5cf6', '#ef4444', '#0891b2', '#db2777', '#65a30d'];
  const WHEEL_PRESET_ICE = [
    '分享本周感恩的事',
    '带大家做个简短祷告',
    '分享一节喜欢的经文',
    '唱两句喜欢的赞美诗',
    '夸赞左边的一位朋友',
    '分享最近的小确幸',
    '指定一位朋友替你答',
    '幸运免过！直接过关'
  ];
  const WHEEL_PRESET_FOOD = ['火锅', '烤肉', '意面披萨', '拉面', '麻辣烫', '炒菜米饭', '汉堡薯条', '寿司日料'];

  const wheelCanvas = document.getElementById('cecpWheelCanvas');
  const wheelInput = document.getElementById('cecpWheelInput');
  const wheelCountEl = document.getElementById('cecpWheelCount');
  const wheelResultEl = document.getElementById('cecpWheelResult');
  const wheelSpinBtn = document.getElementById('cecpWheelSpinBtn');
  const wheelSpinBtn2 = document.getElementById('cecpWheelSpinBtn2');
  const wheelMuteBtn = document.getElementById('cecpWheelMuteBtn');
  const wheelFullscreenBtn = document.getElementById('cecpWheelFullscreenBtn');
  const wheelSyncDrawBtn = document.getElementById('cecpWheelSyncDrawBtn');
  const wheelPresetIceBtn = document.getElementById('cecpWheelPresetIceBtn');
  const wheelPresetFoodBtn = document.getElementById('cecpWheelPresetFoodBtn');
  const wheelRemoveWinner = document.getElementById('cecpWheelRemoveWinner');
  const confettiCanvas = document.getElementById('cecpConfettiCanvas');

  let wheelMuted = false;
  let wheelAngle = 0;
  let wheelSpinning = false;
  let wheelPendingRemoveIdx = -1;
  let wheelPendingTimer = null;

  function parseWheelItems() {
    if (!wheelInput) return [];
    return wheelInput.value
      .split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .slice(0, 32);
  }

  function getWinnerIndex(angle, count) {
    if (count <= 0) return 0;
    const TWO_PI = Math.PI * 2;
    const slice = TWO_PI / count;
    const norm = ((-Math.PI / 2 - angle) % TWO_PI + TWO_PI) % TWO_PI;
    return Math.floor(norm / slice) % count;
  }

  function playTickClick() {
    if (wheelMuted) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
      if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
      const now = sharedAudioCtx.currentTime;
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.022);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }

  function drawWheel() {
    if (!wheelCanvas) return;
    const items = parseWheelItems();
    if (wheelCountEl) wheelCountEl.textContent = items.length + ' 项';

    const parent = wheelCanvas.parentElement;
    const cssSize = (parent && parent.clientWidth > 60) ? parent.clientWidth : 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    wheelCanvas.width = cssSize * dpr;
    wheelCanvas.height = cssSize * dpr;

    const ctx = wheelCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const radius = cssSize / 2 - 4;

    if (items.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1f2024';
      ctx.fill();
      ctx.fillStyle = '#71717a';
      ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('请先输入选项', cx, cy);
      return;
    }

    const slice = (Math.PI * 2) / items.length;
    const scale = cssSize / 340;
    const baseFont = items.length > 16 ? 10 : items.length > 10 ? 12 : 14;
    const fontSize = Math.max(10, Math.round(baseFont * scale));

    items.forEach(function (label, i) {
      const start = wheelAngle + i * slice;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(20, 20, 22, 0.75)';
      ctx.stroke();

      const mid = start + slice / 2;
      const isLeftHalf = Math.cos(mid) < 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(isLeftHalf ? mid + Math.PI : mid);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 4;
      const shortText = label.length > 8 ? label.slice(0, 8) + '…' : label;
      const textRadius = radius * 0.62;
      ctx.fillText(shortText, isLeftHalf ? -textRadius : textRadius, 0, radius * 0.54);
      ctx.restore();
    });
  }

  let confettiRaf = null;
  function launchConfetti() {
    if (!confettiCanvas) return;
    if (confettiRaf) cancelAnimationFrame(confettiRaf);
    const ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    confettiCanvas.width = w;
    confettiCanvas.height = h;

    const colors = ['#f5cd79', '#2f81f7', '#34d399', '#fb7185', '#a78bfa', '#ffffff'];
    const pieces = Array.from({ length: 90 }, function () {
      return {
        x: w * (0.2 + Math.random() * 0.6),
        y: h * 0.35 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 11,
        vy: -Math.random() * 10 - 3,
        size: 5 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });

    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, w, h);
      pieces.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28;
        p.vx *= 0.99;
        p.rot += p.vRot;
        const alpha = elapsed > 1700 ? Math.max(0, 1 - (elapsed - 1700) / 700) : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (elapsed < 2400) {
        confettiRaf = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, w, h);
        confettiRaf = null;
      }
    }
    confettiRaf = requestAnimationFrame(step);
  }

  function applyPendingWinnerRemoval() {
    if (wheelPendingTimer) {
      clearTimeout(wheelPendingTimer);
      wheelPendingTimer = null;
    }
    if (wheelPendingRemoveIdx >= 0 && wheelInput) {
      const items = parseWheelItems();
      if (items.length > 1 && wheelPendingRemoveIdx < items.length) {
        items.splice(wheelPendingRemoveIdx, 1);
        wheelInput.value = items.join('\n');
        localStorage.setItem(WHEEL_KEY, wheelInput.value);
        drawWheel();
      }
      wheelPendingRemoveIdx = -1;
    }
  }

  function spinWheel() {
    if (wheelSpinning) return;
    applyPendingWinnerRemoval();

    const items = parseWheelItems();
    if (items.length < 2) {
      if (wheelResultEl) {
        wheelResultEl.classList.remove('has-winner');
        wheelResultEl.textContent = '至少需要 2 个选项才能转动转盘哦';
      }
      return;
    }

    wheelSpinning = true;
    if (wheelSpinBtn) wheelSpinBtn.disabled = true;
    if (wheelSpinBtn2) wheelSpinBtn2.disabled = true;
    if (wheelResultEl) {
      wheelResultEl.classList.remove('has-winner');
      wheelResultEl.textContent = '转盘转动中...';
    }

    const startAngle = wheelAngle;
    const extraTurns = (6 + Math.floor(Math.random() * 4)) * Math.PI * 2;
    const randomOffset = Math.random() * Math.PI * 2;
    const totalDelta = extraTurns + randomOffset;
    const duration = 4200;
    const startTs = performance.now();
    let lastSector = getWinnerIndex(startAngle, items.length);

    function frame(now) {
      const t = Math.min(1, (now - startTs) / duration);
      const ease = 1 - Math.pow(1 - t, 4);
      wheelAngle = startAngle + totalDelta * ease;
      drawWheel();

      const curSector = getWinnerIndex(wheelAngle, items.length);
      if (curSector !== lastSector) {
        lastSector = curSector;
        playTickClick();
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        wheelSpinning = false;
        if (wheelSpinBtn) wheelSpinBtn.disabled = false;
        if (wheelSpinBtn2) wheelSpinBtn2.disabled = false;

        const winIdx = getWinnerIndex(wheelAngle, items.length);
        const winner = items[winIdx];
        if (wheelResultEl) {
          wheelResultEl.textContent = '🎉 ' + winner;
          wheelResultEl.classList.remove('has-winner');
          void wheelResultEl.offsetWidth;
          wheelResultEl.classList.add('has-winner');
        }
        if (!wheelMuted) {
          playTone([523.25, 659.25, 783.99, 1046.5]);
        }
        launchConfetti();

        if (wheelRemoveWinner && wheelRemoveWinner.checked) {
          if (items.length > 1) {
            wheelPendingRemoveIdx = winIdx;
            wheelPendingTimer = setTimeout(applyPendingWinnerRemoval, 1200);
          } else if (wheelResultEl) {
            wheelResultEl.textContent = '🎉 ' + winner + '（已是最后一项）';
          }
        }
      }
    }

    requestAnimationFrame(frame);
  }

  if (wheelInput) {
    const savedWheel = localStorage.getItem(WHEEL_KEY);
    wheelInput.value = savedWheel !== null ? savedWheel : WHEEL_PRESET_ICE.join('\n');
    wheelInput.addEventListener('input', function () {
      wheelPendingRemoveIdx = -1;
      localStorage.setItem(WHEEL_KEY, wheelInput.value);
      drawWheel();
    });
  }

  if (wheelSpinBtn) wheelSpinBtn.addEventListener('click', spinWheel);
  if (wheelSpinBtn2) wheelSpinBtn2.addEventListener('click', spinWheel);

  if (wheelMuteBtn) {
    wheelMuteBtn.addEventListener('click', function () {
      wheelMuted = !wheelMuted;
      wheelMuteBtn.textContent = wheelMuted ? '🔇 静音' : '🔊 音效';
    });
  }

  if (wheelFullscreenBtn) {
    wheelFullscreenBtn.addEventListener('click', enterPureMode);
  }

  if (wheelSyncDrawBtn) {
    wheelSyncDrawBtn.addEventListener('click', function () {
      const names = parseNames();
      if (names.length === 0) {
        if (wheelResultEl) {
          wheelResultEl.classList.remove('has-winner');
          wheelResultEl.textContent = '抽签名单为空，请先在「抽签分组」填写名单';
        }
        return;
      }
      wheelInput.value = names.slice(0, 32).join('\n');
      localStorage.setItem(WHEEL_KEY, wheelInput.value);
      drawWheel();
      if (wheelResultEl) {
        wheelResultEl.classList.remove('has-winner');
        wheelResultEl.textContent = '已同步 ' + Math.min(names.length, 32) + ' 个抽签选项';
      }
      showToast('已同步 ' + Math.min(names.length, 32) + ' 个抽签选项');
    });
  }

  if (wheelPresetIceBtn) {
    wheelPresetIceBtn.addEventListener('click', function () {
      wheelInput.value = WHEEL_PRESET_ICE.join('\n');
      localStorage.setItem(WHEEL_KEY, wheelInput.value);
      drawWheel();
      showToast('已填入破冰互动预设');
    });
  }

  if (wheelPresetFoodBtn) {
    wheelPresetFoodBtn.addEventListener('click', function () {
      wheelInput.value = WHEEL_PRESET_FOOD.join('\n');
      localStorage.setItem(WHEEL_KEY, wheelInput.value);
      drawWheel();
      showToast('已填入今天吃什么预设');
    });
  }

  onSwitchCallbacks.wheel = refreshActiveWheel;
  window.addEventListener('resize', refreshActiveWheel);
  drawWheel();

  // ---------- 7. 机械翻页时钟 (Flip Clock) ----------
  const FLIP_KEY = 'cecp_tool_flip_v1';
  const flipStage = document.getElementById('cecpFlipStage');
  const flipHourCard = document.getElementById('cecpFlipHour');
  const flipMinCard = document.getElementById('cecpFlipMin');
  const flipSecCard = document.getElementById('cecpFlipSec');
  const flipSecSep = document.getElementById('cecpFlipSecSep');
  const flipAmPmEl = document.getElementById('cecpFlipAmPm');
  const flipDateEl = document.getElementById('cecpFlipDate');
  const flipFormatBtns = document.querySelectorAll('.cecp-sub-btn[data-flip-format]');
  const flipShowSecInput = document.getElementById('cecpFlipShowSec');
  const flipShowDateInput = document.getElementById('cecpFlipShowDate');
  const flipPureBtn = document.getElementById('cecpFlipPureBtn');

  let flipCfg = { is24h: true, showSeconds: true, showDate: true };
  try {
    const savedFlip = JSON.parse(localStorage.getItem(FLIP_KEY) || 'null');
    if (savedFlip && typeof savedFlip === 'object') {
      flipCfg = Object.assign(flipCfg, savedFlip);
    }
  } catch (e) {}

  let flipTicker = null;

  function saveFlipCfg() {
    localStorage.setItem(FLIP_KEY, JSON.stringify(flipCfg));
  }

  function setCardText(card, selector, value) {
    const el = card.querySelector(selector + ' .cecp-flip-num');
    if (el) el.textContent = value;
  }

  function updateFlipCard(card, nextVal, animate) {
    if (!card) return;
    const prevVal = card.dataset.val;
    if (prevVal === nextVal) return;

    if (card._flipTimer) {
      clearTimeout(card._flipTimer);
      card._flipTimer = null;
    }

    if (!animate || !prevVal) {
      card.classList.remove('flipping');
      setCardText(card, '.cecp-flip-top', nextVal);
      setCardText(card, '.cecp-flip-bottom', nextVal);
      setCardText(card, '.cecp-flip-leaf-top', nextVal);
      setCardText(card, '.cecp-flip-leaf-bottom', nextVal);
      card.dataset.val = nextVal;
      return;
    }

    card.classList.remove('flipping');
    setCardText(card, '.cecp-flip-top', nextVal);
    setCardText(card, '.cecp-flip-bottom', prevVal);
    setCardText(card, '.cecp-flip-leaf-top', prevVal);
    setCardText(card, '.cecp-flip-leaf-bottom', nextVal);
    void card.offsetWidth;
    card.classList.add('flipping');
    card.dataset.val = nextVal;

    card._flipTimer = setTimeout(function () {
      card.classList.remove('flipping');
      setCardText(card, '.cecp-flip-bottom', nextVal);
      setCardText(card, '.cecp-flip-leaf-top', nextVal);
      card._flipTimer = null;
    }, 490);
  }

  function applyFlipUI() {
    flipFormatBtns.forEach(function (b) {
      b.classList.toggle('active', (b.dataset.flipFormat === '24') === flipCfg.is24h);
    });
    if (flipShowSecInput) flipShowSecInput.checked = !!flipCfg.showSeconds;
    if (flipShowDateInput) flipShowDateInput.checked = !!flipCfg.showDate;
    if (flipStage) flipStage.classList.toggle('no-seconds', !flipCfg.showSeconds);
    if (flipSecCard) flipSecCard.style.display = flipCfg.showSeconds ? 'block' : 'none';
    if (flipSecSep) flipSecSep.style.display = flipCfg.showSeconds ? 'flex' : 'none';
    if (flipDateEl) flipDateEl.style.display = flipCfg.showDate ? 'block' : 'none';
    if (flipAmPmEl) flipAmPmEl.classList.toggle('show', !flipCfg.is24h);
  }

  function syncFlipClock(animate) {
    const now = new Date();
    let hours = now.getHours();
    const isPm = hours >= 12;
    if (!flipCfg.is24h) {
      hours = hours % 12 || 12;
    }
    const hh = String(hours).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    updateFlipCard(flipHourCard, hh, animate);
    updateFlipCard(flipMinCard, mm, animate);
    if (flipCfg.showSeconds) {
      updateFlipCard(flipSecCard, ss, animate);
    }
    if (flipAmPmEl) {
      flipAmPmEl.textContent = isPm ? 'PM' : 'AM';
    }
    if (flipDateEl && flipCfg.showDate) {
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      flipDateEl.textContent = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · ' + weekdays[now.getDay()];
    }
  }

  function startFlipClock() {
    stopFlipClock();
    syncFlipClock(false);
    flipTicker = setInterval(function () {
      syncFlipClock(true);
    }, 250);
  }

  function stopFlipClock() {
    if (flipTicker) {
      clearInterval(flipTicker);
      flipTicker = null;
    }
  }

  flipFormatBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      flipCfg.is24h = btn.dataset.flipFormat === '24';
      saveFlipCfg();
      applyFlipUI();
      syncFlipClock(false);
    });
  });

  if (flipShowSecInput) {
    flipShowSecInput.addEventListener('change', function () {
      flipCfg.showSeconds = flipShowSecInput.checked;
      saveFlipCfg();
      applyFlipUI();
      syncFlipClock(false);
    });
  }

  if (flipShowDateInput) {
    flipShowDateInput.addEventListener('change', function () {
      flipCfg.showDate = flipShowDateInput.checked;
      saveFlipCfg();
      applyFlipUI();
      syncFlipClock(false);
    });
  }

  if (flipPureBtn) {
    flipPureBtn.addEventListener('click', enterPureMode);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && panels.flip && panels.flip.classList.contains('show')) {
      syncFlipClock(false);
    }
  });

  applyFlipUI();
  onSwitchCallbacks.flip = startFlipClock;
  onLeaveCallbacks.flip = stopFlipClock;

  // ---------- 8. 现场氛围音效板 (Web Audio API 立体声混响合成引擎) ----------
  const SOUND_VOL_KEY = 'cecp_tool_soundvol_v1';
  const soundGrid = document.getElementById('cecpSoundGrid');
  const soundVolSlider = document.getElementById('cecpSoundVol');
  const soundVolVal = document.getElementById('cecpSoundVolVal');
  const soundStopBtn = document.getElementById('cecpSoundStopBtn');
  const soundPureBtn = document.getElementById('cecpSoundPureBtn');

  let soundMasterGain = null;
  let soundDryGain = null;
  let soundWetGain = null;
  let soundReverbNode = null;
  let soundCompressor = null;
  const APPLAUSE_AUDIO_SRC = './asset/audio/applause.m4a';
  const APPLAUSE_DURATION_MS = 4000;
  let whiteNoiseBuf = null;
  let pinkNoiseBuf = null;
  let activeSfxNodes = [];
  let activeSfxTimers = [];
  let activeSfxAudios = [];
  let applausePreloaded = false;
  let soundVolume = 0.8;

  function preloadSoundSamples() {
    if (applausePreloaded) return;
    applausePreloaded = true;
    try {
      const pre = new Audio(APPLAUSE_AUDIO_SRC);
      pre.preload = 'auto';
      pre.load();
    } catch (e) {}
  }

  try {
    const savedVol = parseInt(localStorage.getItem(SOUND_VOL_KEY) || '', 10);
    if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 100) {
      soundVolume = savedVol / 100;
    }
  } catch (e) {}

  function buildHallImpulse(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 2.6);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.62 + white * 0.38;
        data[i] = lp * decay * 0.7;
      }
    }
    return ir;
  }

  function ensureNoiseBuffers(ctx) {
    if (!whiteNoiseBuf) {
      const len = Math.floor(ctx.sampleRate * 2);
      whiteNoiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const wData = whiteNoiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        wData[i] = Math.random() * 2 - 1;
      }
    }
    if (!pinkNoiseBuf) {
      const len = Math.floor(ctx.sampleRate * 2.5);
      pinkNoiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const pData = pinkNoiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
  }

  function ensureSoundBus() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
    ensureNoiseBuffers(sharedAudioCtx);

    if (!soundMasterGain) {
      soundMasterGain = sharedAudioCtx.createGain();
      soundMasterGain.gain.value = soundVolume;

      soundCompressor = sharedAudioCtx.createDynamicsCompressor();
      soundCompressor.threshold.value = -14;
      soundCompressor.knee.value = 18;
      soundCompressor.ratio.value = 6;
      soundCompressor.attack.value = 0.004;
      soundCompressor.release.value = 0.16;

      soundDryGain = sharedAudioCtx.createGain();
      soundDryGain.gain.value = 1.0;

      soundWetGain = sharedAudioCtx.createGain();
      soundWetGain.gain.value = 0.34;

      soundReverbNode = sharedAudioCtx.createConvolver();
      soundReverbNode.buffer = buildHallImpulse(sharedAudioCtx, 1.55);

      soundDryGain.connect(soundMasterGain);
      soundWetGain.connect(soundReverbNode);
      soundReverbNode.connect(soundMasterGain);
      soundMasterGain.connect(soundCompressor);
      soundCompressor.connect(sharedAudioCtx.destination);
    }
    return sharedAudioCtx;
  }

  function trackNode(node) {
    activeSfxNodes.push(node);
    return node;
  }

  function connectVoice(ctx, node, pan, wetSend) {
    let out = node;
    if (typeof ctx.createStereoPanner === 'function' && pan) {
      const panner = trackNode(ctx.createStereoPanner());
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      out = panner;
    }
    out.connect(soundDryGain);
    if (wetSend > 0) {
      const send = trackNode(ctx.createGain());
      send.gain.value = wetSend;
      out.connect(send);
      send.connect(soundWetGain);
    }
  }

  function playBellVoice(ctx, freq, startTime, dur, vol, pan, wet, partials) {
    const list = partials || [
      [1, 1.0, 1.0],
      [2, 0.35, 0.55],
      [3.98, 0.14, 0.3]
    ];
    list.forEach(function (p) {
      const osc = trackNode(ctx.createOscillator());
      const g = trackNode(ctx.createGain());
      const pDur = Math.max(0.06, dur * p[2]);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * p[0], startTime);
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * p[1]), startTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + pDur);
      osc.connect(g);
      connectVoice(ctx, g, pan, wet);
      osc.start(startTime);
      osc.stop(startTime + pDur + 0.03);
    });
  }

  function stopAllSfx(quiet) {
    activeSfxTimers.forEach(function (id) {
      clearTimeout(id);
    });
    activeSfxTimers = [];
    activeSfxAudios.forEach(function (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {}
    });
    activeSfxAudios = [];
    activeSfxNodes.forEach(function (node) {
      try { if (node.stop) node.stop(); } catch (e) {}
      try { node.disconnect(); } catch (e) {}
    });
    activeSfxNodes = [];
    if (soundGrid) {
      soundGrid.querySelectorAll('.cecp-sound-pad').forEach(function (p) {
        p.classList.remove('playing');
        if (p.dataset.origName) {
          const nameEl = p.querySelector('.cecp-pad-name');
          if (nameEl) nameEl.textContent = p.dataset.origName;
        }
      });
    }
    if (!quiet) showToast('已停止全部音效');
  }

  function markPadPlaying(pad, durationMs) {
    if (!pad) return;
    pad.classList.remove('playing');
    void pad.offsetWidth;
    pad.classList.add('playing');
    const id = setTimeout(function () {
      pad.classList.remove('playing');
    }, durationMs);
    activeSfxTimers.push(id);
  }

  function playSfx(type, pad) {
    if (type === 'applause') {
      while (activeSfxAudios.length >= 3) {
        const oldest = activeSfxAudios.shift();
        if (oldest && typeof oldest._cecpCleanup === 'function') {
          oldest._cecpCleanup(true);
        }
      }
      try {
        const audio = new Audio(APPLAUSE_AUDIO_SRC);
        audio.volume = Math.max(0, Math.min(1, soundVolume));
        let cleaned = false;
        let safetyTimer = null;

        const cleanupAudio = function (skipPadClass) {
          if (cleaned) return;
          cleaned = true;
          if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
          }
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (e) {}
          const idx = activeSfxAudios.indexOf(audio);
          if (idx !== -1) activeSfxAudios.splice(idx, 1);
          if (!skipPadClass && pad && activeSfxAudios.length === 0) {
            pad.classList.remove('playing');
          }
        };

        audio._cecpCleanup = cleanupAudio;
        activeSfxAudios.push(audio);

        if (pad) {
          pad.classList.remove('playing');
          void pad.offsetWidth;
          pad.classList.add('playing');
        }

        audio.addEventListener('ended', function () {
          cleanupAudio(false);
        }, { once: true });
        audio.addEventListener('error', function () {
          cleanupAudio(false);
        }, { once: true });

        safetyTimer = setTimeout(function () {
          cleanupAudio(false);
        }, APPLAUSE_DURATION_MS + 400);
        activeSfxTimers.push(safetyTimer);

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {
            cleanupAudio(false);
            showToast('掌声音频加载失败，请确认已上传 asset/audio/applause.m4a');
          });
        }
      } catch (e) {
        showToast('掌声音频加载失败，请确认已上传 asset/audio/applause.m4a');
      }
      return;
    }

    const ctx = ensureSoundBus();
    if (!ctx || !soundMasterGain) return;
    const now = ctx.currentTime;

    if (type === 'drumroll') {
      let offset = 0;
      const hits = 34;
      for (let i = 0; i < hits; i++) {
        const p = i / hits;
        const step = 0.115 - p * 0.076;
        const t = now + offset;
        offset += step;
        const pan = (i % 2 === 0 ? -0.18 : 0.18);
        const amp = 0.11 + p * 0.24;

        // 军鼓沙带脆响
        const snSrc = trackNode(ctx.createBufferSource());
        snSrc.buffer = whiteNoiseBuf;
        const bp = trackNode(ctx.createBiquadFilter());
        bp.type = 'bandpass';
        bp.frequency.value = 2200 + (Math.random() - 0.5) * 500;
        bp.Q.value = 0.9;
        const snGain = trackNode(ctx.createGain());
        snGain.gain.setValueAtTime(0.0001, t);
        snGain.gain.exponentialRampToValueAtTime(amp, t + 0.003);
        snGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
        snSrc.connect(bp);
        bp.connect(snGain);
        connectVoice(ctx, snGain, pan, 0.35);
        snSrc.start(t, Math.random() * 1.2, 0.075);
        snSrc.stop(t + 0.08);

        // 紧凑鼓腔共鸣
        const bodyOsc = trackNode(ctx.createOscillator());
        const bodyGain = trackNode(ctx.createGain());
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(185, t);
        bodyOsc.frequency.exponentialRampToValueAtTime(132, t + 0.042);
        bodyGain.gain.setValueAtTime(amp * 0.55, t);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        bodyOsc.connect(bodyGain);
        connectVoice(ctx, bodyGain, pan, 0.25);
        bodyOsc.start(t);
        bodyOsc.stop(t + 0.055);
      }

      // 收尾重拍 + 多泛音金属吊镲
      const crashTime = now + offset + 0.03;
      const kick = trackNode(ctx.createOscillator());
      const kickG = trackNode(ctx.createGain());
      kick.type = 'sine';
      kick.frequency.setValueAtTime(140, crashTime);
      kick.frequency.exponentialRampToValueAtTime(52, crashTime + 0.18);
      kickG.gain.setValueAtTime(0.45, crashTime);
      kickG.gain.exponentialRampToValueAtTime(0.0001, crashTime + 0.28);
      kick.connect(kickG);
      connectVoice(ctx, kickG, 0, 0.35);
      kick.start(crashTime);
      kick.stop(crashTime + 0.3);

      const crashHp = trackNode(ctx.createBiquadFilter());
      crashHp.type = 'highpass';
      crashHp.frequency.value = 3800;
      const crashNoise = trackNode(ctx.createBufferSource());
      crashNoise.buffer = whiteNoiseBuf;
      const crashGain = trackNode(ctx.createGain());
      crashGain.gain.setValueAtTime(0.28, crashTime);
      crashGain.gain.exponentialRampToValueAtTime(0.0001, crashTime + 1.35);
      crashNoise.connect(crashHp);
      crashHp.connect(crashGain);
      connectVoice(ctx, crashGain, 0, 0.65);
      crashNoise.start(crashTime, 0, 1.4);
      crashNoise.stop(crashTime + 1.4);

      [296, 391, 523, 681, 862, 1140].forEach(function (cf) {
        const mOsc = trackNode(ctx.createOscillator());
        const mBp = trackNode(ctx.createBiquadFilter());
        const mG = trackNode(ctx.createGain());
        mOsc.type = 'square';
        mOsc.frequency.value = cf;
        mBp.type = 'highpass';
        mBp.frequency.value = 2600;
        mG.gain.setValueAtTime(0.035, crashTime);
        mG.gain.exponentialRampToValueAtTime(0.0001, crashTime + 1.15);
        mOsc.connect(mBp);
        mBp.connect(mG);
        connectVoice(ctx, mG, 0, 0.6);
        mOsc.start(crashTime);
        mOsc.stop(crashTime + 1.2);
      });

      markPadPlaying(pad, (offset + 1.35) * 1000);
      return;
    }

    if (type === 'fanfare') {
      // 温暖双失谐铜管齐奏 + 结尾定音鼓
      const brassNotes = [
        { freq: 392.00, t: 0.00, dur: 0.14, pan: -0.15 },
        { freq: 523.25, t: 0.13, dur: 0.14, pan: 0.15 },
        { freq: 659.25, t: 0.26, dur: 0.15, pan: -0.15 },
        { freq: 783.99, t: 0.41, dur: 1.05, pan: 0 },
        { freq: 523.25, t: 0.41, dur: 1.05, pan: -0.35 },
        { freq: 659.25, t: 0.41, dur: 1.05, pan: 0.35 },
        { freq: 1046.5, t: 0.41, dur: 1.05, pan: 0 }
      ];
      brassNotes.forEach(function (n) {
        [-6, 6].forEach(function (detuneCents) {
          const osc = trackNode(ctx.createOscillator());
          const filter = trackNode(ctx.createBiquadFilter());
          const g = trackNode(ctx.createGain());
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(n.freq, now + n.t);
          osc.detune.value = detuneCents;

          filter.type = 'lowpass';
          filter.Q.value = 1.4;
          filter.frequency.setValueAtTime(480, now + n.t);
          filter.frequency.exponentialRampToValueAtTime(2900, now + n.t + 0.055);
          filter.frequency.exponentialRampToValueAtTime(1550, now + n.t + n.dur);

          g.gain.setValueAtTime(0.0001, now + n.t);
          g.gain.exponentialRampToValueAtTime(0.085, now + n.t + 0.032);
          g.gain.setValueAtTime(0.075, now + n.t + n.dur * 0.65);
          g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.dur);

          osc.connect(filter);
          filter.connect(g);
          connectVoice(ctx, g, n.pan, 0.48);
          osc.start(now + n.t);
          osc.stop(now + n.t + n.dur + 0.05);
        });
      });

      const timp = trackNode(ctx.createOscillator());
      const timpG = trackNode(ctx.createGain());
      timp.type = 'sine';
      timp.frequency.setValueAtTime(130.81, now + 0.41);
      timp.frequency.exponentialRampToValueAtTime(65.41, now + 0.72);
      timpG.gain.setValueAtTime(0.32, now + 0.41);
      timpG.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      timp.connect(timpG);
      connectVoice(ctx, timpG, 0, 0.4);
      timp.start(now + 0.41);
      timp.stop(now + 1.0);

      markPadPlaying(pad, 1500);
      return;
    }

    if (type === 'correct') {
      [
        { freq: 659.25, t: 0.00, dur: 0.35, pan: -0.25 },
        { freq: 830.61, t: 0.07, dur: 0.40, pan: -0.05 },
        { freq: 987.77, t: 0.14, dur: 0.50, pan: 0.15 },
        { freq: 1318.5, t: 0.21, dur: 0.75, pan: 0.3 }
      ].forEach(function (n) {
        playBellVoice(ctx, n.freq, now + n.t, n.dur, 0.2, n.pan, 0.42);
      });
      markPadPlaying(pad, 950);
      return;
    }

    if (type === 'wrong') {
      // 综艺趣味 muted trombone "wah-wahh"
      const notes = [
        { f1: 155.56, f2: 146.83, t: 0.00, dur: 0.22 },
        { f1: 130.81, f2: 110.00, t: 0.24, dur: 0.52 }
      ];
      notes.forEach(function (n) {
        const osc = trackNode(ctx.createOscillator());
        const lp = trackNode(ctx.createBiquadFilter());
        const g = trackNode(ctx.createGain());
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f1, now + n.t);
        osc.frequency.exponentialRampToValueAtTime(n.f2, now + n.t + n.dur);

        lp.type = 'lowpass';
        lp.Q.value = 3.2;
        lp.frequency.setValueAtTime(620, now + n.t);
        lp.frequency.exponentialRampToValueAtTime(280, now + n.t + n.dur);

        g.gain.setValueAtTime(0.0001, now + n.t);
        g.gain.exponentialRampToValueAtTime(0.22, now + n.t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.dur);

        osc.connect(lp);
        lp.connect(g);
        connectVoice(ctx, g, 0, 0.28);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.dur + 0.04);
      });
      markPadPlaying(pad, 800);
      return;
    }

    if (type === 'dingdong') {
      // 教堂 / 礼堂管钟提示音
      const bellPartials = [
        [1.0, 1.0, 1.0],
        [2.0, 0.38, 0.62],
        [2.76, 0.2, 0.4],
        [4.07, 0.09, 0.24]
      ];
      playBellVoice(ctx, 783.99, now, 0.95, 0.25, -0.15, 0.55, bellPartials);
      playBellVoice(ctx, 659.25, now + 0.36, 1.35, 0.26, 0.15, 0.58, bellPartials);
      markPadPlaying(pad, 1650);
      return;
    }

    if (type === 'countdown321') {
      const nameEl = pad ? pad.querySelector('.cecp-pad-name') : null;
      if (pad && nameEl && !pad.dataset.origName) {
        pad.dataset.origName = nameEl.textContent;
      }

      [0, 0.72, 1.44].forEach(function (tOffset, idx) {
        const labels = ['3...', '2...', '1...'];
        const t = now + tOffset;
        playBellVoice(ctx, 440, t, 0.28, 0.2, 0, 0.3, [[1, 1, 1], [2, 0.25, 0.4]]);
        const wood = trackNode(ctx.createOscillator());
        const wg = trackNode(ctx.createGain());
        wood.type = 'sine';
        wood.frequency.setValueAtTime(980, t);
        wood.frequency.exponentialRampToValueAtTime(580, t + 0.035);
        wg.gain.setValueAtTime(0.24, t);
        wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        wood.connect(wg);
        connectVoice(ctx, wg, 0, 0.18);
        wood.start(t);
        wood.stop(t + 0.06);
        if (nameEl) {
          activeSfxTimers.push(setTimeout(function () {
            nameEl.textContent = labels[idx];
          }, tOffset * 1000));
        }
      });

      const goT = now + 2.16;
      [880, 1108.73, 1318.51].forEach(function (f, idx) {
        playBellVoice(ctx, f, goT, 0.75, 0.18, (idx - 1) * 0.35, 0.5);
      });
      if (nameEl) {
        activeSfxTimers.push(setTimeout(function () {
          nameEl.textContent = 'GO!';
        }, 2160));
        if (pad.dataset.origName) {
          activeSfxTimers.push(setTimeout(function () {
            nameEl.textContent = pad.dataset.origName;
          }, 2900));
        }
      }
      markPadPlaying(pad, 2850);
      return;
    }

    if (type === 'wow') {
      const arp = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5, 1567.98];
      arp.forEach(function (freq, idx) {
        const pan = -0.7 + (idx / (arp.length - 1)) * 1.4;
        playBellVoice(ctx, freq, now + idx * 0.055, 0.75, 0.16, pan, 0.55);
      });
      launchConfetti();
      markPadPlaying(pad, 1200);
    }
  }

  if (soundVolSlider) {
    soundVolSlider.value = Math.round(soundVolume * 100);
    if (soundVolVal) soundVolVal.textContent = Math.round(soundVolume * 100) + '%';
    soundVolSlider.addEventListener('input', function () {
      const pct = parseInt(soundVolSlider.value, 10) || 0;
      soundVolume = Math.max(0, Math.min(1, pct / 100));
      localStorage.setItem(SOUND_VOL_KEY, String(pct));
      if (soundVolVal) soundVolVal.textContent = pct + '%';
      if (soundMasterGain && sharedAudioCtx) {
        soundMasterGain.gain.setTargetAtTime(soundVolume, sharedAudioCtx.currentTime, 0.02);
      }
      activeSfxAudios.forEach(function (a) {
        a.volume = soundVolume;
      });
    });
  }

  onSwitchCallbacks.sound = preloadSoundSamples;
  if (panels.sound && panels.sound.classList.contains('show')) {
    preloadSoundSamples();
  }

  if (soundGrid) {
    soundGrid.addEventListener('click', function (e) {
      const pad = e.target.closest('.cecp-sound-pad');
      if (!pad) return;
      playSfx(pad.dataset.sfx, pad);
    });
  }

  if (soundStopBtn) {
    soundStopBtn.addEventListener('click', function () {
      stopAllSfx(false);
    });
  }

  if (soundPureBtn) {
    soundPureBtn.addEventListener('click', enterPureMode);
  }

  document.addEventListener('keydown', function (e) {
    if (!panels.sound || !panels.sound.classList.contains('show')) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key >= '1' && e.key <= '8') {
      const pads = soundGrid ? soundGrid.querySelectorAll('.cecp-sound-pad') : [];
      const pad = pads[parseInt(e.key, 10) - 1];
      if (pad) {
        e.preventDefault();
        playSfx(pad.dataset.sfx, pad);
      }
    } else if (e.key === '0') {
      e.preventDefault();
      stopAllSfx(false);
    }
  });
})();
