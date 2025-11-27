import { fmtMoney, toast } from '/utils/helpers.js';
import { parseDateStr, isoWeekKey } from '../utils/dateUtils.js';

let householdRefRef;
let firebaseFns;
let summaryStatsRef;
let updateSummaryUIFn = () => {};

const dom = {};
const selectors = {
  analyticsView: '#analyticsView',
  tabDay: '#tabDay',
  tabWeek: '#tabWeek',
  tabMonth: '#tabMonth',
  tabItem: '#tabItem',
  secDay: '#secDay',
  secWeek: '#secWeek',
  secMonth: '#secMonth',
  secItem: '#secItem',
  chartDay: '#chartDay',
  chartWeek: '#chartWeek',
  chartMonth: '#chartMonth',
  chartItem: '#chartItem',
  dayAccordion: '#dayAccordion'
};

const chartInstances = {
  day: null,
  week: null,
  month: null,
  item: null
};

const unsubscribers = {
  day: null,
  week: null,
  month: null,
  item: null
};

export function initAnalytics({
  householdRef,
  firebase,
  summaryStats,
  updateSummaryUI
}) {
  householdRefRef = householdRef;
  firebaseFns = firebase;
  summaryStatsRef = summaryStats;
  updateSummaryUIFn = updateSummaryUI || (() => {});

  cacheDom();
  bindEvents();

  return {
    showDefault: () => {
      setActiveTab('day');
      buildDayChart();
    },
    teardown: cleanupAll
  };
}

function cacheDom() {
  Object.entries(selectors).forEach(([key, selector]) => {
    dom[key] = document.querySelector(selector);
  });
}

function bindEvents() {
  dom.tabDay?.addEventListener('click', () => handleTabClick('day'));
  dom.tabWeek?.addEventListener('click', () => handleTabClick('week'));
  dom.tabMonth?.addEventListener('click', () => handleTabClick('month'));
  dom.tabItem?.addEventListener('click', () => handleTabClick('item'));
}

function handleTabClick(tab) {
  setActiveTab(tab);
  switch (tab) {
    case 'day':
      buildDayChart();
      break;
    case 'week':
      buildWeekChart();
      break;
    case 'month':
      buildMonthChart();
      break;
    case 'item':
      buildItemChart();
      break;
    default:
      break;
  }
}

function setActiveTab(activeKey) {
  const tabMap = {
    day: dom.tabDay,
    week: dom.tabWeek,
    month: dom.tabMonth,
    item: dom.tabItem
  };
  Object.values(tabMap).forEach(btn => {
    btn?.classList.remove('bg-black', 'text-white');
  });
  tabMap[activeKey]?.classList.add('bg-black', 'text-white');

  const sectionMap = {
    day: dom.secDay,
    week: dom.secWeek,
    month: dom.secMonth,
    item: dom.secItem
  };
  Object.entries(sectionMap).forEach(([key, section]) => {
    section?.classList.toggle('hidden', key !== activeKey);
  });
}

function buildDayChart() {
  cleanupStream('day');
  const since = new Date();
  since.setDate(since.getDate() - 13);

  const labels = [];
  const sums = new Map();
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    labels.push(key);
    sums.set(key, 0);
  }

  unsubscribers.day = firebaseFns.onSnapshot(
    firebaseFns.query(firebaseFns.collection(householdRefRef, 'purchaseEvents'), firebaseFns.orderBy('date', 'asc')),
    snapshot => {
      const itemsByDate = new Map();
      sums.forEach((_, key) => sums.set(key, 0));

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const key = data.date;
        const cost = Number(data.cost || 0);
        if (sums.has(key)) {
          sums.set(key, (sums.get(key) || 0) + cost);
        }
        if (!itemsByDate.has(key)) {
          itemsByDate.set(key, []);
        }
        itemsByDate.get(key).push({
          id: docSnap.id,
          name: data.itemNameSnapshot || '',
          qty: Number(data.qtyAtPurchase || 0),
          cost,
          img: data.itemImgSnapshot || '/buy.png'
        });
      });

      const dataPoints = labels.map(label => +(sums.get(label) || 0).toFixed(2));
      if (chartInstances.day) {
        chartInstances.day.data.labels = labels;
        chartInstances.day.data.datasets[0].data = dataPoints;
        chartInstances.day.update('none');
      } else if (dom.chartDay && window.Chart) {
        const ctx = dom.chartDay.getContext('2d');
        chartInstances.day = new Chart(ctx, chartCfg(labels, dataPoints, 'עלות יומית (₪)'));
      }

      renderDayAccordion(itemsByDate);
    }
  );
}

