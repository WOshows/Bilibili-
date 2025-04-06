+'use strict';

const CONFIG = {
  TIMEOUT: 5000,
  RAINBOW_COLORS: [
    '#FB7299 0deg',
    '#FF9B6C 40deg',
    '#FFCC33 80deg',
    '#ABE05A 120deg',
    '#00BBCC 160deg',
    '#00A1E9 200deg',
    '#3978F6 240deg',
    '#925EF6 280deg',
    '#D85FF6 320deg',
    '#FB7299 360deg'
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initProgressRing();
  setupEventListeners();
  setTimeout(loadData, 300);
});

function initProgressRing() {
  const style = document.createElement('style');
  style.textContent = `
    .bili-progress-ring {
      position: relative;
      width: 160px;
      height: 160px;
      margin: 0 auto 15px;
      border-radius: 50%;
      background: 
        /* 时间刻度背景 */
        conic-gradient(
          rgba(200, 200, 200, 0.15) 0% 2%,
          transparent 2% 98%,
          rgba(200, 200, 200, 0.15) 98% 100%
        ),
        linear-gradient(145deg, #f8f9fc, #f0f2f7);
      box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.08),
        inset 0 4px 12px rgba(255, 255, 255, 0.9);
    }

    .bili-progress-mask {
      position: absolute;
      inset: 0;
      --progress: 0;
      --p: calc(var(--progress) * 3.6deg);
      background: conic-gradient(from -90deg, ${CONFIG.RAINBOW_COLORS.join(', ')});
      mask: 
        /* 实线进度条遮罩 */
        conic-gradient(#000 var(--p), transparent var(--p)) content-box,
        radial-gradient(transparent 55%, #fff 55%);
      -webkit-mask: 
        conic-gradient(#000 var(--p), transparent var(--p)) content-box,
        radial-gradient(transparent 55%, #fff 55%);
      border-radius: 50%;
      padding: 4px;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
    }

    .bili-percentage {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 36px;
      color: #ffffff;
      font-weight: 700;
      text-shadow: 
        0 2px 8px rgba(0, 0, 0, 0.2),
        0 0 16px rgba(255, 255, 255, 0.4);
      font-family: 'Orbitron', sans-serif;
      z-index: 2;
    }
  `;
  document.head.appendChild(style);
}

function setupEventListeners() {
  document.getElementById('refresh-button').addEventListener('click', loadData);
}

function loadData() {
  setDebugInfo('正在获取数据...');
  
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!validateTab(tab)) return;

    const timeoutId = setTimeout(() => {
      setDebugInfo('请求超时，请重试');
    }, CONFIG.TIMEOUT);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageData
    }, results => {
      clearTimeout(timeoutId);
      handleDataResults(results);
    });
  });
}

function extractPageData() {
  try {
    const items = Array.from(document.querySelectorAll('.video-pod__list .simple-base-item'));
    const durations = Array.from(document.querySelectorAll('.video-pod__list .stat-item.duration'));
    const activeIndex = items.findIndex(item => item.classList.contains('active'));

    let total = 0;
    let watched = 0;
    const videoItems = items.map((item, index) => {
      const duration = parseDuration(durations[index]?.textContent);
      total += duration;
      if (index < activeIndex) watched += duration;
      return { duration };
    });

    const data = {
      total,
      watched,
      currentIndex: activeIndex,
      items: videoItems
    };

    return data;
  } catch (error) {
    return { error: error.message };
  }

  function parseDuration(text) {
    const parts = text?.split(':') || [];
    return parts.reverse().reduce((sum, val, i) => sum + parseInt(val) * Math.pow(60, i), 0);
  }
}

function updateUI(data) {
  if (!data || !data.items) {
    setDebugInfo('无效数据格式');
    return;
  }
  const percentage = data.total ? Math.round((data.watched / data.total) * 100) : 0;
  
  const mask = document.querySelector('.bili-progress-mask');
  if (mask) mask.style.setProperty('--progress', percentage);

  document.querySelector('.bili-percentage').textContent = `${percentage}%`;

  const format = seconds => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  document.getElementById('total-duration').textContent = format(data.total);
  document.getElementById('watched-duration').textContent = format(data.watched);
  document.getElementById('remaining-duration').textContent = format(data.total - data.watched);
}

function validateTab(tab) {
  if (!tab?.url?.includes('bilibili.com')) {
    setDebugInfo('请在B站页面使用');
    return false;
  }
  return true;
}

function handleDataResults(results) {
  const data = results?.[0]?.result;
  if (data?.error) {
    setDebugInfo(`错误: ${data.error}`);
    return;
  }
  updateUI(data);
  setDebugInfo(`更新于 ${new Date().toLocaleTimeString()}`);
}

function setDebugInfo(text) {
  const debugEl = document.getElementById('debug-info');
  debugEl.innerHTML = `
    <div class="loading">⏳</div>
    ${text}
  `;
} 