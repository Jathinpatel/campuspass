'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type Human from '@vladmandic/human';

type Student = { id: string; name: string; reg: string; className: string; year: string; uid: string; color: string; faceSamples?: number[][] };
type Attendance = { id: string; studentId: string; date: string; checkIn: string; checkOut: string; method: string; status: string };
type Tab = 'Overview' | 'Recognition' | 'Attendance' | 'Students';

const initialStudents: Student[] = [
  { id: 'sri', name: 'Demo Student 1', reg: 'DEMO-001', className: 'CSE F', year: 'Year 4', uid: 'DEMOUID01', color: 'lavender' },
  { id: 'demo-002', name: 'Demo Student 2', reg: 'DEMO-002', className: 'CSE F', year: 'Year 4', uid: 'DEMOUID02', color: 'mint' },
  { id: 'demo-003', name: 'Demo Student 3', reg: 'DEMO-003', className: 'CSE F', year: 'Year 4', uid: 'DEMOUID03', color: 'peach' },
];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = dateKey(new Date());
const utcToday = new Date().toISOString().slice(0, 10);
const seedRecords: Attendance[] = [{ id: 'demo-1', studentId: 'sri', date: today, checkIn: '09:08', checkOut: '', method: 'Face', status: 'Present' }];
const prettyDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
let faceEnginePromise: Promise<Human> | null = null;
async function getFaceEngine(): Promise<Human> {
  if (!faceEnginePromise) {
    faceEnginePromise = (async () => {
      const { default: HumanEngine } = await import('../../node_modules/@vladmandic/human/dist/human.esm.js');
      const engine = new HumanEngine({
        backend: 'webgl', modelBasePath: '/models/', cacheModels: true, debug: false,
        face: {
          enabled: true,
          detector: { enabled: true, modelPath: 'blazeface.json', maxDetected: 1, minConfidence: 0.45 },
          mesh: { enabled: true, modelPath: 'facemesh.json' },
          description: { enabled: true, modelPath: 'faceres.json' },
          iris: { enabled: false }, emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false },
        },
        body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
      });
      await engine.load();
      return engine;
    })();
  }
  return faceEnginePromise;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [records, setRecords] = useState<Attendance[]>(seedRecords);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All classes');
  const [statusFilter, setStatusFilter] = useState('All status');
  const [notice, setNotice] = useState('');
  const [uid, setUid] = useState('');
  const [manualStudent, setManualStudent] = useState(initialStudents[0].id);
  const [action, setAction] = useState<'Check in' | 'Check out'>('Check in');
  const [showForm, setShowForm] = useState(false);
  const [uidStudent, setUidStudent] = useState<Student | null>(null);
  const [cardUidInput, setCardUidInput] = useState('');
  const [form, setForm] = useState({ name: '', reg: '', className: 'CSE F', year: 'Year 4', uid: '' });
  const [cameraOn, setCameraOn] = useState(false);
  const [faceMode, setFaceMode] = useState<'recognize' | 'enroll'>('recognize');
  const [faceBusy, setFaceBusy] = useState(false);
  const [weekdayLabel, setWeekdayLabel] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      const savedStudents = localStorage.getItem('campuspass-students');
      const savedRecords = localStorage.getItem('campuspass-records');
      if (savedStudents) setStudents(JSON.parse(savedStudents));
      if (savedRecords) {
        const storedRecords: Attendance[] = JSON.parse(savedRecords);
        const dateFixDone = localStorage.getItem('campuspass-local-date-fix-v1') === 'done';
        const correctedRecords = !dateFixDone && utcToday !== today
          ? storedRecords.map(record => record.date === utcToday ? { ...record, date: today } : record)
          : storedRecords;
        localStorage.setItem('campuspass-local-date-fix-v1', 'done');
        setRecords(correctedRecords);
      }
    } catch { /* Keep the example data if browser storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    setWeekdayLabel(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase());
  }, []);
  useEffect(() => { if (ready) localStorage.setItem('campuspass-students', JSON.stringify(students)); }, [students, ready]);
  useEffect(() => { if (ready) localStorage.setItem('campuspass-records', JSON.stringify(records)); }, [records, ready]);
  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);
  useEffect(() => { if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current; }, [cameraOn]);

  const todayRecords = records.filter(r => r.date === today);
  const presentCount = new Set(todayRecords.map(r => r.studentId)).size;
  const onCampus = todayRecords.filter(r => r.checkIn && !r.checkOut).length;
  const profileStudent = students.find(student => student.id === 'sri') || students[0];
  const profileInitials = profileStudent?.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'CA';
  const filtered = useMemo(() => records.filter(record => {
    if (record.date !== selectedDate) return false;
    const student = students.find(s => s.id === record.studentId);
    if (!student) return false;
    const searchMatch = `${student.name} ${student.reg}`.toLowerCase().includes(query.toLowerCase());
    return searchMatch && (classFilter === 'All classes' || student.className === classFilter) && (statusFilter === 'All status' || record.status === statusFilter);
  }), [records, students, selectedDate, query, classFilter, statusFilter]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3500); };
  const logAttendance = (student: Student | undefined, method: string) => {
    if (!student) { flash('Select a registered student first.'); return; }
    const existing = records.find(r => r.studentId === student.id && r.date === today);
    if (action === 'Check in' && existing?.checkIn) { flash(`${student.name} is already checked in today.`); return; }
    if (action === 'Check out' && (!existing || existing.checkOut)) { flash(existing ? `${student.name} has already checked out.` : `${student.name} has no check-in to close.`); return; }
    const time = clock();
    if (existing) setRecords(records.map(r => r.id === existing.id ? { ...r, checkOut: time } : r));
    else setRecords([{ id: crypto.randomUUID(), studentId: student.id, date: today, checkIn: time, checkOut: '', method, status: 'Present' }, ...records]);
    flash(`${action} recorded for ${student.name} using ${method}.`);
  };
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { flash('Camera access is unavailable in this browser.'); return; }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setCameraOn(true);
      flash('Camera ready. Enroll each student before face identification.');
    } catch { flash('Camera permission was not granted. Use the card UID or manual entry.'); }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCameraOn(false); };
  const handleRegistration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (students.some(s => s.reg.toLowerCase() === form.reg.trim().toLowerCase())) { flash('That register number is already enrolled.'); return; }
    const student: Student = { ...form, id: crypto.randomUUID(), name: form.name.trim(), reg: form.reg.trim().toUpperCase(), uid: form.uid.trim().toUpperCase(), color: ['lavender', 'mint', 'peach'][students.length % 3] };
    setStudents([...students, student]); setForm({ name: '', reg: '', className: 'CSE F', year: 'Year 4', uid: '' }); setShowForm(false); flash(`${student.name} was added to the student list.`);
  };
  const exportCsv = () => {
    const lines = [['Date', 'Name', 'Register number', 'Class', 'Check in', 'Check out', 'Method', 'Status'], ...filtered.map(r => { const s = students.find(item => item.id === r.studentId)!; return [prettyDate(r.date), s.name, s.reg, s.className, r.checkIn, r.checkOut, r.method, r.status]; })];
    const csv = lines.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `campuspass-${selectedDate}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const onUidChange = (event: ChangeEvent<HTMLInputElement>) => setUid(event.target.value.toUpperCase());
  const scanUid = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const student = students.find(s => s.uid && s.uid.toUpperCase() === uid.trim().toUpperCase()); if (!student) { flash('Card UID not found. Check the number or use manual entry.'); return; } logAttendance(student, 'RFID'); setUid(''); };
  const handleFaceAction = async () => {
    if (!cameraOn || !videoRef.current) { flash('Start the camera first.'); return; }
    setFaceBusy(true);
    try {
      const engine = await getFaceEngine();
      const result = await engine.detect(videoRef.current);
      const embedding = result.face.find(face => face.embedding?.length)?.embedding;
      if (!embedding) { flash('No clear face found. Look at the camera in good light and try again.'); return; }
      if (faceMode === 'enroll') {
        const student = students.find(s => s.id === manualStudent);
        if (!student) { flash('Select a student to enroll.'); return; }
        setStudents(current => current.map(s => s.id === student.id ? { ...s, faceSamples: [...(s.faceSamples || []), embedding] } : s));
        setFaceMode('recognize');
        flash(`Face sample saved for ${student.name}. Add another sample in different lighting for better matching.`);
        return;
      }
      let bestStudent: Student | undefined;
      let bestScore = 0;
      for (const student of students) {
        for (const sample of student.faceSamples || []) {
          const score = engine.match.similarity(embedding, sample);
          if (score > bestScore) { bestScore = score; bestStudent = student; }
        }
      }
      if (bestStudent && bestScore >= 0.55) {
        flash(`Face match: ${bestStudent.name} (${Math.round(bestScore * 100)}%).`);
        logAttendance(bestStudent, 'Face');
      } else {
        flash('No enrolled face matched. Enroll the student or use RFID/manual entry.');
      }
    } catch (error) {
      console.error('Face recognition failed', error);
      faceEnginePromise = null;
      flash('Face model could not load. Check your internet connection, then try again.');
    } finally { setFaceBusy(false); }
  };
  const saveCardUid = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uidStudent) return;
    const value = cardUidInput.trim().toUpperCase();
    if (value && students.some(student => student.id !== uidStudent.id && student.uid.toUpperCase() === value)) {
      flash('That card UID is already assigned to another student.');
      return;
    }
    setStudents(students.map(student => student.id === uidStudent.id ? { ...student, uid: value } : student));
    flash(value ? `Card UID saved for ${uidStudent.name}.` : `Card UID removed for ${uidStudent.name}.`);
    setUidStudent(null);
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">C</div><div><strong>CampusPass</strong><span>SMART ATTENDANCE</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{(['Overview', 'Recognition', 'Attendance', 'Students'] as Tab[]).map((item, i) => <button key={item} className={`nav-item ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}><span className="nav-icon">{['◫', '◎', '▤', '♙'][i]}</span>{item}{item === 'Students' && <span className="nav-count">{students.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sensor-card"><div className="sensor-icon">⌁</div><div><b>Sensor status</b><span><i className="green-dot" /> Camera ready</span><span><i className="gray-dot" /> RFID reader offline</span></div></div><div className="profile"><div className="avatar avatar-blue">{profileInitials}</div><div><b>{profileStudent?.name || 'Campus Admin'}</b><span>{profileStudent?.reg || 'Administrator'}</span></div><span className="more">···</span></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{tab}</b></div><div className="top-actions"><span className="date-chip">◷ &nbsp;{prettyDate(today)}</span><button className="help-button" title="Help">?</button><div className="avatar avatar-blue top-avatar">{profileInitials}</div></div></header>
      <div className="content">
        {tab === 'Overview' && <>
          <div className="page-heading"><div><div className="eyebrow">{weekdayLabel ? `${weekdayLabel} · ` : ''}DAILY SUMMARY</div><h1>Good morning, {profileStudent?.name || 'Campus Admin'} <span>✳</span></h1><p>Here&apos;s what&apos;s happening on campus today.</p></div><button className="primary-button" onClick={() => setTab('Recognition')}><span>＋</span> Mark attendance</button></div>
          <div className="stats-grid">
            <StatCard label="Registered students" value={students.length} note="Across all classes" icon="♙" tone="violet" />
            <StatCard label="Present today" value={presentCount} note={`${students.length ? Math.round(presentCount / students.length * 100) : 0}% attendance rate`} icon="✓" tone="green" />
            <StatCard label="Yet to check in" value={Math.max(students.length - presentCount, 0)} note="Expected today" icon="◷" tone="amber" />
            <StatCard label="On campus now" value={onCampus} note={`${todayRecords.filter(r => r.checkOut).length} checked out`} icon="⌂" tone="blue" />
          </div>
          <div className="overview-grid">
            <section className="panel arrivals-panel"><div className="panel-header"><div><h2>Recent attendance</h2><p>Latest student check-ins and check-outs</p></div><button className="text-button" onClick={() => setTab('Attendance')}>View all <span>→</span></button></div>
              {todayRecords.length ? <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>TIME</th><th>METHOD</th><th>STATUS</th></tr></thead><tbody>{todayRecords.slice(0, 5).map(r => { const s = students.find(x => x.id === r.studentId); if (!s) return null; return <tr key={r.id}><td><StudentCell student={s} /></td><td>{r.checkOut || r.checkIn}</td><td><span className="method"><span className="method-icon">{r.method === 'Face' ? '◎' : r.method === 'RFID' ? '⌁' : '♙'}</span>{r.method}</span></td><td><span className={`status-pill ${r.checkOut ? 'checked-out' : 'present'}`}><i />{r.checkOut ? 'Checked out' : 'Present'}</span></td></tr>; })}</tbody></table></div> : <EmptyState title="No attendance yet" text="New check-ins will appear here." />}
            </section>
            <section className="panel quick-panel"><div className="panel-header"><div><h2>Quick actions</h2><p>Common tasks, one click away</p></div></div><button className="quick-action" onClick={() => setShowForm(true)}><span className="quick-icon violet-bg">♙</span><span><b>Register a student</b><small>Add a student to your campus</small></span><strong>→</strong></button><button className="quick-action" onClick={() => setTab('Recognition')}><span className="quick-icon blue-bg">◎</span><span><b>Open recognition</b><small>Check in with face or card</small></span><strong>→</strong></button><div className="tip-box"><span>✦</span><div><b>Attendance tip</b><p>Use the RFID fallback if a face scan is unclear. Every event keeps its identification method.</p></div></div></section>
          </div>
          <section className="panel lower-panel"><div className="panel-header"><div><h2>Class overview</h2><p>Attendance by class for {prettyDate(today)}</p></div><button className="select-like" onClick={() => setTab('Attendance')}>Today⌄</button></div><div className="class-row"><div className="class-title"><span className="class-badge">CF</span><div><b>CSE F</b><small>Year 4 · {students.filter(s => s.className === 'CSE F').length} students</small></div></div><div className="class-progress"><div><span style={{ width: `${students.filter(s => s.className === 'CSE F').length ? presentCount / students.filter(s => s.className === 'CSE F').length * 100 : 0}%` }} /></div></div><div className="class-count"><b>{students.filter(s => s.className === 'CSE F').length ? Math.round(presentCount / students.filter(s => s.className === 'CSE F').length * 100) : 0}%</b><small>{presentCount}/{students.filter(s => s.className === 'CSE F').length} present</small></div><button className="row-arrow" onClick={() => setTab('Attendance')}>→</button></div></section>
        </>}

        {tab === 'Recognition' && <><div className="page-heading"><div><div className="eyebrow">IDENTITY · ATTENDANCE</div><h1>Recognition</h1><p>Identify a student and record their attendance.</p></div><div className="toggle-group"><button className={action === 'Check in' ? 'selected' : ''} onClick={() => setAction('Check in')}>Check in</button><button className={action === 'Check out' ? 'selected' : ''} onClick={() => setAction('Check out')}>Check out</button></div></div>
          <div className="recognition-grid"><section className="panel camera-panel"><div className="panel-header"><div><h2>Face recognition</h2><p>{faceMode === 'enroll' ? `Enrollment for ${students.find(s => s.id === manualStudent)?.name || 'selected student'}` : 'Position your face inside the frame'}</p></div><span className="live-label"><i className={cameraOn ? 'green-dot' : 'gray-dot'} />{cameraOn ? 'Camera on' : 'Camera off'}</span></div><div className={`camera-frame ${cameraOn ? 'camera-live' : ''}`}>{cameraOn ? <video ref={videoRef} autoPlay playsInline muted /> : <div className="camera-placeholder"><div className="face-outline">◉</div><span>Camera preview will appear here</span><small>Your browser will ask for camera permission</small></div>}<div className="frame-corner tl"/><div className="frame-corner tr"/><div className="frame-corner bl"/><div className="frame-corner br"/></div><div className="camera-controls">{cameraOn ? <button className="secondary-button" onClick={stopCamera}>Stop camera</button> : <button className="secondary-button" onClick={startCamera}>◎ &nbsp;Start camera</button>}<button className="primary-button" disabled={faceBusy} onClick={handleFaceAction}>{faceBusy ? 'Loading face model…' : faceMode === 'enroll' ? 'Capture enrollment' : 'Identify & record'} <span>→</span></button></div><div className="demo-note"><span>ⓘ</span> Face templates are processed locally and saved in this browser. Enroll only with the student&apos;s consent. This prototype does not check liveness.</div></section>
            <div className="right-stack"><section className="panel fallback-panel"><div className="panel-header"><div><h2>RFID fallback</h2><p>Enter the UID printed on a registered card</p></div><span className="rfid-icon">⌁</span></div><form onSubmit={scanUid}><label className="field-label" htmlFor="uid">CARD UID</label><div className="input-with-button"><input id="uid" value={uid} onChange={onUidChange} placeholder="e.g. DEMOUID01" /><button className="primary-button" type="submit">Verify</button></div></form><p className="field-hint">Demo UIDs: {students.map(s => s.uid).filter(Boolean).join(' · ') || 'None registered'}</p></section>
              <section className="panel manual-panel"><div className="panel-header"><div><h2>Manual entry</h2><p>Use when a student needs assistance</p></div><span className="manual-icon">♙</span></div><label className="field-label" htmlFor="student-select">SELECT STUDENT</label><select id="student-select" value={manualStudent} onChange={e => setManualStudent(e.target.value)}>{students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.reg}</option>)}</select><button className="secondary-button full-button" onClick={() => logAttendance(students.find(s => s.id === manualStudent), 'Manual')}>Record {action.toLowerCase()} <span>→</span></button></section></div></div>
          <section className="panel recent-panel"><div className="panel-header"><div><h2>Today&apos;s activity</h2><p>{todayRecords.length} student attendance records</p></div><button className="text-button" onClick={() => setTab('Attendance')}>Open register →</button></div>{todayRecords.length ? todayRecords.map(r => { const s = students.find(x => x.id === r.studentId); return s ? <div className="activity-row" key={r.id}><span className="activity-dot"/><StudentCell student={s}/><span className="activity-action">Checked in at {r.checkIn}{r.checkOut ? ` · Checked out at ${r.checkOut}` : ''}</span><span className="method">{r.method}</span></div> : null; }) : <EmptyState title="Nothing recorded yet" text="Choose a face, card, or manual entry method above."/>}</section>
        </>}

        {tab === 'Attendance' && <><div className="page-heading"><div><div className="eyebrow">RECORDS · DAILY REGISTER</div><h1>Attendance</h1><p>Review attendance events by date, student, and class.</p></div><button className="primary-button" onClick={exportCsv}>↓ &nbsp; Export CSV</button></div><section className="panel attendance-panel"><div className="filter-row"><label className="date-input">▦ <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}/></label><label className="search-input">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students..."/></label><select value={classFilter} onChange={e => setClassFilter(e.target.value)}><option>All classes</option>{Array.from(new Set(students.map(s => s.className))).map(c => <option key={c}>{c}</option>)}</select><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All status</option><option>Present</option><option>Late</option></select></div><div className="register-caption"><b>{prettyDate(selectedDate)}</b><span>{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</span></div>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>CLASS</th><th>CHECK IN</th><th>CHECK OUT</th><th>METHOD</th><th>STATUS</th></tr></thead><tbody>{filtered.map(r => { const s = students.find(x => x.id === r.studentId)!; return <tr key={r.id}><td><StudentCell student={s}/></td><td>{s.className}<small className="cell-sub">{s.year}</small></td><td>{r.checkIn || '—'}</td><td>{r.checkOut || '—'}</td><td><span className="method"><span className="method-icon">{r.method.startsWith('Face') ? '◎' : r.method === 'RFID' ? '⌁' : '♙'}</span>{r.method}</span></td><td><span className="status-pill present"><i/>{r.status}</span></td></tr>; })}</tbody></table></div> : <EmptyState title="No matching records" text="Try another date or adjust your filters."/>}<div className="table-footer">Showing {filtered.length} of {records.filter(r => r.date === selectedDate).length} records <span>Times shown in your local timezone</span></div></section><div className="privacy-note">ⓘ &nbsp;Biometric data is not included in attendance exports.</div></>}

        {tab === 'Students' && <><div className="page-heading"><div><div className="eyebrow">CAMPUS DIRECTORY</div><h1>Students</h1><p>Manage registered students and their card identifiers.</p></div><button className="primary-button" onClick={() => setShowForm(true)}>＋ &nbsp; Register student</button></div><section className="panel students-panel"><div className="filter-row"><label className="search-input">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or register number..."/></label><span className="student-total">{students.length} registered</span></div><div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>REGISTER NUMBER</th><th>CLASS</th><th>YEAR</th><th>CARD UID</th><th>FACE</th><th></th></tr></thead><tbody>{students.filter(s => `${s.name} ${s.reg}`.toLowerCase().includes(query.toLowerCase())).map(s => <tr key={s.id}><td><StudentCell student={s}/></td><td>{s.reg}</td><td>{s.className}</td><td>{s.year}</td><td><span className="uid-chip">{s.uid || 'Not assigned'}</span></td><td>{s.faceSamples?.length ? <span className="uid-chip">{s.faceSamples.length} sample{s.faceSamples.length === 1 ? '' : 's'}</span> : <span className="uid-chip">Not enrolled</span>}</td><td><button className="text-button" onClick={() => { setUidStudent(s); setCardUidInput(s.uid); }}>{s.uid ? 'Change UID' : 'Add UID'} </button><button className="text-button" onClick={() => { setManualStudent(s.id); setFaceMode('enroll'); setTab('Recognition'); }}>{s.faceSamples?.length ? 'Add face' : 'Enroll face'}</button></td></tr>)}</tbody></table></div><div className="table-footer">Face templates and student records are stored in this browser.</div></section></>}
      </div>
      <footer className="footer">CampusPass <span>·</span> Smart attendance for your campus <span className="footer-right">Prototype · Browser storage</span></footer>
    </section>

    {showForm && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}><form className="modal" onSubmit={handleRegistration}><button type="button" className="modal-close" onClick={() => setShowForm(false)}>×</button><div className="eyebrow">STUDENT DIRECTORY</div><h2>Register a student</h2><p>Add student details and an optional RFID card UID.</p><label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ananya Kumar"/></label><label>Register number<input required value={form.reg} onChange={e => setForm({ ...form, reg: e.target.value })} placeholder="e.g. RA2311003050001"/></label><div className="form-split"><label>Class<input required value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}/></label><label>Year<select value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}><option>Year 1</option><option>Year 2</option><option>Year 3</option><option>Year 4</option></select></label></div><label>Card UID <span className="optional">OPTIONAL</span><input value={form.uid} onChange={e => setForm({ ...form, uid: e.target.value.toUpperCase() })} placeholder="e.g. D4E5F6A1"/></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" type="submit">Add student</button></div></form></div>}
    {uidStudent && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setUidStudent(null); }}><form className="modal" onSubmit={saveCardUid}><button type="button" className="modal-close" onClick={() => setUidStudent(null)}>×</button><div className="eyebrow">STUDENT CARD</div><h2>Card UID</h2><p>Assign or update the RFID UID for {uidStudent.name}.</p><label>Card UID<input autoFocus value={cardUidInput} onChange={e => setCardUidInput(e.target.value.toUpperCase())} placeholder="Enter the UID printed on the card"/></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setUidStudent(null)}>Cancel</button><button className="primary-button" type="submit">Save UID</button></div></form></div>}
    {notice && <div className="toast"><span>✦</span>{notice}<button onClick={() => setNotice('')}>×</button></div>}
  </main>;
}

function StatCard({ label, value, note, icon, tone }: { label: string; value: number; note: string; icon: string; tone: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>;
}
function StudentCell({ student }: { student: Student }) { return <div className="student-cell"><div className={`avatar ${student.color}`}>{student.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div><div><b>{student.name}</b><small>{student.reg}</small></div></div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span>▤</span><b>{title}</b><p>{text}</p></div>; }

