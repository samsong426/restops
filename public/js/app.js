// ── Toast ─────────────────────────────────────────────────────────────────────

const toast = (() => {
  const el = document.getElementById('toast');
  let timer;
  return (msg, type = 'default') => {
    el.textContent = msg;
    el.className = type === 'error' ? 'error show' : type === 'success' ? 'success show' : 'show';
    clearTimeout(timer);
    timer = setTimeout(() => el.className = '', 2800);
  };
})();

// ── API ───────────────────────────────────────────────────────────────────────

const api = async (method, url, body) => {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    toast(e.message, 'error');
    throw e;
  }
};

// ── Formatting ────────────────────────────────────────────────────────────────

const fmt = {
  date: (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  money: (n) => n != null ? `$${Number(n).toFixed(2)}` : '—',
  hours: (n) => n != null ? `${Number(n).toFixed(1)}h` : '—',
  iso: (d) => d.toISOString().slice(0, 10),
  initials: (name) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
};

const today = () => fmt.iso(new Date());

function weekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmt.iso(monday), end: fmt.iso(sunday) };
}

function daysInRange(start, end) {
  const days = [];
  const cur = new Date(start + 'T00:00:00');
  while (fmt.iso(cur) <= end) { days.push(fmt.iso(new Date(cur))); cur.setDate(cur.getDate() + 1); }
  return days;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// ── Schedule ──────────────────────────────────────────────────────────────────

let weekOffset = 0;
let allStaff = [];

async function loadSchedule() {
  const { start, end } = weekRange(weekOffset);
  document.getElementById('week-label').textContent = `${fmt.date(start)} – ${fmt.date(end)}`;
  document.getElementById('slot-date').value = today();

  const [slots, labor, revenueData] = await Promise.all([
    api('GET', `/api/scheduling/week?start=${start}&end=${end}`),
    api('GET', `/api/scheduling/labor?start=${start}&end=${end}`),
    api('GET', `/api/menu/revenue?start=${start}&end=${end}`),
  ]);

  const byDate = {};
  slots.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const todayStr = today();

  document.getElementById('schedule-grid').innerHTML = daysInRange(start, end).map(date => {
    const daySlots = byDate[date] || [];
    const isToday = date === todayStr;
    return `
      <div class="day-block ${isToday ? 'is-today' : ''}">
        <div class="day-header ${isToday ? 'is-today' : ''}">
          ${fmt.date(date)}${isToday ? ' <span class="today-pill">Today</span>' : ''}
        </div>
        <div class="shift-list">
          ${daySlots.length ? daySlots.map(s => `
            <div class="shift-row" id="shift-row-${s.id}">
              <div class="shift-left">
                <div class="shift-name">${s.staff_name}</div>
                <div class="shift-time">${s.start_time} – ${s.end_time}</div>
              </div>
              <span class="shift-role-tag">${s.staff_role}</span>
              <button class="btn btn-sm btn-ghost" onclick="toggleSlotEdit(${s.id})">Edit</button>
              <button class="btn btn-icon btn-danger" onclick="deleteSlot(${s.id})" title="Remove">✕</button>
            </div>
            <div class="slot-edit-form" id="slot-edit-${s.id}" style="display:none">
              <div class="row" style="gap:6px">
                <div class="field"><label>Date</label><input type="date" id="slot-edit-date-${s.id}" value="${s.date}"></div>
                <div class="field"><label>Start</label><input type="time" id="slot-edit-start-${s.id}" value="${s.start_time}"></div>
                <div class="field"><label>End</label><input type="time" id="slot-edit-end-${s.id}" value="${s.end_time}"></div>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                <button class="btn btn-sm btn-ghost" onclick="toggleSlotEdit(${s.id})">Cancel</button>
                <button class="btn btn-sm btn-accent" onclick="saveSlot(${s.id})">Save</button>
              </div>
            </div>`).join('')
          : '<div class="no-shifts">No shifts</div>'}
        </div>
      </div>`;
  }).join('');

  // Labor hours + revenue %
  const weekRevenue = revenueData?.revenue || 0;
  const maxHours = Math.max(...labor.map(l => l.hours), 1);
  const totalPay = labor.reduce((s, l) => s + l.hours * (l.hourly_rate || 0), 0);

  const pctEl = document.getElementById('labor-rev-pct');
  if (weekRevenue > 0 && totalPay > 0) {
    const pct = (totalPay / weekRevenue) * 100;
    const cls = pct < 25 ? 'pct-ok' : pct < 35 ? 'pct-warn' : 'pct-high';
    pctEl.textContent = `${Math.round(pct)}% of revenue`;
    pctEl.className = `labor-rev-pct ${cls}`;
  } else {
    pctEl.textContent = '';
    pctEl.className = 'labor-rev-pct';
  }

  document.getElementById('labor-hours').innerHTML = labor.length
    ? labor.map(l => {
        const pay = l.hours * (l.hourly_rate || 0);
        const hasActual = l.actual_hours != null && l.actual_hours > 0;
        return `
        <div class="labor-row">
          <div class="labor-name-wrap">
            <span class="labor-name">${l.name}</span>
            ${l.hourly_rate > 0 ? `<span class="labor-rate">$${Number(l.hourly_rate).toFixed(2)}/hr</span>` : ''}
          </div>
          <div class="labor-bar-wrap"><div class="labor-bar" style="width:${(l.hours / maxHours) * 100}%"></div></div>
          <div class="labor-right">
            <span class="labor-hrs">${fmt.hours(l.hours)}</span>
            ${hasActual ? `<span class="labor-actual">${fmt.hours(l.actual_hours)} actual</span>` : ''}
            ${pay > 0 ? `<span class="labor-pay">${fmt.money(pay)}</span>` : ''}
          </div>
        </div>`;
      }).join('') +
      (totalPay > 0 ? `<div class="labor-total">Total est. labor cost: <strong>${fmt.money(totalPay)}</strong></div>` : '')
    : '<div class="empty">No shifts scheduled this week</div>';
}

async function loadStaff() {
  allStaff = await api('GET', '/api/scheduling/staff');

  document.getElementById('staff-list').innerHTML = allStaff.length
    ? allStaff.map(s => `
        <div class="staff-row" id="staff-row-${s.id}">
          <div class="staff-avatar">${fmt.initials(s.name)}</div>
          <div class="staff-info" onclick="toggleStaffEdit(${s.id})" style="cursor:pointer;flex:1">
            <div class="staff-name">${s.name}</div>
            <div class="staff-meta">${s.role}${s.phone ? ' · ' + s.phone : ''}${s.hourly_rate > 0 ? ' · $' + Number(s.hourly_rate).toFixed(2) + '/hr' : ''}</div>
          </div>
          <button class="btn btn-sm btn-ghost staff-edit-btn" onclick="toggleStaffEdit(${s.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="removeStaff(${s.id})">Remove</button>
        </div>
        <div class="staff-edit-form" id="staff-edit-${s.id}" style="display:none">
          <div class="row">
            <div class="field"><label>Name</label><input type="text" id="edit-name-${s.id}" value="${s.name}"></div>
            <div class="field"><label>Role</label><input type="text" id="edit-role-${s.id}" value="${s.role}"></div>
          </div>
          <div class="row">
            <div class="field"><label>Phone</label><input type="text" id="edit-phone-${s.id}" value="${s.phone || ''}"></div>
            <div class="field"><label>Hourly rate $</label><input type="number" id="edit-rate-${s.id}" value="${s.hourly_rate || ''}" step="0.01" min="0" placeholder="0.00"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-sm btn-ghost" onclick="toggleStaffEdit(${s.id})">Cancel</button>
            <button class="btn btn-sm btn-accent" onclick="saveStaff(${s.id})">Save</button>
          </div>
        </div>`).join('')
    : '<div class="empty">No staff yet</div>';

  const staffOptions = allStaff.length
    ? allStaff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('')
    : '<option value="">— add staff first —</option>';
  document.getElementById('slot-staff').innerHTML = staffOptions;
  document.getElementById('clock-staff').innerHTML = staffOptions;
}

function toggleStaffEdit(id) {
  const form = document.getElementById(`staff-edit-${id}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveStaff(id) {
  const name  = document.getElementById(`edit-name-${id}`).value.trim();
  const role  = document.getElementById(`edit-role-${id}`).value.trim();
  const phone = document.getElementById(`edit-phone-${id}`).value.trim();
  const hourly_rate = document.getElementById(`edit-rate-${id}`).value;
  if (!name) { toast('Name is required', 'error'); return; }
  if (!role) { toast('Role is required', 'error'); return; }
  await api('PUT', `/api/scheduling/staff/${id}`, { name, role, phone, hourly_rate: Number(hourly_rate) || 0 });
  toast('Staff updated', 'success');
  await loadStaff();
  await loadSchedule();
}

async function addStaff() {
  const name  = document.getElementById('new-staff-name').value.trim();
  const role  = document.getElementById('new-staff-role').value.trim();
  const phone = document.getElementById('new-staff-phone').value.trim();
  const hourly_rate = document.getElementById('new-staff-rate').value;
  if (!name) { toast('Enter a name', 'error'); return; }
  if (!role) { toast('Enter a role', 'error'); return; }
  await api('POST', '/api/scheduling/staff', { name, role, phone, hourly_rate: Number(hourly_rate) || 0 });
  ['new-staff-name','new-staff-role','new-staff-phone','new-staff-rate'].forEach(id => document.getElementById(id).value = '');
  toast(`${name} added`, 'success');
  await loadStaff();
}

async function removeStaff(id) {
  const member = allStaff.find(s => s.id === id);
  await api('DELETE', `/api/scheduling/staff/${id}`);
  toast(`${member?.name ?? 'Staff'} removed`);
  await loadStaff();
  await loadSchedule();
}

async function addSlot() {
  const staff_id = document.getElementById('slot-staff').value;
  const date = document.getElementById('slot-date').value;
  const start_time = document.getElementById('slot-start').value;
  const end_time = document.getElementById('slot-end').value;

  if (!staff_id) { toast('Select a staff member', 'error'); return; }
  if (!date) { toast('Pick a date', 'error'); return; }
  if (!start_time) { toast('Set a start time', 'error'); return; }
  if (!end_time) { toast('Set an end time', 'error'); return; }
  if (end_time <= start_time) { toast('End time must be after start', 'error'); return; }

  await api('POST', '/api/scheduling/slots', { staff_id, date, start_time, end_time });

  const name = allStaff.find(s => s.id == staff_id)?.name ?? 'Shift';
  toast(`${name} scheduled`, 'success');

  // If added date is in current week view, jump to it; else navigate there
  const { start, end } = weekRange(weekOffset);
  if (date < start || date > end) {
    // Find the right week offset
    const slotMonday = new Date(date + 'T00:00:00');
    const slotDay = slotMonday.getDay();
    slotMonday.setDate(slotMonday.getDate() - (slotDay === 0 ? 6 : slotDay - 1));
    const curMonday = new Date(weekRange(0).start + 'T00:00:00');
    weekOffset = Math.round((slotMonday - curMonday) / (7 * 86400000));
  }
  await loadSchedule();
}

async function deleteSlot(id) {
  await api('DELETE', `/api/scheduling/slots/${id}`);
  toast('Shift removed');
  await loadSchedule();
}

function toggleSlotEdit(id) {
  const form = document.getElementById(`slot-edit-${id}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveSlot(id) {
  const date = document.getElementById(`slot-edit-date-${id}`).value;
  const start_time = document.getElementById(`slot-edit-start-${id}`).value;
  const end_time = document.getElementById(`slot-edit-end-${id}`).value;
  if (!date || !start_time || !end_time) { toast('Fill all fields', 'error'); return; }
  if (end_time <= start_time) { toast('End must be after start', 'error'); return; }
  await api('PUT', `/api/scheduling/slots/${id}`, { date, start_time, end_time });
  toast('Shift updated', 'success');
  await loadSchedule();
}

document.getElementById('prev-week').onclick = () => { weekOffset--; loadSchedule(); };
document.getElementById('next-week').onclick = () => { weekOffset++; loadSchedule(); };

// ── Time clock ────────────────────────────────────────────────────────────────

async function loadClockEntries() {
  const date = today();
  document.getElementById('clock-date-label').textContent = fmt.date(date);
  const entries = await api('GET', `/api/scheduling/clock?date=${date}`);

  const nowHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  };
  document.getElementById('clock-time').value = nowHHMM();

  document.getElementById('clock-entries').innerHTML = entries.length
    ? entries.map(e => {
        const dur = e.clocked_out
          ? (() => {
              const [ih, im] = e.clocked_in.split(':').map(Number);
              const [oh, om] = e.clocked_out.split(':').map(Number);
              const mins = (oh * 60 + om) - (ih * 60 + im);
              return `${Math.floor(mins / 60)}h ${mins % 60}m`;
            })()
          : null;
        return `
          <div class="clock-entry">
            <div class="clock-entry-name">${e.staff_name}</div>
            <div class="clock-entry-times">${e.clocked_in}${e.clocked_out ? ' → ' + e.clocked_out : ''}</div>
            ${dur ? `<div class="clock-entry-dur">${dur}</div>` : '<span class="clock-in-badge">IN</span>'}
            ${!e.clocked_out ? `<button class="btn btn-sm btn-accent" onclick="clockOutEntry(${e.id})">Out</button>` : ''}
            <button class="btn btn-icon btn-danger" onclick="deleteClockEntry(${e.id})">✕</button>
          </div>`;
      }).join('')
    : '<div style="font-size:13px;color:var(--text-3);padding:4px 0">No clock entries today</div>';
}

async function doClock(direction) {
  const staff_id = document.getElementById('clock-staff').value;
  const time = document.getElementById('clock-time').value;
  if (!staff_id) { toast('Select a staff member', 'error'); return; }
  if (!time) { toast('Set a time', 'error'); return; }

  if (direction === 'in') {
    await api('POST', '/api/scheduling/clock/in', { staff_id: Number(staff_id), date: today(), clocked_in: time });
    toast('Clocked in', 'success');
  } else {
    const entries = await api('GET', `/api/scheduling/clock?date=${today()}`);
    const open = entries.find(e => e.staff_id == staff_id && !e.clocked_out);
    if (!open) { toast('No open clock-in found', 'error'); return; }
    await api('PATCH', `/api/scheduling/clock/${open.id}/out`, { clocked_out: time });
    toast('Clocked out', 'success');
  }
  await Promise.all([loadClockEntries(), loadSchedule()]);
}

async function clockOutEntry(id) {
  const n = new Date();
  const time = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  await api('PATCH', `/api/scheduling/clock/${id}/out`, { clocked_out: time });
  toast('Clocked out', 'success');
  await Promise.all([loadClockEntries(), loadSchedule()]);
}

async function deleteClockEntry(id) {
  await api('DELETE', `/api/scheduling/clock/${id}`);
  toast('Entry removed');
  await Promise.all([loadClockEntries(), loadSchedule()]);
}

// ── Recipes & Menu ────────────────────────────────────────────────────────────

let allMenuItems = [];
let allRecipes = [];
let allInventoryItems = [];
let allDishCosts = {};

function expiryBadge(expiry_date) {
  if (!expiry_date) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry_date + 'T00:00:00');
  const diff = Math.round((exp - today) / 86400000);
  const label = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0)  return `<span class="expiry-badge expired">Expired</span>`;
  if (diff === 0) return `<span class="expiry-badge expires-today">Exp today</span>`;
  if (diff <= 3)  return `<span class="expiry-badge expires-soon">Exp ${label}</span>`;
  if (diff <= 7)  return `<span class="expiry-badge expires-week">Exp ${label}</span>`;
  return `<span class="expiry-badge">${label}</span>`;
}

