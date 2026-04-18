const db = require('./index');

const scheduling = {
  // Staff
  getAllStaff: () =>
    db.prepare('SELECT * FROM staff WHERE active = 1 ORDER BY name').all(),

  addStaff: ({ name, role, phone, hourly_rate }) =>
    db.prepare('INSERT INTO staff (name, role, phone, hourly_rate) VALUES (?, ?, ?, ?)').run(name, role, phone || null, hourly_rate || 0),

  updateStaff: (id, { name, role, phone, hourly_rate }) =>
    db.prepare('UPDATE staff SET name=?, role=?, phone=?, hourly_rate=? WHERE id=?').run(name, role, phone || null, hourly_rate || 0, id),

  deactivateStaff: (id) =>
    db.prepare('UPDATE staff SET active = 0 WHERE id = ?').run(id),

  // Schedule slots
  getWeek: (startDate, endDate) =>
    db.prepare(`
      SELECT s.*, st.name AS staff_name, st.role AS staff_role
      FROM schedule_slots s
      JOIN staff st ON st.id = s.staff_id
      WHERE s.date BETWEEN ? AND ?
      ORDER BY s.date, s.start_time
    `).all(startDate, endDate),

  addSlot: ({ staff_id, date, start_time, end_time, notes }) =>
    db.prepare('INSERT INTO schedule_slots (staff_id, date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?)')
      .run(staff_id, date, start_time, end_time, notes || null),

  deleteSlot: (id) =>
    db.prepare('DELETE FROM schedule_slots WHERE id = ?').run(id),

  updateSlot: (id, { date, start_time, end_time }) =>
    db.prepare('UPDATE schedule_slots SET date=?, start_time=?, end_time=? WHERE id=?').run(date, start_time, end_time, id),

  // Clock in/out
  getClockEntries: (date) =>
    db.prepare(`
      SELECT ce.*, st.name AS staff_name
      FROM clock_entries ce JOIN staff st ON st.id = ce.staff_id
      WHERE ce.date = ? ORDER BY ce.clocked_in
    `).all(date),

  clockIn: ({ staff_id, date, clocked_in }) =>
    db.prepare('INSERT INTO clock_entries (staff_id, date, clocked_in) VALUES (?, ?, ?)').run(staff_id, date, clocked_in),

  clockOut: (id, clocked_out) =>
    db.prepare('UPDATE clock_entries SET clocked_out = ? WHERE id = ?').run(clocked_out, id),

  deleteClockEntry: (id) =>
    db.prepare('DELETE FROM clock_entries WHERE id = ?').run(id),

  getActualHours: (startDate, endDate) =>
    db.prepare(`
      SELECT st.id, st.name,
        SUM(
          CASE WHEN ce.clocked_out IS NOT NULL THEN
            (CAST(substr(ce.clocked_out,1,2) AS REAL) + CAST(substr(ce.clocked_out,4,2) AS REAL)/60) -
            (CAST(substr(ce.clocked_in,1,2) AS REAL) + CAST(substr(ce.clocked_in,4,2) AS REAL)/60)
          ELSE 0 END
        ) AS actual_hours
      FROM clock_entries ce JOIN staff st ON st.id = ce.staff_id
      WHERE ce.date BETWEEN ? AND ?
      GROUP BY ce.staff_id
    `).all(startDate, endDate),

  // Labor hours for a week
  getLaborHours: (startDate, endDate) =>
    db.prepare(`
      SELECT st.id, st.name, st.role, st.hourly_rate,
        SUM(
          (CAST(substr(end_time, 1, 2) AS REAL) + CAST(substr(end_time, 4, 2) AS REAL) / 60) -
          (CAST(substr(start_time, 1, 2) AS REAL) + CAST(substr(start_time, 4, 2) AS REAL) / 60)
        ) AS hours
      FROM schedule_slots s
      JOIN staff st ON st.id = s.staff_id
      WHERE s.date BETWEEN ? AND ?
      GROUP BY s.staff_id
      ORDER BY hours DESC
    `).all(startDate, endDate),
};

module.exports = scheduling;