function renderDayAccordion(itemsByDate) {
  const container = dom.dayAccordion;
  if (!container) return;
  container.innerHTML = '';

  const daysWithPurchases = [...itemsByDate.keys()].sort((a, b) => b.localeCompare(a));
  if (!daysWithPurchases.length) {
    container.innerHTML = '<div class="text-sm" style="color:var(--muted);">אין רכישות להצגה</div>';
    return;
  }

  daysWithPurchases.forEach(date => {
    const dayItems = itemsByDate.get(date) || [];
    const sumForDay = dayItems.reduce((sum, p) => sum + Number(p.cost || 0), 0);

    const dayBox = document.createElement('div');
    dayBox.className = 'border rounded-lg';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-3 py-2 cursor-pointer select-none';
    header.innerHTML = `
      <div class="font-semibold">${date}</div>
      <div class="flex items-center gap-3">
        <div class="text-sm" style="color:var(--text);">סה״כ: ${fmtMoney(sumForDay)}</div>
        <button class="toggleBtn text-sm px-2 py-1 border rounded">הצג</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'hidden px-3 pb-3';

    const list = document.createElement('div');
    list.className = 'mt-2 space-y-1';

    dayItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-50';
      row.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <img src="${item.img}" class="w-5 h-5 rounded-full border object-cover" alt="">
          <span class="truncate">${item.name}</span>
          <span style="color:var(--muted);">×${item.qty}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="font-medium">${fmtMoney(item.cost)}</div>
          <button class="delBtn text-xs px-2 py-0.5 border rounded">מחק</button>
        </div>
      `;

      row.querySelector('.delBtn')?.addEventListener('click', async event => {
        event.stopPropagation();
        if (!confirm('למחוק את רכישה זו?')) return;
        try {
          await firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'purchaseEvents', item.id));
        } catch (error) {
          console.error(error);
          toast('שגיאה במחיקה', 3000);
        }
      });

      row.addEventListener('contextmenu', e => e.preventDefault());
      list.appendChild(row);
    });

    body.appendChild(list);

    const toggleBtn = header.querySelector('.toggleBtn');
    toggleBtn?.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = body.classList.contains('hidden');
      body.classList.toggle('hidden', !willOpen);
      toggleBtn.textContent = willOpen ? 'הסתר' : 'הצג';
    });

    header.addEventListener('click', () => toggleBtn?.dispatchEvent(new Event('click')));

    dayBox.append(header, body);
    container.appendChild(dayBox);
  });
}

function buildWeekChart() {
  cleanupStream('week');
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 30);
  const weeks = new Map();

  unsubscribers.week = firebaseFns.onSnapshot(
    firebaseFns.query(firebaseFns.collection(householdRefRef, 'purchaseEvents'), firebaseFns.orderBy('date', 'asc')),
    snapshot => {
      weeks.clear();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const dt = parseDateStr(data.date);
        if (dt < monthAgo) return;
        const key = isoWeekKey(dt);
        weeks.set(key, (weeks.get(key) || 0) + Number(data.cost || 0));
      });

      const labels = [...weeks.keys()];
      const dataPoints = labels.map(label => +(weeks.get(label) || 0).toFixed(2));
      renderChart('week', labels, dataPoints, 'עלות שבועית (₪)');

      if (summaryStatsRef) {
        summaryStatsRef.weekSpend = dataPoints.reduce((sum, value) => sum + Number(value || 0), 0);
        updateSummaryUIFn();
      }
    }
  );
}

function buildMonthChart() {
  cleanupStream('month');
  const months = new Map();

  unsubscribers.month = firebaseFns.onSnapshot(
    firebaseFns.query(firebaseFns.collection(householdRefRef, 'purchaseEvents'), firebaseFns.orderBy('date', 'asc')),
    snapshot => {
      months.clear();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const dt = parseDateStr(data.date);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        months.set(key, (months.get(key) || 0) + Number(data.cost || 0));
      });

      const labels = [...months.keys()];
      const dataPoints = labels.map(label => +(months.get(label) || 0).toFixed(2));
      renderChart('month', labels, dataPoints, 'עלות חודשית (₪)');

      if (summaryStatsRef) {
        summaryStatsRef.monthSpend = dataPoints.reduce((sum, value) => sum + Number(value || 0), 0);
        updateSummaryUIFn();
      }
    }
  );
}

function buildItemChart() {
  cleanupStream('item');
  const totals = new Map();

  unsubscribers.item = firebaseFns.onSnapshot(
    firebaseFns.query(firebaseFns.collection(householdRefRef, 'purchaseEvents')),
    snapshot => {
      totals.clear();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const name = data.itemNameSnapshot || '—';
        totals.set(name, (totals.get(name) || 0) + Number(data.cost || 0));
      });

      const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const labels = entries.map(entry => entry[0]);
      const dataPoints = entries.map(entry => +entry[1].toFixed(2));
      renderChart('item', labels, dataPoints, 'עלות לפי פריט (₪)');
    }
  );
}

function renderChart(key, labels, dataPoints, label) {
  const canvasMap = {
    week: dom.chartWeek,
    month: dom.chartMonth,
    item: dom.chartItem
  };

  destroyChart(key);

  if (chartInstances[key]) {
    chartInstances[key].data.labels = labels;
    chartInstances[key].data.datasets[0].data = dataPoints;
    chartInstances[key].update('none');
    return;
  }

  if (!canvasMap[key] || typeof Chart === 'undefined') return;
  const ctx = canvasMap[key].getContext('2d');
  chartInstances[key] = new Chart(ctx, chartCfg(labels, dataPoints, label));
}

function cleanupStream(key) {
  if (unsubscribers[key]) {
    try {
      unsubscribers[key]();
    } catch (error) {
      console.warn('Failed to unsubscribe analytics listener', error);
    }
    unsubscribers[key] = null;
  }
  destroyChart(key);
}

function destroyChart(key) {
  const chart = chartInstances[key];
  if (chart && typeof chart.destroy === 'function') {
    try {
      chart.destroy();
    } catch (error) {
      console.warn('Error destroying chart:', error);
    }
  }
  chartInstances[key] = null;
}

function chartCfg(labels, data, label) {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label,
          data
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  };
}

function cleanupAll() {
  ['day', 'week', 'month', 'item'].forEach(key => {
    cleanupStream(key);
  });
}