async function loadRecipesTab() {
  const [menuItems, recipes, invItems, wasteRisk, dishCosts] = await Promise.all([
    api('GET', '/api/menu/items'),
    api('GET', '/api/menu/recipes'),
    api('GET', '/api/inventory/items'),
    api('GET', '/api/inventory/waste-risk'),
    api('GET', '/api/menu/costs'),
  ]);
  allMenuItems = menuItems;
  allRecipes = recipes;
  allInventoryItems = invItems;
  allDishCosts = {};
  dishCosts.forEach(d => { allDishCosts[d.id] = d; });

  renderWasteRisk(wasteRisk);
  renderMenuItems();
  renderRecipeOverview();
  renderRecipePickers();
  renderRecipeForDish();
}

function renderWasteRisk(risks) {
  const banner = document.getElementById('waste-banner');
  const detail = document.getElementById('waste-detail');
  if (!risks.length) { banner.style.display = 'none'; detail.style.display = 'none'; return; }

  const total = risks.reduce((s, r) => s + r.waste_value, 0);
  banner.style.display = 'flex';
  document.getElementById('waste-banner-sub').textContent =
    `${risks.length} item${risks.length > 1 ? 's' : ''} expiring — ${risks.filter(r => r.is_expired).length > 0 ? 'some already expired' : 'within 7 days'}`;
  document.getElementById('waste-banner-val').textContent = `$${total.toFixed(2)}`;

  detail.style.display = 'block';
  detail.innerHTML = risks.map(r => `
    <div class="waste-row">
      <div>
        <div class="waste-item-name">${r.name} ${expiryBadge(r.expiry_date)}</div>
        <div class="waste-item-detail">${Number(r.estimated_remaining).toFixed(1)} ${r.unit} × $${Number(r.cost_per_unit).toFixed(2)}/${r.unit}</div>
      </div>
      <span class="waste-item-val">$${Number(r.waste_value).toFixed(2)}</span>
    </div>`).join('');
}

async function saveDishSales() {
  if (!allMenuItems.length) { toast('No menu items yet', 'error'); return; }
  const date = document.getElementById('log-sales-date')?.value || today();
  if (date > today()) { toast('Cannot log sales for a future date', 'error'); return; }
  const sales = allMenuItems
    .map(m => ({ menu_item_id: m.id, qty_sold: Number(document.getElementById(`sale-qty-${m.id}`)?.value) || 0 }))
    .filter(s => s.qty_sold > 0);
  if (!sales.length) { toast('Enter at least one quantity', 'error'); return; }
  await api('POST', '/api/menu/sales', { date, sales });
  toast(`Sales logged — ${sales.reduce((s, r) => s + r.qty_sold, 0)} covers`, 'success');
  await Promise.all([loadInventory(), loadSalesTab()]);
}

