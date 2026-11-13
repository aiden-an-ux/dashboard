(function () {
  const loaders = {}, calcs = {}, draws = {}, data = {}, onDataFns = [];
  const DEFAULTS = { sgroup: '전체', hmrow: '채널', axis: '상품' };
  const FILES = { funnel: 'data/funnel.csv', targets: 'data/targets.csv', activities: 'data/activities.csv' };
  let params = { ...DEFAULTS };
  let queued = false;
  const runOne = (name, el) => {
    if (el.closest('[hidden]')) return;
    const fn = draws[name];
    if (!fn) return;
    try { fn(el); } catch (e) { console.error('draw ' + name, e); }
  };
  const render = () => {
    queued = false;
    for (const fn of onDataFns) { try { fn(); } catch (e) { console.error(e); } }
    document.querySelectorAll('[data-draw]').forEach((el) => runOne(el.dataset.draw, el));
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  window.dash = {
    colors: ['#28A65B', '#2F6FD8', '#F2994A', '#8E5BD8', '#E0567A', '#1FA3B8', '#B8860B', '#6B7C80'],
    loader: (id, o) => { loaders[id] = o; },
    calc: (id, o) => { calcs[id] = o; },
    draw: (name, fn) => {
      if (fn) { draws[name] = fn; return; }
      document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => runOne(name, el));
    },
    data: (id) => (id in data ? { status: 'ok', data: data[id] } : { status: 'loading', data: [] }),
    params: () => ({ ...params }),
    setParams: (o) => { for (const [k, v] of Object.entries(o)) { if (v == null) delete params[k]; else params[k] = String(v); } schedule(); },
    resetParams: () => { params = { ...DEFAULTS }; schedule(); },
    onData: (fn) => { onDataFns.push(fn); },
    setLink: (id) => { try { history.replaceState(null, '', '#' + id); } catch (e) {} schedule(); },
  };
  const status = (msg, isErr) => {
    const el = document.getElementById('load-status');
    if (!el) return;
    el.hidden = !msg; el.textContent = msg || ''; el.classList.toggle('is-error', !!isErr);
  };
  window.__dashBoot = async () => {
    if (location.protocol === 'file:') {
      status('이 파일은 웹서버에 올려서 열어야 합니다. 내 PC에서 더블클릭으로 열면 브라우저 보안 때문에 data 폴더의 파일을 읽지 못합니다. (README 참고)', true);
      return;
    }
    status('데이터를 불러오는 중입니다…');
    const v = Date.now();
    try {
      for (const [id, path] of Object.entries(FILES)) {
        const res = await fetch(`${path}?v=${v}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${path} 파일을 찾을 수 없습니다 (${res.status}).`);
        const out = loaders[id].fn({ answer: await res.text() });
        data[id] = Array.isArray(out) ? out : out.rows;
      }
    } catch (e) {
      status('데이터를 불러오지 못했습니다. ' + e.message, true);
      console.error(e);
      return;
    }
    let pending = Object.keys(calcs), guard = 0;
    while (pending.length && guard++ < 20) {
      pending = pending.filter((id) => {
        const c = calcs[id];
        if (!c.inputs.every((i) => i in data)) return true;
        try { data[id] = c.fn(...c.inputs.map((i) => data[i])); } catch (e) { console.error('calc ' + id, e); data[id] = []; }
        return false;
      });
    }
    status('');
    render();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(schedule, 150); });
  };
})();
