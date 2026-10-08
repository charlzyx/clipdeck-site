// 只为同页导航增强焦点；基础导航在禁用 JavaScript 时仍可使用。
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});

// 切换真实界面截图，使用原生按钮保留键盘操作与选中状态。
const viewSwitch = document.querySelector('.view-switch');
if (viewSwitch) {
  viewSwitch.hidden = false;
  const titles = { history: '每次复制，都在这里。', editor: '截图之后，顺手标注。' };
  viewSwitch.querySelectorAll('button[data-show]').forEach(button => {
    button.addEventListener('click', () => {
      const selected = button.dataset.show;
      document.querySelectorAll('[data-view]').forEach(view => {
        view.hidden = view.dataset.view !== selected;
      });
      viewSwitch.querySelectorAll('button[data-show]').forEach(control => {
        control.setAttribute('aria-pressed', String(control.dataset.show === selected));
      });
      document.getElementById('showcase-title').textContent = titles[selected];
    });
  });
}

// 装饰效果按需加载；静态壁纸始终保留，内容与交互不依赖 GPU。
const wallpaper = document.querySelector('.showcase-wallpaper');
if (wallpaper && 'IntersectionObserver' in window) {
  const canvas = wallpaper.querySelector('canvas');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const constrainedDevice = navigator.connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let shader;
  let visible = false;
  let loading = false;
  let failed = false;
  let ended = false;

  const stop = () => {
    canvas.removeAttribute('data-ready');
    shader?.destroy();
    shader = undefined;
  };
  const sync = async () => {
    const active = visible && !document.hidden && !reducedMotion.matches && !ended;
    if (!active) {
      shader?.pause();
      return;
    }
    if (shader) {
      shader.resume();
      return;
    }
    if (loading || failed || constrainedDevice || !navigator.gpu) return;
    loading = true;
    try {
      const { createShader, getWebGPUSupport } = await import('./assets/vendor/shaders-4.0.2.js');
      const support = await getWebGPUSupport();
      if (!support.supported) {
        failed = true;
        return;
      }
      if (ended || reducedMotion.matches || !visible || document.hidden) return;
      shader = await createShader(canvas, {
        components: [{ type: 'Swirl', props: {
          colorA: '#f7fcff', colorB: '#bddff5', speed: 0.12, detail: 0.8, blend: 35
        } }]
      }, {
        disableTelemetry: true,
        onReady: () => { if (!ended && !reducedMotion.matches) canvas.dataset.ready = 'true'; },
        onError: () => { canvas.removeAttribute('data-ready'); failed = true; }
      });
      if (ended || reducedMotion.matches || failed) stop();
      else if (!visible || document.hidden) shader.pause();
    } catch {
      failed = true;
      stop();
    } finally {
      loading = false;
    }
  };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  });
  observer.observe(wallpaper);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) stop();
    else sync();
  });
  window.addEventListener('pagehide', () => {
    ended = true;
    stop();
  });
  window.addEventListener('pageshow', () => {
    ended = false;
    sync();
  });
}