function renderMenuItems() {
  document.getElementById('menu-items-list').innerHTML = allMenuItems.length
    ? allMenuItems.map(m => {
        const cost = allDishCosts[m.id];
        let costBadge = '';
        if (cost && m.price > 0) {
          if (cost.ingredient_cost > 0) {
            const pct = (cost.ingredient_cost / m.price) * 100;
            const cls = pct < 28 ? 'cost-ok' : pct < 38 ? 'cost-warn' : 'cost-high';
            costBadge = `<span class="dish-cost-badge ${cls}">${Math.round(pct)}% food cost</span>`;
          } else {
            costBadge = `<span class="dish-cost-badge cost-none">no recipe costs</span>`;
          }
        }
        return `
        <div class="menu-item-row" style="flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="menu-item-name">${m.name}</span>
              ${costBadge}
            </div>
            ${cost && cost.ingredient_cost > 0 ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">Cost $${Number(cost.ingredient_cost).toFixed(2)} · Sell $${Number(m.price).toFixed(2)}</div>` : ''}
          </div>
          <span class="menu-item-price">$${Number(m.price).toFixed(2)}</span>
          <button class="btn btn-sm btn-ghost" onclick="toggleMenuItemEdit(${m.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="removeMenuItem(${m.id})">Remove</button>
        </div>
        <div class="menu-item-edit-form" id="menu-edit-${m.id}" style="display:none">
          <div class="row">
            <div class="field"><label>Name</label><input type="text" id="menu-edit-name-${m.id}" value="${m.name}"></div>
            <div class="field"><label>Price $</label><input type="number" id="menu-edit-price-${m.id}" value="${m.price}" step="0.01" min="0"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-sm btn-ghost" onclick="toggleMenuItemEdit(${m.id})">Cancel</button>
            <button class="btn btn-sm btn-accent" onclick="saveMenuItem(${m.id})">Save</button>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty">No dishes yet</div>';
}

function toggleMenuItemEdit(id) {
  const form = document.getElementById(`menu-edit-${id}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveMenuItem(id) {
  const name  = document.getElementById(`menu-edit-name-${id}`).value.trim();
  const price = document.getElementById(`menu-edit-price-${id}`).value;
  if (!name) { toast('Name is required', 'error'); return; }
  await api('PUT', `/api/menu/items/${id}`, { name, price: Number(price) || 0 });
  toast('Dish updated', 'success');
  await loadRecipesTab();
}

function renderRecipeOverview() {
  const byDish = {};
  allMenuItems.forEach(m => { byDish[m.id] = { dish: m, ingredients: [] }; });
  allRecipes.forEach(r => {
    if (byDish[r.menu_item_id]) byDish[r.menu_item_id].ingredients.push(r);
  });

  const dishes = Object.values(byDish);
  const hasAny = dishes.some(d => d.ingredients.length > 0);

  document.getElementById('recipe-overview').innerHTML = hasAny
    ? dishes.filter(d => d.ingredients.length > 0).map(({ dish, ingredients }) => `
        <div class="recipe-overview-dish">
          <div class="recipe-overview-dish-header">
            <span class="recipe-overview-dish-name">${dish.name}</span>
            <span class="recipe-overview-dish-price">$${Number(dish.price).toFixed(2)}</span>
          </div>
          <div class="recipe-overview-ingredients">
            ${ingredients.map(r => `
              <div class="recipe-overview-ing-row" id="ing-row-${dish.id}-${r.inventory_item_id}">
                <span class="recipe-overview-ing-name">${r.ingredient_name}</span>
                <span class="recipe-overview-ing-qty" id="ing-qty-${dish.id}-${r.inventory_item_id}">${r.qty_used} ${r.unit}</span>
                <button class="recipe-overview-ing-edit" onclick="editIngQty(${dish.id}, ${r.inventory_item_id}, ${r.qty_used}, '${r.unit}')">edit</button>
                <button class="btn btn-icon btn-danger" style="width:20px;height:20px;font-size:10px" onclick="removeRecipeIngredient(${dish.id}, ${r.inventory_item_id})">✕</button>
              </div>
              <div id="ing-edit-${dish.id}-${r.inventory_item_id}" style="display:none;align-items:center;gap:6px;padding:2px 0">
                <input type="number" class="recipe-overview-ing-input" id="ing-input-${dish.id}-${r.inventory_item_id}" value="${r.qty_used}" step="0.01" min="0">
                <span style="font-size:12px;color:var(--text-3)">${r.unit}</span>
                <button class="btn btn-sm btn-accent" style="padding:3px 10px" onclick="saveIngQty(${dish.id}, ${r.inventory_item_id})">Save</button>
                <button class="btn btn-sm btn-ghost" style="padding:3px 8px" onclick="cancelIngEdit(${dish.id}, ${r.inventory_item_id})">✕</button>
              </div>`).join('')}
          </div>
        </div>`).join('')
    : '<div class="empty" style="padding:20px">Add ingredients via the recipe builder below</div>';
}

function editIngQty(dishId, invId, currentQty, unit) {
  document.getElementById(`ing-row-${dishId}-${invId}`).style.display = 'none';
  const editEl = document.getElementById(`ing-edit-${dishId}-${invId}`);
  editEl.style.display = 'flex';
  editEl.querySelector('input').focus();
}

function cancelIngEdit(dishId, invId) {
  document.getElementById(`ing-row-${dishId}-${invId}`).style.display = 'flex';
  document.getElementById(`ing-edit-${dishId}-${invId}`).style.display = 'none';
}

async function saveIngQty(dishId, invId) {
  const qty = document.getElementById(`ing-input-${dishId}-${invId}`).value;
  if (!qty || Number(qty) <= 0) { toast('Enter a valid quantity', 'error'); return; }
  await api('POST', '/api/menu/recipes', { menu_item_id: Number(dishId), inventory_item_id: Number(invId), qty_used: Number(qty) });
  toast('Recipe updated', 'success');
  await loadRecipesTab();
}

async function addMenuItem() {
  const name = document.getElementById('new-dish-name').value.trim();
  const price = document.getElementById('new-dish-price').value;
  if (!name) { toast('Enter a dish name', 'error'); return; }
  await api('POST', '/api/menu/items', { name, price: Number(price) || 0 });
  document.getElementById('new-dish-name').value = '';
  document.getElementById('new-dish-price').value = '';
  toast(`${name} added`, 'success');
  await loadRecipesTab();
}

async function removeMenuItem(id) {
  await api('DELETE', `/api/menu/items/${id}`);
  toast('Dish removed');
  await loadRecipesTab();
}

function renderRecipePickers() {
  const dishSel = document.getElementById('recipe-dish-select');
  const curDish = dishSel.value;
  dishSel.innerHTML = '<option value="">— select a dish —</option>' +
    allMenuItems.map(m => `<option value="${m.id}" ${m.id == curDish ? 'selected' : ''}>${m.name}</option>`).join('');

  document.getElementById('recipe-ingredient-select').innerHTML = allInventoryItems
    .map(i => `<option value="${i.id}">${i.name} (${i.unit})</option>`).join('');
}

function renderRecipeForDish() {
  const dishId = document.getElementById('recipe-dish-select').value;
  const el = document.getElementById('recipe-ingredients-list');
  if (!dishId) { el.innerHTML = ''; return; }

  const ingredients = allRecipes.filter(r => r.menu_item_id == dishId);
  el.innerHTML = ingredients.length
    ? ingredients.map(r => `
        <div class="recipe-row">
          <span class="recipe-ingredient">${r.ingredient_name}</span>
          <span class="recipe-qty">${r.qty_used} ${r.unit}</span>
          <button class="btn btn-icon btn-danger" onclick="removeRecipeIngredient(${r.menu_item_id}, ${r.inventory_item_id})">✕</button>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--text-3);padding:4px 0">No ingredients yet — add below</div>';
}

async function addRecipeIngredient() {
  const menu_item_id = document.getElementById('recipe-dish-select').value;
  const inventory_item_id = document.getElementById('recipe-ingredient-select').value;
  const qty_used = document.getElementById('recipe-qty').value;
  if (!menu_item_id) { toast('Select a dish first', 'error'); return; }
  if (!qty_used || Number(qty_used) <= 0) { toast('Enter a quantity', 'error'); return; }
  await api('POST', '/api/menu/recipes', { menu_item_id: Number(menu_item_id), inventory_item_id: Number(inventory_item_id), qty_used: Number(qty_used) });
  document.getElementById('recipe-qty').value = '';
  toast('Recipe updated', 'success');
  await loadRecipesTab();
}

async function removeRecipeIngredient(menuId, invId) {
  await api('DELETE', `/api/menu/recipes/${menuId}/${invId}`);
  toast('Ingredient removed');
  await loadRecipesTab();
}

// ── Sales tab ─────────────────────────────────────────────────────────────────

let allSalesData = [];
let csvParsed = [];

async function loadSalesTab() {
  const [menuItems, sales] = await Promise.all([
    api('GET', '/api/menu/items'),
    api('GET', '/api/menu/sales'),
  ]);
  allMenuItems = menuItems;
  allSalesData = sales;

  document.getElementById('log-sales-date').value = today();
  renderLogSalesList();
  renderSalesDashboard(sales, menuItems);
}

function renderLogSalesList() {
  document.getElementById('log-sales-list').innerHTML = allMenuItems.length
    ? allMenuItems.map(m => `
        <div class="dish-sale-row">
          <div class="dish-sale-name">${m.name}<span style="color:var(--text-3);font-size:12px;margin-left:6px">$${Number(m.price).toFixed(2)}</span></div>
          <input class="dish-sale-input" type="number" min="0" placeholder="0"
            id="sale-qty-${m.id}" data-id="${m.id}">
        </div>`).join('')
    : '<div class="empty">Add menu items in the Recipes tab first</div>';
}

function renderSalesDashboard(sales, menuItems) {
  const todayStr = today();
  const cutoff7  = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return fmt.iso(d); })();
  const cutoff14 = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return fmt.iso(d); })();

  const last7  = sales.filter(s => s.date >= cutoff7);
  const last14 = sales.filter(s => s.date >= cutoff14);

  // Stat cards
  const rev7    = last7.reduce((s, r) => s + (r.revenue || 0), 0);
  const qty7    = last7.reduce((s, r) => s + (r.qty_sold || 0), 0);
  const days7   = [...new Set(last7.map(r => r.date))].length || 1;
  const avgRev  = rev7 / days7;

  // Best seller (by qty last 7 days)
  const byDish7 = {};
  last7.forEach(r => {
    byDish7[r.dish_name] = byDish7[r.dish_name] || { qty: 0, rev: 0 };
    byDish7[r.dish_name].qty += r.qty_sold;
    byDish7[r.dish_name].rev += r.revenue || 0;
  });
  const bestEntry = Object.entries(byDish7).sort((a, b) => b[1].qty - a[1].qty)[0];

  document.getElementById('sales-stats').innerHTML = `
    <div class="sales-stat-card">
      <div class="sales-stat-val">${fmt.money(rev7)}</div>
      <div class="sales-stat-label">Revenue (7d)</div>
      <div class="sales-stat-sub">${fmt.money(avgRev)}/day avg</div>
    </div>
    <div class="sales-stat-card">
      <div class="sales-stat-val">${qty7}</div>
      <div class="sales-stat-label">Covers (7d)</div>
      <div class="sales-stat-sub">${Math.round(qty7 / days7)}/day avg</div>
    </div>
    <div class="sales-stat-card">
      <div class="sales-stat-val">${bestEntry ? bestEntry[0].split(' ')[0] : '—'}</div>
      <div class="sales-stat-label">Best seller</div>
      <div class="sales-stat-sub">${bestEntry ? `${bestEntry[1].qty} sold` : 'No data'}</div>
    </div>
    <div class="sales-stat-card">
      <div class="sales-stat-val">${days7}</div>
      <div class="sales-stat-label">Days tracked</div>
      <div class="sales-stat-sub">last 7 days</div>
    </div>`;

  // Bar chart — last 14 days
  const byDate14 = {};
  last14.forEach(r => { byDate14[r.date] = (byDate14[r.date] || 0) + (r.revenue || 0); });
  const chartDays = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    chartDays.push(fmt.iso(d));
  }
  const maxRev = Math.max(...chartDays.map(d => byDate14[d] || 0), 1);
  document.getElementById('sales-chart').innerHTML = chartDays.map(d => {
    const rev = byDate14[d] || 0;
    const pct = (rev / maxRev) * 100;
    const label = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    const isToday = d === todayStr;
    return `<div class="sales-chart-col" title="${label}: ${fmt.money(rev)}">
      <div class="sales-chart-bar ${isToday ? 'is-today' : ''}" style="height:${pct}%"></div>
      <div class="sales-chart-date">${label}</div>
    </div>`;
  }).join('');

  // Per-dish breakdown (last 7 days vs prior 7 days)
  const cutoffPrior = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return fmt.iso(d); })();
  const prior7 = sales.filter(s => s.date >= cutoffPrior && s.date < cutoff7);
  const byDishPrior = {};
  prior7.forEach(r => {
    byDishPrior[r.dish_name] = byDishPrior[r.dish_name] || { qty: 0, rev: 0 };
    byDishPrior[r.dish_name].qty += r.qty_sold;
    byDishPrior[r.dish_name].rev += r.revenue || 0;
  });

  const dishRows = Object.entries(byDish7).sort((a, b) => b[1].rev - a[1].rev);
  document.getElementById('sales-dish-table').innerHTML = dishRows.length
    ? dishRows.map(([name, cur]) => {
        const prior = byDishPrior[name] || { qty: 0, rev: 0 };
        let trendHtml = '<span class="sales-trend-flat">→</span>';
        if (prior.rev > 0) {
          const pct = ((cur.rev - prior.rev) / prior.rev) * 100;
          if (pct > 5)       trendHtml = `<span class="sales-trend-up">↑${Math.round(pct)}%</span>`;
          else if (pct < -5) trendHtml = `<span class="sales-trend-down">↓${Math.round(Math.abs(pct))}%</span>`;
        }
        return `<div class="sales-dish-row">
          <div class="sales-dish-name">${name}</div>
          ${trendHtml}
          <div class="sales-dish-stats">
            <div class="sales-dish-rev">${fmt.money(cur.rev)}</div>
            <div class="sales-dish-qty">${cur.qty} sold</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty" style="padding:20px">No sales in the last 7 days</div>';

  // 7-day forecast (avg daily per dish over last 14 days × 7)
  const byDish14 = {};
  last14.forEach(r => {
    byDish14[r.dish_name] = byDish14[r.dish_name] || { qty: 0, rev: 0 };
    byDish14[r.dish_name].qty += r.qty_sold;
    byDish14[r.dish_name].rev += r.revenue || 0;
  });
  const activeDays14 = [...new Set(last14.map(r => r.date))].length || 1;
  const forecastRows = Object.entries(byDish14).sort((a, b) => b[1].rev - a[1].rev);
  document.getElementById('sales-forecast-table').innerHTML = forecastRows.length
    ? forecastRows.map(([name, totals]) => {
        const avgQty = (totals.qty / activeDays14) * 7;
        const avgRev = (totals.rev / activeDays14) * 7;
        return `<div class="sales-forecast-row">
          <div class="sales-forecast-name">${name}</div>
          <div style="text-align:right">
            <div class="sales-forecast-val">${fmt.money(avgRev)}</div>
            <div class="sales-forecast-qty">~${Math.round(avgQty)} servings</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty" style="padding:20px">Not enough data for a forecast</div>';

  renderSalesHistory(sales);
}

function renderSalesHistory(sales) {
  const byDate = {};
  sales.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const dates = Object.keys(byDate).sort().reverse();

  document.getElementById('sales-history').innerHTML = dates.length
    ? dates.map(date => `
        <div class="sales-history-group">
          <div class="sales-history-date-label">${fmt.date(date)}</div>
          ${byDate[date].map(s => `
            <div class="sales-history-row" id="srow-${s.id}">
              <span class="sales-history-dish">${s.dish_name}</span>
              <span class="sales-history-info" id="sinfo-${s.id}">${s.qty_sold} sold · ${fmt.money(s.revenue)}</span>
              <input type="number" class="sales-history-edit-input" id="sedit-${s.id}" value="${s.qty_sold}" style="display:none;width:64px" min="0" step="1">
              <button class="btn btn-sm btn-ghost" id="sedit-btn-${s.id}" onclick="startSaleEdit(${s.id})">Edit</button>
              <button class="btn btn-sm btn-accent" id="ssave-btn-${s.id}" onclick="saveSaleEdit(${s.id})" style="display:none">Save</button>
              <button class="btn btn-icon btn-danger" onclick="deleteSaleRow(${s.id})">✕</button>
            </div>`).join('')}
        </div>`).join('')
    : '<div class="empty" style="padding:20px">No sales logged yet</div>';
}

function startSaleEdit(id) {
  document.getElementById(`sinfo-${id}`).style.display = 'none';
  document.getElementById(`sedit-${id}`).style.display = 'inline-block';
  document.getElementById(`sedit-btn-${id}`).style.display = 'none';
  document.getElementById(`ssave-btn-${id}`).style.display = 'inline-block';
  document.getElementById(`sedit-${id}`).focus();
}

async function saveSaleEdit(id) {
  const qty = document.getElementById(`sedit-${id}`).value;
  if (qty === '' || Number(qty) < 0) { toast('Enter a valid quantity', 'error'); return; }
  await api('PATCH', `/api/menu/sales/${id}`, { qty_sold: Number(qty) });
  toast('Sale updated', 'success');
  await Promise.all([loadSalesTab(), loadInventory()]);
}

async function deleteSaleRow(id) {
  await api('DELETE', `/api/menu/sales/${id}`);
  toast('Sale deleted');
  await Promise.all([loadSalesTab(), loadInventory()]);
}

// CSV import
function handleCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => parseCsvContent(e.target.result);
  reader.readAsText(file);
  document.getElementById('csv-drop-label').textContent = file.name;
}

const csvDropZone = document.getElementById('csv-drop-zone');
csvDropZone.addEventListener('dragover', e => { e.preventDefault(); csvDropZone.style.borderColor = 'var(--accent)'; });
csvDropZone.addEventListener('dragleave', () => { csvDropZone.style.borderColor = ''; });
csvDropZone.addEventListener('drop', e => {
  e.preventDefault();
  csvDropZone.style.borderColor = '';
  handleCsvFile(e.dataTransfer.files[0]);
});
csvDropZone.addEventListener('click', () => document.getElementById('csv-file-input').click());

function parseCsvContent(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const rows = lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));

  // Detect header row
  let dataRows = rows;
  const firstLow = rows[0]?.map(c => c.toLowerCase());
  if (firstLow && (firstLow.includes('date') || firstLow.includes('dish') || firstLow.includes('qty'))) {
    dataRows = rows.slice(1);
  }

  const menuNameMap = {};
  allMenuItems.forEach(m => { menuNameMap[m.name.toLowerCase()] = m; });

  const todayStr = today();
  csvParsed = dataRows.map(r => {
    const [date, dishName, qty] = r;
    const matched = menuNameMap[(dishName || '').toLowerCase()];
    const isFuture = date?.trim() > todayStr;
    return { date: date?.trim(), dishName: dishName?.trim(), qty: Number(qty) || 0, matched, isFuture };
  }).filter(r => r.date && r.dishName);

  const errors = [
    ...csvParsed.filter(r => !r.matched).map(r => `"${r.dishName}" not found in menu`),
    ...csvParsed.filter(r => r.isFuture).map(r => `${r.date} is a future date — will be skipped`),
  ];
  const uniqErrors = [...new Set(errors)];

  const previewEl = document.getElementById('csv-preview');
  const rowsEl = document.getElementById('csv-preview-rows');
  const errEl = document.getElementById('csv-errors');
  const importBtn = document.getElementById('csv-import-btn');

  previewEl.style.display = 'block';
  document.getElementById('csv-preview-label').textContent = `${csvParsed.length} rows`;
  rowsEl.innerHTML = csvParsed.slice(0, 8).map(r => `
    <div class="csv-preview-row">
      <span class="csv-cell ${r.isFuture ? 'unmatched' : ''}">${r.date}${r.isFuture ? ' ⚑' : ''}</span>
      <span class="csv-cell ${r.matched ? 'matched' : 'unmatched'}">${r.dishName}</span>
      <span class="csv-cell">${r.qty}</span>
    </div>`).join('') + (csvParsed.length > 8 ? `<div style="font-size:11px;color:var(--text-3);padding:4px 0">…and ${csvParsed.length - 8} more</div>` : '');
  errEl.textContent = uniqErrors.join('; ');
  importBtn.disabled = csvParsed.filter(r => r.matched && !r.isFuture).length === 0;
}

function clearCsvPreview() {
  csvParsed = [];
  document.getElementById('csv-preview').style.display = 'none';
  document.getElementById('csv-drop-label').textContent = 'Choose or drop a CSV file';
  document.getElementById('csv-file-input').value = '';
}

async function importCsv() {
  const matched = csvParsed.filter(r => r.matched && !r.isFuture);
  if (!matched.length) { toast('No valid rows to import', 'error'); return; }

  // Group by date
  const byDate = {};
  matched.forEach(r => {
    (byDate[r.date] = byDate[r.date] || []).push({ menu_item_id: r.matched.id, qty_sold: r.qty });
  });

  let count = 0;
  for (const [date, sales] of Object.entries(byDate)) {
    await api('POST', '/api/menu/sales', { date, sales });
    count += sales.length;
  }
  toast(`Imported ${count} entries across ${Object.keys(byDate).length} dates`, 'success');
  clearCsvPreview();
  await Promise.all([loadInventory(), loadSalesTab()]);
}

// ── Inventory dashboard ───────────────────────────────────────────────────────

let countValues = {};
let countMode = false;
let lastCountData = [];

function toggleOrderSheet() {
  const sheet = document.getElementById('order-sheet');
  sheet.style.display = sheet.style.display === 'none' ? 'block' : 'none';
}

function toggleCountMode() {
  countMode = !countMode;
  countValues = {};
  document.getElementById('count-mode-btn').textContent = countMode ? 'Cancel' : 'Enter count';
  document.getElementById('count-save-bar').style.display = countMode ? 'flex' : 'none';
  document.querySelectorAll('.inv-count-input').forEach(el => {
    el.classList.toggle('visible', countMode);
    if (!countMode) el.value = '';
  });
  if (countMode) document.querySelector('.inv-count-input')?.focus();
}

function cancelCountMode() {
  countMode = false;
  countValues = {};
  document.getElementById('count-mode-btn').textContent = 'Enter count';
  document.getElementById('count-save-bar').style.display = 'none';
  document.querySelectorAll('.inv-count-input').forEach(el => { el.classList.remove('visible'); el.value = ''; });
}

function updateCountSaveLabel() {
  const n = Object.values(countValues).filter(v => v !== '').length;
  document.getElementById('count-save-label').textContent = `${n} value${n !== 1 ? 's' : ''} entered`;
}

async function loadInventory() {
  const [counts, orderList, batches] = await Promise.all([
    api('GET', '/api/inventory/counts'),
    api('GET', '/api/inventory/order-list'),
    api('GET', '/api/inventory/batches'),
  ]);
  // Group batches by item_id, sorted by expiry_date asc (already sorted by API)
  const batchesByItem = {};
  batches.forEach(b => { (batchesByItem[b.item_id] = batchesByItem[b.item_id] || []).push(b); });
  lastCountData = counts;
  renderInventoryDashboard(counts, orderList, batchesByItem);
}

function renderInventoryDashboard(counts, orderList, batchesByItem = {}) {
  const total = counts.length;
  const noCounts = counts.filter(i => i.count == null && i.total_batch_qty === 0).length;
  const belowPar = counts.filter(i => {
    const batchTotal = i.total_batch_qty > 0 ? Math.max(0, i.total_batch_qty - (i.consumed || 0)) : null;
    const dq = batchTotal != null ? batchTotal : (i.estimated_remaining != null ? i.estimated_remaining : i.count);
    return dq != null && dq < i.par_level;
  }).length;
  const ok = total - belowPar - noCounts;

  // Stat cards
  document.getElementById('inv-stats').innerHTML = `
    <div class="inv-stat-card ${belowPar > 0 ? 'is-alert' : ''}">
      <div class="inv-stat-val ${belowPar > 0 ? 'danger' : ''}">${belowPar}</div>
      <div class="inv-stat-label">Below par</div>
    </div>
    <div class="inv-stat-card ${ok === total && total > 0 ? 'is-ok' : ''}">
      <div class="inv-stat-val ${ok === total && total > 0 ? 'success' : ''}">${ok}</div>
      <div class="inv-stat-label">At par</div>
    </div>
    <div class="inv-stat-card">
      <div class="inv-stat-val">${total}</div>
      <div class="inv-stat-label">Items</div>
    </div>`;

  // Last count time
  const lastTime = counts.filter(i => i.counted_at).map(i => i.counted_at).sort().pop();
  document.getElementById('inv-last-count').textContent = lastTime
    ? `Last count: ${new Date(lastTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : 'No counts yet';

  // Order banner
  const banner = document.getElementById('order-banner');
  if (belowPar > 0) {
    banner.style.display = 'flex';
    document.getElementById('order-banner-sub').textContent =
      orderList.map(i => `${i.name} (+${Number(i.order_qty).toFixed(1)} ${i.unit})`).join(', ');
  } else {
    banner.style.display = 'none';
    document.getElementById('order-sheet').style.display = 'none';
  }

  // Order sheet contents
  document.getElementById('order-list').innerHTML = orderList.length
    ? orderList.map(i => `
        <div class="order-row">
          <div>
            <div class="order-name">${i.name}</div>
            <div class="order-cat">${i.category} · have ${i.current_count ?? 0}, par ${i.par_level} ${i.unit}</div>
          </div>
          <span class="order-qty">+${Number(i.order_qty).toFixed(1)} ${i.unit}</span>
        </div>`).join('')
    : '';

  // Group items by category
  const byCategory = {};
  counts.forEach(item => {
    const cat = item.category || 'general';
    (byCategory[cat] = byCategory[cat] || []).push(item);
  });

  const catEl = document.getElementById('inv-categories');
  if (!counts.length) { catEl.innerHTML = '<div class="empty" style="padding:24px 0">No items yet — add one below</div>'; return; }

  catEl.innerHTML = Object.entries(byCategory).map(([cat, items]) => {
    const catLow = items.filter(i => {
      const batchTotal = i.total_batch_qty > 0 ? Math.max(0, i.total_batch_qty - (i.consumed || 0)) : null;
      const dq = batchTotal != null ? batchTotal : (i.estimated_remaining != null ? i.estimated_remaining : i.count);
      return dq != null && dq < i.par_level;
    }).length;
    return `
      <div class="inv-category-group">
        <div class="inv-category-header">
          <span class="inv-category-name">${cat}</span>
          <span class="inv-category-pill ${catLow > 0 ? 'has-low' : 'all-ok'}">
            ${catLow > 0 ? `${catLow} low` : '✓ ok'}
          </span>
        </div>
        ${items.map(item => {
          const count = item.count;
          const par = item.par_level;
          const estRem = item.estimated_remaining;
          // Prefer FIFO-depleted batch total (matches what batch rows show);
          // fall back to recipe-consumption estimate, then raw count
          const batchTotal = item.total_batch_qty > 0
            ? Math.max(0, item.total_batch_qty - (item.consumed || 0))
            : null;
          const displayQty = batchTotal != null ? batchTotal : (estRem != null ? estRem : count);
          const pct = displayQty != null && par > 0 ? Math.min(displayQty / par, 1) * 100 : 0;
          const state = displayQty == null ? 'no-count' : displayQty >= par ? 'ok' : 'low';
          const statusText = count == null
            ? 'not yet counted'
            : state === 'ok'
              ? `${Number(displayQty).toFixed(1)} / ${par} ${item.unit}`
              : `${Number(displayQty).toFixed(1)} / ${par} ${item.unit} — need ${Number(par - displayQty).toFixed(1)} more`;
          const usedLine = item.consumed > 0
            ? ` · <span class="inv-par-text no-count">${Number(item.consumed).toFixed(1)} used → est. ${Number(displayQty).toFixed(1)} left</span>`
            : '';

          // Batch expiry lines — show received qty as-is; bar handles consumed separately
          const itemBatches = batchesByItem[item.id] || [];
          const batchLines = (() => {
            if (!itemBatches.length) return `<div class="inv-expiry-line"><span class="exp-text" style="color:var(--text-3)">No batches — receive stock to track expiry</span></div>`;
            const todayMs = new Date().setHours(0,0,0,0);
            return itemBatches.map((b, i) => {
              const expMs = new Date(b.expiry_date + 'T00:00:00').setHours(0,0,0,0);
              const diff = Math.round((expMs - todayMs) / 86400000);
              const expLabel = new Date(b.expiry_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              let cls = '';
              if (diff < 0)        cls = 'expired';
              else if (diff === 0) cls = 'expires-today';
              else if (diff <= 3)  cls = 'expires-soon';
              else if (diff <= 7)  cls = 'expires-week';
              const diffTxt = diff < 0 ? `expired ${Math.abs(diff)}d ago` : diff === 0 ? 'expires today' : `${diff}d left`;
              const buyLabel = b.purchase_date
                ? new Date(b.purchase_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : null;
              return `<div class="inv-batch-row ${i === 0 ? 'is-first' : ''}" id="batch-row-${b.id}">
                <span class="batch-qty">${Number(b.qty).toFixed(1)} ${item.unit}</span>
                ${buyLabel ? `<span class="exp-text" style="color:var(--text-3)">Bought ${buyLabel}</span>` : ''}
                <span class="exp-text ${cls}">Exp ${expLabel} · ${diffTxt}</span>
                <button class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:11px" onclick="toggleBatchEdit(${b.id})">Edit</button>
                <button class="btn btn-icon btn-danger" onclick="deleteBatch(${b.id})" title="Remove batch">✕</button>
              </div>
              <div id="batch-edit-${b.id}" style="display:none;align-items:center;gap:6px;padding:4px 0;flex-wrap:wrap">
                <input type="number" step="0.5" min="0" id="be-qty-${b.id}" value="${b.qty}" style="width:70px">
                <span style="font-size:12px;color:var(--text-3)">${item.unit}</span>
                <input type="date" id="be-exp-${b.id}" value="${b.expiry_date}">
                <button class="btn btn-sm btn-accent" style="padding:3px 10px" onclick="saveBatch(${b.id})">Save</button>
                <button class="btn btn-sm btn-ghost" style="padding:3px 8px" onclick="toggleBatchEdit(${b.id})">✕</button>
              </div>`;
            }).join('');
          })();

          return `
            <div class="inv-item-row">
              <div class="inv-item-main">
                <div class="inv-item-name">${item.name}</div>
                <div class="inv-item-status">
                  <div class="inv-par-bar-wrap">
                    <div class="inv-par-bar ${state}" style="width:${pct}%"></div>
                  </div>
                  <span class="inv-par-text ${state}">${statusText}</span>${usedLine}
                </div>
                <div class="inv-batches">${batchLines}</div>
                <div class="inv-receive-form" id="receive-${item.id}" style="display:none;flex-wrap:wrap;gap:6px">
                  <input type="number" class="inv-receive-qty" placeholder="Qty (${item.unit})" step="0.5" min="0" id="rqty-${item.id}">
                  <div style="display:flex;flex-direction:column;gap:2px">
                    <span style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px">Expiry</span>
                    <input type="date" class="inv-receive-date" id="rdate-${item.id}">
                  </div>
                  <div style="display:flex;flex-direction:column;gap:2px">
                    <span style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px">Bought</span>
                    <input type="date" class="inv-receive-date" id="rpurchase-${item.id}">
                  </div>
                  <button class="btn btn-sm btn-accent" style="align-self:flex-end" onclick="addBatch(${item.id})">Add</button>
                </div>
                <div class="inv-item-edit-form" id="item-edit-${item.id}" style="display:none">
                  <div class="row" style="gap:6px">
                    <div class="field"><label>Name</label><input type="text" id="ie-name-${item.id}" value="${item.name.replace(/"/g, '&quot;')}"></div>
                    <div class="field"><label>Unit</label><input type="text" id="ie-unit-${item.id}" value="${item.unit}"></div>
                  </div>
                  <div class="row" style="gap:6px">
                    <div class="field"><label>Par level</label><input type="number" id="ie-par-${item.id}" value="${item.par_level}" step="0.5" min="0"></div>
                    <div class="field"><label>Category</label><input type="text" id="ie-cat-${item.id}" value="${item.category}"></div>
                  </div>
                  <div class="row" style="gap:6px">
                    <div class="field"><label>Cost/unit $</label><input type="number" id="ie-cost-${item.id}" value="${item.cost_per_unit}" step="0.01" min="0"></div>
                    <div class="field"><label>Expiry date</label><input type="date" id="ie-exp-${item.id}" value="${item.expiry_date || ''}"></div>
                  </div>
                  <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                    <button class="btn btn-sm btn-ghost" onclick="toggleItemEdit(${item.id})">Cancel</button>
                    <button class="btn btn-sm btn-danger" onclick="removeItem(${item.id})">Delete item</button>
                    <button class="btn btn-sm btn-accent" onclick="saveItem(${item.id})">Save</button>
                  </div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
                <button class="btn btn-sm btn-ghost" onclick="toggleItemEdit(${item.id})">Edit item</button>
                <button class="btn btn-sm btn-ghost" onclick="toggleReceive(${item.id})" id="rbtn-${item.id}">+ Receive</button>
                <input class="inv-count-input ${countMode ? 'visible' : ''}" type="number"
                  step="0.5" min="0" placeholder="${count ?? '—'}" data-id="${item.id}"
                  oninput="countValues[${item.id}] = this.value; updateCountSaveLabel()">
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

async function submitCounts() {
  const entries = Object.entries(countValues)
    .filter(([, v]) => v !== '')
    .map(([item_id, count]) => ({ item_id: Number(item_id), count: Number(count) }));
  if (!entries.length) { toast('Enter at least one count', 'error'); return; }
  await api('POST', '/api/inventory/counts', entries);
  cancelCountMode();
  toast(`${entries.length} count${entries.length > 1 ? 's' : ''} saved`, 'success');
  await loadInventory();
}

function toggleReceive(itemId) {
  const form = document.getElementById(`receive-${itemId}`);
  const btn  = document.getElementById(`rbtn-${itemId}`);
  const open = form.style.display === 'none';
  form.style.display = open ? 'flex' : 'none';
  btn.textContent = open ? '✕ Cancel' : '+ Receive';
  if (open) document.getElementById(`rqty-${itemId}`)?.focus();
}

async function addBatch(itemId) {
  const qty      = document.getElementById(`rqty-${itemId}`).value;
  const expiry   = document.getElementById(`rdate-${itemId}`).value;
  const purchase = document.getElementById(`rpurchase-${itemId}`).value;
  if (!qty || Number(qty) <= 0) { toast('Enter a quantity', 'error'); return; }
  if (!expiry) { toast('Set an expiry date', 'error'); return; }
  const today = new Date().toISOString().slice(0, 10);
  await api('POST', '/api/inventory/batches', {
    item_id: itemId, qty: Number(qty), expiry_date: expiry,
    purchase_date: purchase || today,
  });
  toast('Batch added', 'success');
  await loadInventory();
}

async function deleteBatch(batchId) {
  await api('DELETE', `/api/inventory/batches/${batchId}`);
  toast('Batch removed');
  await loadInventory();
}

function toggleBatchEdit(id) {
  const row = document.getElementById(`batch-row-${id}`);
  const form = document.getElementById(`batch-edit-${id}`);
  const isOpen = form.style.display !== 'none';
  row.style.display = isOpen ? 'flex' : 'none';
  form.style.display = isOpen ? 'none' : 'flex';
}

async function saveBatch(id) {
  const qty = document.getElementById(`be-qty-${id}`).value;
  const expiry_date = document.getElementById(`be-exp-${id}`).value;
  if (!qty || Number(qty) <= 0) { toast('Enter a quantity', 'error'); return; }
  if (!expiry_date) { toast('Set an expiry date', 'error'); return; }
  await api('PATCH', `/api/inventory/batches/${id}`, { qty: Number(qty), expiry_date });
  toast('Batch updated', 'success');
  await loadInventory();
}

function toggleItemEdit(id) {
  const form = document.getElementById(`item-edit-${id}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveItem(id) {
  const name = document.getElementById(`ie-name-${id}`).value.trim();
  const unit = document.getElementById(`ie-unit-${id}`).value.trim();
  const par_level = document.getElementById(`ie-par-${id}`).value;
  const category = document.getElementById(`ie-cat-${id}`).value.trim().toLowerCase();
  const cost_per_unit = document.getElementById(`ie-cost-${id}`).value;
  const expiry_date = document.getElementById(`ie-exp-${id}`).value;
  if (!name || !unit || !category) { toast('Fill required fields', 'error'); return; }
  await api('PUT', `/api/inventory/items/${id}`, {
    name, unit, par_level: Number(par_level) || 0,
    category, cost_per_unit: Number(cost_per_unit) || 0,
    expiry_date: expiry_date || null,
  });
  toast('Item updated', 'success');
  await loadInventory();
}

async function removeItem(id) {
  await api('DELETE', `/api/inventory/items/${id}`);
  toast('Item removed');
  await loadInventory();
}

async function addItem() {
  const name = document.getElementById('new-item-name').value.trim();
  const unit = document.getElementById('new-item-unit').value.trim();
  const par_level = document.getElementById('new-item-par').value;
  const category = document.getElementById('new-item-category').value.trim().toLowerCase();
  const cost_per_unit = document.getElementById('new-item-cost').value;
  const stock = document.getElementById('new-item-stock').value;
  const expiry_date = document.getElementById('new-item-expiry').value;
  if (!name)          { toast('Enter an item name', 'error'); return; }
  if (!unit)          { toast('Enter a unit (lbs, cases…)', 'error'); return; }
  if (!par_level)     { toast('Enter a par level', 'error'); return; }
  if (!category)      { toast('Enter a category', 'error'); return; }
  if (!cost_per_unit) { toast('Enter cost per unit', 'error'); return; }
  if (!expiry_date)   { toast('Enter an expiry date', 'error'); return; }
  const item = await api('POST', '/api/inventory/items', {
    name, unit, par_level: Number(par_level) || 0,
    category, cost_per_unit: Number(cost_per_unit) || 0,
    expiry_date,
  });
  const id = item.lastInsertRowid;
  if (stock !== '' && Number(stock) >= 0) {
    await api('POST', '/api/inventory/counts', [{ item_id: id, count: Number(stock) }]);
  }
  if (stock && Number(stock) > 0) {
    await api('POST', '/api/inventory/batches', { item_id: id, qty: Number(stock), expiry_date });
  }
  ['new-item-name','new-item-unit','new-item-par','new-item-category','new-item-cost','new-item-stock','new-item-expiry']
    .forEach(id => document.getElementById(id).value = '');
  toast(`${name} added`, 'success');
  await loadInventory();
}

// ── EOD checklist ─────────────────────────────────────────────────────────────

const eodState = { values: {}, checked: new Set() };

const EOD_STEPS = [
  {
    id: 'sales', title: 'Covers & sales',
    render: () => `
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>Covers</label>
          <input type="number" id="eod-covers" placeholder="0"
            value="${eodState.values['eod-covers'] ?? ''}"
            oninput="eodState.values['eod-covers']=this.value">
        </div>
        <div class="field" style="flex:1"><label>Total sales $</label>
          <input type="number" id="eod-sales" placeholder="0.00" step="0.01"
            value="${eodState.values['eod-sales'] ?? ''}"
            oninput="eodState.values['eod-sales']=this.value">
        </div>
      </div>`,
    check() {
      if (!eodState.values['eod-covers']) { toast('Enter covers count', 'error'); return false; }
      if (!eodState.values['eod-sales']) { toast('Enter total sales', 'error'); return false; }
      return true;
    },
    summary: () => `${eodState.values['eod-covers']} covers · $${Number(eodState.values['eod-sales']).toFixed(2)} sales`,
  },
  {
    id: 'cash', title: 'Cash & card reconciled',
    render: () => `
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>Cash $</label>
          <input type="number" id="eod-cash" placeholder="0.00" step="0.01"
            value="${eodState.values['eod-cash'] ?? ''}"
            oninput="eodState.values['eod-cash']=this.value">
        </div>
        <div class="field" style="flex:1"><label>Card $</label>
          <input type="number" id="eod-card" placeholder="0.00" step="0.01"
            value="${eodState.values['eod-card'] ?? ''}"
            oninput="eodState.values['eod-card']=this.value">
        </div>
      </div>`,
    check() {
      if (eodState.values['eod-cash'] == null || eodState.values['eod-cash'] === '') { toast('Enter cash total', 'error'); return false; }
      if (eodState.values['eod-card'] == null || eodState.values['eod-card'] === '') { toast('Enter card total', 'error'); return false; }
      return true;
    },
    summary: () => `Cash $${Number(eodState.values['eod-cash']).toFixed(2)} · Card $${Number(eodState.values['eod-card']).toFixed(2)}`,
  },
  {
    id: 'expenses', title: 'Daily expenses logged',
    render: () => {
      const cf = eodState.cashflow || {};
      const laborTotal     = cf.labor_total     || 0;
      const inventoryTotal = cf.inventory_total  || 0;
      const otherTotal     = cf.other_total      || 0;
      const otherCount     = (cf.other_expenses  || []).length;
      const totalExp       = cf.total_expenses   || 0;
      const rows = [
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
           <span style="color:var(--text-3)">Labor</span><span>$${Number(laborTotal).toFixed(2)}</span></div>`,
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
           <span style="color:var(--text-3)">Inventory purchased</span><span>$${Number(inventoryTotal).toFixed(2)}</span></div>`,
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
           <span style="color:var(--text-3)">Other (${otherCount} item${otherCount !== 1 ? 's' : ''})</span><span>$${Number(otherTotal).toFixed(2)}</span></div>`,
        `<div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-size:13px;font-weight:700;border-top:1px solid var(--border);margin-top:4px">
           <span>Total expenses</span><span>$${Number(totalExp).toFixed(2)}</span></div>`,
      ].join('');
      return `<div>${rows}<div style="margin-top:8px;font-size:12px;color:var(--text-3)">
        <a href="#" onclick="switchTab('cashflow');return false;" style="color:var(--accent)">Edit in Cash Flow tab</a>
      </div></div>`;
    },
    check() { return true; },
    skip: 'No expenses today',
    summary: () => {
      const cf = eodState.cashflow || {};
      const total = cf.total_expenses || 0;
      return total > 0 ? `Total expenses $${Number(total).toFixed(2)}` : 'No expenses today';
    },
  },
  {
    id: 'ranout', title: "86'd tonight", skip: "Nothing 86'd",
    render: () => `
      <input type="text" id="eod-ranout" placeholder="e.g. salmon, oat milk"
        value="${eodState.values['eod-ranout'] ?? ''}"
        oninput="eodState.values['eod-ranout']=this.value">`,
    check() { if (eodState.values['eod-ranout'] == null) eodState.values['eod-ranout'] = ''; return true; },
    summary: () => eodState.values['eod-ranout'] || "Nothing 86'd tonight",
  },
  {
    id: 'notes', title: 'Note for opener', skip: 'No notes',
    render: () => `
      <textarea id="eod-notes" placeholder="Anything they need to know…"
        oninput="eodState.values['eod-notes']=this.value">${eodState.values['eod-notes'] ?? ''}</textarea>`,
    check() { if (eodState.values['eod-notes'] == null) eodState.values['eod-notes'] = ''; return true; },
    summary: () => eodState.values['eod-notes'] || 'No notes left',
  },
  {
    id: 'opener', title: 'Opener assigned',
    render: () => `
      <input type="text" id="eod-opener" placeholder="Name"
        value="${eodState.values['eod-opener'] ?? ''}"
        oninput="eodState.values['eod-opener']=this.value">`,
    check() {
      if (!eodState.values['eod-opener']) { toast("Enter tomorrow's opener", 'error'); return false; }
      return true;
    },
    summary: () => `${eodState.values['eod-opener']} opening tomorrow`,
  },
];

function renderEodChecklist() {
  const done = EOD_STEPS.filter(s => eodState.checked.has(s.id)).length;
  const total = EOD_STEPS.length;
  const nextIdx = EOD_STEPS.findIndex(s => !eodState.checked.has(s.id));

  document.getElementById('eod-progress-fill').style.width = `${(done / total) * 100}%`;
  document.getElementById('eod-progress-label').textContent =
    done === total ? 'All done — ready to close ✓' : `${done} of ${total} completed`;

  const saveBtn = document.getElementById('eod-save-btn');
  saveBtn.disabled = done < total;
  saveBtn.textContent = done === total ? 'Close night ✓' : 'Close night';

  document.getElementById('eod-checklist').innerHTML = EOD_STEPS.map((step, i) => {
    const isDone = eodState.checked.has(step.id);
    const isNext = i === nextIdx;
    return `
      <div class="eod-check-item ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''}">
        <div class="eod-check-circle ${isDone ? 'checked' : ''}" ${isDone ? `onclick="eodUncheck('${step.id}')"` : ''}>
          ${isDone ? '✓' : (i + 1)}
        </div>
        <div class="eod-check-content">
          <div class="eod-check-title">${step.title}</div>
          ${isDone ? `
            <div class="eod-check-summary">${step.summary()}</div>
            <button class="btn btn-sm btn-ghost" onclick="eodUncheck('${step.id}')">Edit</button>
          ` : `
            <div class="eod-check-fields">${step.render()}</div>
            <div class="eod-check-actions">
              ${step.skip ? `<button class="btn btn-sm btn-ghost" onclick="eodSkip('${step.id}')">${step.skip}</button>` : ''}
              <button class="btn btn-sm btn-accent" onclick="eodCheck('${step.id}')">Mark done</button>
            </div>
          `}
        </div>
      </div>`;
  }).join('');
}

function eodCheck(stepId) {
  const step = EOD_STEPS.find(s => s.id === stepId);
  if (!step.check()) return;
  eodState.checked.add(stepId);
  renderEodChecklist();
}

function eodSkip(stepId) {
  const step = EOD_STEPS.find(s => s.id === stepId);
  step.check();
  eodState.checked.add(stepId);
  renderEodChecklist();
}

function eodUncheck(stepId) {
  eodState.checked.delete(stepId);
  renderEodChecklist();
}

async function loadEod() {
  document.getElementById('eod-date').value = today();
  await Promise.all([reloadEodForDate(), loadEodHistory()]);
}

async function reloadEodForDate() {
  const date = document.getElementById('eod-date').value;
  if (!date) return;
  const [log, dishSales, cashflow] = await Promise.all([
    api('GET', `/api/eod/log/${date}`),
    api('GET', `/api/menu/sales/${date}`),
    api('GET', `/api/expenses/day/${date}`).catch(() => null),
  ]);
  eodState.cashflow = cashflow || {};
  eodState.values = {};
  eodState.checked = new Set();

  // Pre-fill from dish sales (computed totals)
  if (dishSales?.length) {
    const totalRevenue = dishSales.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalCovers  = dishSales.reduce((s, r) => s + (r.qty_sold || 0), 0);
    eodState.values['eod-sales']   = totalRevenue.toFixed(2);
    eodState.values['eod-covers']  = totalCovers;
  }

  // Saved EOD log overrides the pre-fill and restores all steps as checked
  if (log?.date) {
    eodState.values['eod-covers'] = log.covers ?? eodState.values['eod-covers'] ?? '';
    eodState.values['eod-sales']  = log.sales_total ?? eodState.values['eod-sales'] ?? '';
    eodState.values['eod-cash']   = log.cash_total ?? '';
    eodState.values['eod-card']   = log.card_total ?? '';
    eodState.values['eod-ranout'] = log.ran_out ?? '';
    eodState.values['eod-notes']  = log.notes ?? '';
    eodState.values['eod-opener'] = log.opener_name ?? '';
    EOD_STEPS.forEach(s => eodState.checked.add(s.id));
  }

  renderEodChecklist();
}

async function saveEod() {
  const date = document.getElementById('eod-date').value;
  if (!date) { toast('Select a date', 'error'); return; }
  await api('POST', '/api/eod', {
    date,
    covers: Number(eodState.values['eod-covers']) || null,
    sales_total: Number(eodState.values['eod-sales']) || null,
    cash_total: Number(eodState.values['eod-cash']) || null,
    card_total: Number(eodState.values['eod-card']) || null,
    ran_out: eodState.values['eod-ranout'] || null,
    notes: eodState.values['eod-notes'] || null,
    opener_name: eodState.values['eod-opener'] || null,
  });
  toast('Night closed ✓', 'success');
  await loadEodHistory();
}

async function loadEodHistory() {
  const logs = await api('GET', '/api/eod/recent');
  document.getElementById('eod-history').innerHTML = logs.length
    ? logs.map(l => `
        <div class="eod-row">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div class="eod-date">${fmt.date(l.date)}${l.opener_name ? ` <span style="font-weight:400;color:var(--text-2);font-size:13px">· opener: ${l.opener_name}</span>` : ''}</div>
            <button class="btn btn-sm btn-danger" style="flex-shrink:0" onclick="deleteEodLog('${l.date}')">Delete</button>
          </div>
          <div class="eod-stats">
            <span><span class="eod-stat-val">${l.covers ?? '—'}</span> covers</span>
            <span><span class="eod-stat-val">${fmt.money(l.sales_total)}</span> sales</span>
            ${l.cash_total != null ? `<span><span class="eod-stat-val">${fmt.money(l.cash_total)}</span> cash</span>` : ''}
          </div>
          ${l.ran_out ? `<span class="eod-tag eod-tag-ranout">86'd: ${l.ran_out}</span>` : ''}
          ${l.notes ? `<div style="font-size:12px;color:var(--text-2);margin-top:5px">${l.notes}</div>` : ''}
        </div>`).join('')
    : '<div class="empty">No logs yet</div>';
}

async function deleteEodLog(date) {
  await api('DELETE', `/api/eod/log/${date}`);
  toast('Log deleted');
  await loadEodHistory();
}

// ── EOD Export ────────────────────────────────────────────────────────────────

function setExportRange(preset) {
  const now = new Date();
  let start, end;
  if (preset === 'week') {
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    start = mon.toISOString().slice(0, 10);
    end   = sun.toISOString().slice(0, 10);
  } else {
    start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end = last.toISOString().slice(0, 10);
  }
  document.getElementById('export-start').value = start;
  document.getElementById('export-end').value   = end;
}

function downloadEodCsv() {
  const start = document.getElementById('export-start').value;
  const end   = document.getElementById('export-end').value;
  if (!start || !end) { toast('Set a date range first', 'error'); return; }
  window.location.href = `/api/eod/export?start=${start}&end=${end}`;
}

// ── Cash Flow ─────────────────────────────────────────────────────────────────

async function loadCashFlow() {
  const date = document.getElementById('cf-date').value;
  if (!date) return;
  const d = await api('GET', `/api/expenses/day/${date}`);

  // Stats bar
  const net = d.net;
  const netColor = net >= 0 ? 'var(--success)' : 'var(--danger)';
  document.getElementById('cf-stats').innerHTML = `
    <div class="inv-stat-card">
      <div class="inv-stat-val success">$${Number(d.revenue).toFixed(2)}</div>
      <div class="inv-stat-label">Revenue</div>
    </div>
    <div class="inv-stat-card">
      <div class="inv-stat-val danger">$${Number(d.total_expenses).toFixed(2)}</div>
      <div class="inv-stat-label">Total expenses</div>
    </div>
    <div class="inv-stat-card">
      <div class="inv-stat-val" style="color:${netColor}">$${Number(Math.abs(net)).toFixed(2)}</div>
      <div class="inv-stat-label">${net >= 0 ? 'Net profit' : 'Net loss'}</div>
    </div>`;

  // Revenue
  document.getElementById('cf-revenue-val').textContent = d.revenue ? `$${Number(d.revenue).toFixed(2)}` : '—';
  document.getElementById('cf-revenue-note').innerHTML = d.revenue
    ? `From dish sales logged for this date · <a href="#" onclick="switchTab('sales');return false;" style="color:var(--accent)">View in Sales</a>`
    : `No dish sales logged for this date · <a href="#" onclick="switchTab('sales');return false;" style="color:var(--accent)">Log in Sales</a>`;

  // Labor
  document.getElementById('cf-labor-total').textContent = `$${Number(d.labor_total).toFixed(2)}`;
  document.getElementById('cf-labor-list').innerHTML = d.labor.length
    ? d.labor.map(r => `
        <div style="display:flex;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border)">
          <span>${r.name} <span style="color:var(--text-3);font-size:12px">${r.role} · ${r.hours}h × $${Number(r.hourly_rate).toFixed(2)}/hr</span></span>
          <span style="font-weight:600">$${Number(r.cost).toFixed(2)}</span>
        </div>`).join('')
    : '<div style="padding:12px 16px;color:var(--text-3);font-size:13px">No shifts scheduled</div>';

  // Inventory
  document.getElementById('cf-inv-total').textContent = `$${Number(d.inventory_total).toFixed(2)}`;
  document.getElementById('cf-inv-list').innerHTML = d.inventory.length
    ? d.inventory.map(r => `
        <div style="display:flex;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border)">
          <span>${r.name} <span style="color:var(--text-3);font-size:12px">${Number(r.qty).toFixed(1)} ${r.unit} × $${Number(r.cost_per_unit).toFixed(2)}</span></span>
          <span style="font-weight:600">$${Number(r.total_cost).toFixed(2)}</span>
        </div>`).join('')
    : '<div style="padding:12px 16px;color:var(--text-3);font-size:13px">No inventory purchases logged</div>';

  // Other expenses
  document.getElementById('cf-other-total').textContent = `$${Number(d.other_total).toFixed(2)}`;
  document.getElementById('cf-other-list').innerHTML = d.other_expenses.length
    ? d.other_expenses.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
          <span>${r.description}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600">$${Number(r.amount).toFixed(2)}</span>
            <button class="btn btn-icon btn-danger" onclick="deleteExpense(${r.id})" title="Remove">✕</button>
          </span>
        </div>`).join('')
    : '';
}

async function addExpense() {
  const desc   = document.getElementById('cf-exp-desc').value.trim();
  const amount = document.getElementById('cf-exp-amount').value;
  const date   = document.getElementById('cf-date').value;
  if (!desc)   { toast('Enter a description', 'error'); return; }
  if (!amount || Number(amount) <= 0) { toast('Enter an amount', 'error'); return; }
  await api('POST', '/api/expenses', { date, description: desc, amount: Number(amount) });
  document.getElementById('cf-exp-desc').value   = '';
  document.getElementById('cf-exp-amount').value = '';
  toast('Expense added', 'success');
  await loadCashFlow();
}

async function deleteExpense(id) {
  await api('DELETE', `/api/expenses/${id}`);
  toast('Expense removed');
  await loadCashFlow();
}

function initCashFlow() {
  document.getElementById('cf-date').value = today();
  loadCashFlow();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const sec = document.getElementById(`tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (sec) sec.classList.add('active');
  if (tabName === 'cashflow') initCashFlow();
  if (tabName === 'recipes')  loadRecipesTab();
  if (tabName === 'sales')    loadSalesTab();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  if (btn.dataset.tab === 'recipes')  btn.addEventListener('click', loadRecipesTab);
  if (btn.dataset.tab === 'sales')    btn.addEventListener('click', loadSalesTab);
  if (btn.dataset.tab === 'cashflow') btn.addEventListener('click', initCashFlow);
  if (btn.dataset.tab === 'eod')      btn.addEventListener('click', loadEod);
});

(async () => {
  await Promise.all([loadStaff(), loadInventory(), loadEod()]);
  await Promise.all([loadSchedule(), loadClockEntries()]);
})();
