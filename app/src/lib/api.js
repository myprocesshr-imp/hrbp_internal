import { syncStoredRequestsDownloadAccess, enrichRequestDownloadAccess } from './download-policy.js';

const API_BASE = '/api';

// ── LocalStorage Mock DB fallback if wrangler is not running ──
const MOCK_DB_KEY_USERS = 'hrbp_mock_users';
const MOCK_DB_KEY_BUS = 'hrbp_mock_bus';
const MOCK_DB_KEY_PICKUP = 'hrbp_pickup_locations';
const MOCK_DB_KEY_CERT_MASTER = 'hrbp_cert_master_data';
const MOCK_DB_VERSION_KEY = 'hrbp_mock_db_version';
const MOCK_DB_VERSION = 5; // v5: Add chatchawan_tu to SEED_USERS

const SEED_USERS = [
  { id: 3, username: 'wipada.r', full_name: 'วิภาดา รักษาธรรม', emp_id: 'EMP-2024-001', email: 'wipada.r@company.com', phone: '0812345678', position: 'HR Manager', department: 'People Operation', company_name: 'Mango', role: 'hrmanager', responsible_bu: [], status: 'active', fname_e: 'Wipada', lname_e: 'Raksatham' },
  { id: 4, username: 'chaiyaphol.r', full_name: 'ชัยพล รัตนศิริ', emp_id: 'EMP-2024-015', email: 'chaiyaphol.r@company.com', phone: '0812345678', position: 'HRBP Specialist', department: 'Business Partnering', company_name: 'Mango', role: 'hrbp', responsible_bu: ['Technology'], status: 'active', fname_e: 'Chaiyaphol', lname_e: 'Rattanasiri' },
  { id: 10, username: 'chatchawan_tu', full_name: 'ชัชวาลย์ ตุลาผล', emp_id: 'EMP-10005208', email: 'chatchawan_tu@mibholding.com', phone: '0858353379', position: 'Operation Process Improvement Section Manager', department: 'Improvement', company_name: 'บริษัท ไอพี 5 จำกัด', role: 'admin', responsible_bu: [], status: 'active', start_date: '2007-07-16', fname_e: 'Chatchawan', lname_e: 'Tulaphon' },
  { id: 11, username: 'ronnachai_w', full_name: 'รณชัย วิจิตโต', emp_id: '648087', email: 'ronnachai_w@mibholding.com', phone: '0858353626', position: 'Process Development Officer', department: 'Improvement', company_name: 'บริษัท เอ็มจีที แด๊ป จำกัด', role: 'admin', responsible_bu: [], status: 'active', start_date: '2021-09-16', fname_e: 'Ronnachai', lname_e: 'Vichitto' },
  { id: 12, username: 'penpitcha_po', full_name: 'เพ็ญพิชชา พงษ์ประสิทธิ์', emp_id: '670406', email: 'penpitcha_po@mibholding.com', phone: '0858351998', position: 'HRBP Officer', department: 'HR', company_name: 'บริษัท อินเตอร์ไทยคอนสตรัคชั่น จำกัด', role: 'hrbp', responsible_bu: [], status: 'active', start_date: '2024-05-02', fname_e: 'Penpitcha', lname_e: 'Phongprasit' },
];

export function initMockDB() {
  // Version check – update version stamp (don't wipe users; merge logic below handles new seeds)
  const savedVersion = localStorage.getItem(MOCK_DB_VERSION_KEY);
  if (savedVersion !== String(MOCK_DB_VERSION)) {
    localStorage.setItem(MOCK_DB_VERSION_KEY, String(MOCK_DB_VERSION));
  }

  // Always ensure seed users exist
  const existingUsers = JSON.parse(localStorage.getItem(MOCK_DB_KEY_USERS) || '[]');
  let changed = false;
  for (const seed of SEED_USERS) {
    if (!existingUsers.find(u => u.username === seed.username)) {
      existingUsers.unshift(seed);
      changed = true;
    }
  }
  if (changed || !localStorage.getItem(MOCK_DB_KEY_USERS)) {
    localStorage.setItem(MOCK_DB_KEY_USERS, JSON.stringify(existingUsers));
  }

  if (!localStorage.getItem(MOCK_DB_KEY_BUS)) {
    const defaultBUs = [
      { id: 1, name: 'People Operation' },
      { id: 2, name: 'Business Partnering' },
      { id: 3, name: 'Marketing' },
      { id: 4, name: 'Technology' }
    ];
    localStorage.setItem(MOCK_DB_KEY_BUS, JSON.stringify(defaultBUs));
  }

  if (!localStorage.getItem(MOCK_DB_KEY_PICKUP)) {
    const defaultPickups = [
      { id: 1, name: 'DAP' },
      { id: 2, name: 'IP1-อาคารพลาซ่า2' },
      { id: 3, name: 'One BKK' }
    ];
    localStorage.setItem(MOCK_DB_KEY_PICKUP, JSON.stringify(defaultPickups));
  }

  // Migration: remove EC-20260707-9887 if present
  const existingReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
  const cleaned = existingReqs.filter(r => r.id !== 'EC-20260707-9887');
  if (cleaned.length !== existingReqs.length) {
    localStorage.setItem('hrbp_employee_requests', JSON.stringify(cleaned));
  }

  if (!localStorage.getItem('hrbp_employee_requests')) {
    const defaultRequests = [
      {
        id: 'EC-20260608-0001',
        date: '12 ต.ค. 2026',
        type: 'หนังสือรับรองเงินเดือน',
        status: 'in-review',
        statusLabel: 'อยู่ระหว่างตรวจสอบ',
        canCancel: true,
        canDownload: false,
        attachments: [
          { name: 'สลิปเงินเดือน.pdf', key: 'supporting-docs/a1b2c3d4-สลิปเงินเดือน.pdf', size: 245760 },
        ],
        user_email: 'wipada.r@company.com',
      },
      {
        id: 'EC-20260520-0942',
        date: '20 ก.ย. 2026',
        type: 'หนังสือรับรองการทำงานทั่วไป',
        status: 'approved',
        statusLabel: 'อนุมัติแล้ว',
        canCancel: false,
        canDownload: true,
        attachments: [],
        user_email: 'wipada.r@company.com',
      },
      {
        id: 'EC-20260415-0118',
        date: '15 ส.ค. 2026',
        type: 'เอกสารประกอบการขอวีซ่า',
        status: 'rejected',
        statusLabel: 'ปฏิเสธ',
        canCancel: false,
        canDownload: false,
        canResubmit: true,
        attachments: [
          { name: 'สำเนาหนังสือเดินทาง.pdf', key: 'supporting-docs/e5f6g7h8-สำเนาหนังสือเดินทาง.pdf', size: 512000 },
        ],
        user_email: 'wipada.r@company.com',
      },
      {
        id: 'EC-20260310-0023',
        date: '10 ก.ค. 2026',
        type: 'หนังสือรับรองประสบการณ์',
        status: 'approved',
        statusLabel: 'อนุมัติแล้ว',
        canCancel: false,
        canDownload: true,
        attachments: [
          { name: 'รูปโปรไฟล์.jpg', key: 'supporting-docs/i9j0k1l2-รูปโปรไฟล์.jpg', size: 102400 },
        ],
        user_email: 'wipada.r@company.com',
      },
    ];
    localStorage.setItem('hrbp_employee_requests', JSON.stringify(defaultRequests));
  }

  if (!localStorage.getItem(MOCK_DB_KEY_CERT_MASTER)) {
    const defaults = {
      companies: [
        { id: 'c1', name: 'บริษัท สิทธิชัย จำกัด', name_en: 'Sittichai Company Limited' },
        { id: 'c2', name: 'บริษัท ไทยพัฒนา อินเตอร์กรุ๊ป จำกัด', name_en: 'Thai Pattana Intergroup Company Limited' },
      ],
      addresses: [
        { id: 'a1', company_id: 'c1', address: '123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110', address_en: '123/45 Sukhumvit Rd., Khlong Toei, Bangkok 10110' },
        { id: 'a2', company_id: 'c2', address: '123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110', address_en: '123/45 Sukhumvit Rd., Khlong Toei, Bangkok 10110' },
        { id: 'a3', company_id: 'c1', address: '789 อาคารสินธร ชั้น 12 ถ.วิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330', address_en: '789 Sindhorn Building 12th Fl., Wireless Rd., Lumphini, Pathum Wan, Bangkok 10330' },
        { id: 'a4', company_id: 'c2', address: '456 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพมหานคร 10240', address_en: '456 Ramkhamhaeng Rd., Hua Mak, Bang Kapi, Bangkok 10240' },
      ],
      notes: [
        { text: 'เพื่อยื่นกู้ธนาคาร', text_en: 'For bank loan application' },
        { text: 'เพื่อขอวีซ่าประเทศ', text_en: 'For visa application' },
        { text: 'เพื่อศึกษาต่อ', text_en: 'For further education' },
        { text: 'เพื่อใช้ยื่นต่อหน่วยงานราชการ', text_en: 'For submission to government agencies' },
        { text: 'เพื่อใช้แสดงรายได้', text_en: 'For income verification' },
      ],
    };
    localStorage.setItem(MOCK_DB_KEY_CERT_MASTER, JSON.stringify(defaults));
  }
}

function handleMockRequest(path, method, body) {
  initMockDB();
  const users = JSON.parse(localStorage.getItem(MOCK_DB_KEY_USERS) || '[]');
  const bus = JSON.parse(localStorage.getItem(MOCK_DB_KEY_BUS) || '[]');

  console.warn(`[API Mock Fallback] Serving ${method} ${path}`);

  // auth
  if (path === '/auth') {
    const { action, username, profile } = body;
    if (action === 'login') {
      // Case-insensitive username match
      const user = users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());
      if (user) {
        return { user };
      }
      return { needsProvisioning: true };
    }
    if (action === 'register') {
      const existing = users.find(u => u.username.toLowerCase() === (profile.username || '').toLowerCase());
      if (existing) {
        // User already exists — just return them instead of throwing
        return { user: existing };
      }

      let assignedRole = profile.role;
      if (!assignedRole) {
        const d = (profile.department || '').toLowerCase();
        const p = (profile.position || '').toLowerCase();
        
        if (d.includes('develop') || d.includes('it ') || d.includes('programmer') || p.includes('พัฒนาระบบ') || d.includes('ทีมพัฒนาระบบ')) {
          assignedRole = 'admin';
        } else if (d.includes('hr') || d.includes('people') || d.includes('บุคคล') || p.includes('hr') || p.includes('บุคคล')) {
          if (p.includes('manager') || p.includes('director') || p.includes('ผู้จัดการ') || p.includes('ผู้อำนวยการ')) {
            assignedRole = 'hrmanager';
          } else if (p.includes('hrbp') || p.includes('business partner')) {
            assignedRole = 'hrbp';
          } else {
            assignedRole = 'hrmanager';
          }
        } else {
          assignedRole = 'employee';
        }
      }

      const newUser = {
        id: Date.now(),
        ...profile,
        // Respect role from profile, fallback to 'employee'
        role: assignedRole,
        responsible_bu: profile.responsible_bu || [],
        status: 'active'
      };
      users.push(newUser);
      localStorage.setItem(MOCK_DB_KEY_USERS, JSON.stringify(users));
      return { user: newUser };
    }
  }

  // HRMS mock fallback
  if (path.startsWith('/hrms/employee')) {
    const empId = path.split('/').pop();
    const found = users.find(u => (u.emp_id || '').toLowerCase() === empId.toLowerCase() || (u.empCode || '').toLowerCase() === empId.toLowerCase());
    if (found) {
      return {
        data: {
          employee: {
            ID_Emp: found.emp_id,
            EmpName: found.full_name,
            Department: found.department,
            Position: found.position,
            EMail: found.email,
            Sim_Number: found.phone,
            StartDate: found.start_date || '2024-01-01',
            SexID: found.sex_id || '2',
            FNameE: found.fname_e || found.full_name?.split(' ')[0] || '',
            LNameE: found.lname_e || found.full_name?.split(' ')[1] || '',
            CompanyName: found.company_name,
          }
        }
      };
    }
  }

  // users list
  if (path.startsWith('/users')) {
    const idMatch = path.match(/^\/users\/([^?]+)/);
    if (idMatch) {
      const id = idMatch[1];
      if (method === 'PUT') {
        const userIndex = users.findIndex(u => String(u.id) === String(id) || u.username === id);
        if (userIndex !== -1) {
          users[userIndex] = { ...users[userIndex], ...body };
          localStorage.setItem(MOCK_DB_KEY_USERS, JSON.stringify(users));
          return { user: users[userIndex] };
        }
        throw new Error('User not found');
      }
    } else {
      if (method === 'GET') {
        const urlObj = new URL(path, 'http://localhost');
        const role = urlObj.searchParams.get('role');
        const filtered = role ? users.filter(u => u.role === role) : users;
        return { users: filtered };
      }
    }
  }

  // business units
  if (path.startsWith('/business-units')) {
    const idMatch = path.match(/^\/business-units\/([^?]+)/);
    if (idMatch) {
      const id = idMatch[1];
      if (method === 'PUT') {
        const buIndex = bus.findIndex(b => String(b.id) === String(id));
        if (buIndex !== -1) {
          bus[buIndex].name = body.name;
          localStorage.setItem(MOCK_DB_KEY_BUS, JSON.stringify(bus));
          return { data: [bus[buIndex]] };
        }
        throw new Error('Business unit not found');
      }
      if (method === 'DELETE') {
        const filteredBUs = bus.filter(b => String(b.id) !== String(id));
        localStorage.setItem(MOCK_DB_KEY_BUS, JSON.stringify(filteredBUs));
        return { success: true };
      }
    } else {
      if (method === 'GET') {
        return { data: bus };
      }
      if (method === 'POST') {
        const existing = bus.find(b => b.name.toLowerCase() === body.name.toLowerCase());
        if (existing) {
          throw new Error('Business unit already exists');
        }
        const newBU = { id: Date.now(), name: body.name };
        bus.push(newBU);
        localStorage.setItem(MOCK_DB_KEY_BUS, JSON.stringify(bus));
        return { data: [newBU] };
      }
    }
  }

  // pickup locations
  if (path.startsWith('/pickup-locations')) {
    const pickups = JSON.parse(localStorage.getItem(MOCK_DB_KEY_PICKUP) || '[]');
    const idMatch = path.match(/^\/pickup-locations\/([^?]+)/);
    if (idMatch) {
      const id = idMatch[1];
      if (method === 'PUT') {
        const idx = pickups.findIndex(p => String(p.id) === String(id));
        if (idx !== -1) {
          pickups[idx].name = body.name;
          localStorage.setItem(MOCK_DB_KEY_PICKUP, JSON.stringify(pickups));
          return { data: [pickups[idx]] };
        }
        throw new Error('Pickup location not found');
      }
      if (method === 'DELETE') {
        const filtered = pickups.filter(p => String(p.id) !== String(id));
        localStorage.setItem(MOCK_DB_KEY_PICKUP, JSON.stringify(filtered));
        return { success: true };
      }
    } else {
      if (method === 'GET') {
        return { data: pickups };
      }
      if (method === 'POST') {
        const existing = pickups.find(p => p.name.toLowerCase() === body.name.toLowerCase());
        if (existing) {
          throw new Error('Pickup location already exists');
        }
        const newPU = { id: Date.now(), name: body.name };
        pickups.push(newPU);
        localStorage.setItem(MOCK_DB_KEY_PICKUP, JSON.stringify(pickups));
        return { data: [newPU] };
      }
    }
  }

  // certificate master data
  if (path.startsWith('/cert-master-data')) {
    const data = JSON.parse(localStorage.getItem(MOCK_DB_KEY_CERT_MASTER) || '{}');
    if (method === 'GET') {
      const key = path.replace('/cert-master-data/', '');
      if (key && data[key]) return { data: data[key] };
      return { data };
    }
    if (method === 'POST') {
      const { key, items } = body;
      if (key && Array.isArray(items)) {
        data[key] = items;
        localStorage.setItem(MOCK_DB_KEY_CERT_MASTER, JSON.stringify(data));
        return { success: true, data: items };
      }
      throw new Error('Invalid cert master data payload');
    }
  }

  // templates mock fallback
  if (path.startsWith('/templates')) {
    const defaultTemplatesKey = 'hrbp_templates';
    const templates = JSON.parse(localStorage.getItem(defaultTemplatesKey) || '[]');
    
    if (method === 'GET') {
      return { data: templates };
    }
    
    if (method === 'POST') {
      const newTmpl = body;
      templates.push(newTmpl);
      localStorage.setItem(defaultTemplatesKey, JSON.stringify(templates));
      return { data: newTmpl };
    }
    
    if (method === 'PUT') {
      const id = path.split('/').pop();
      const idx = templates.findIndex(t => t.id === id);
      if (idx !== -1) {
        templates[idx] = { ...templates[idx], ...body };
        localStorage.setItem(defaultTemplatesKey, JSON.stringify(templates));
        return { data: templates[idx] };
      }
      throw new Error('Template not found');
    }
    
    if (method === 'DELETE') {
      const id = path.split('/').pop();
      const filtered = templates.filter(t => t.id !== id);
      localStorage.setItem(defaultTemplatesKey, JSON.stringify(filtered));
      return { success: true };
    }
  }

  if (path === '/upload' && method === 'POST') {
    return {
      success: true,
      key: `supporting-docs/mock-${Date.now()}-${body.get ? body.get('file')?.name : 'file'}`,
      size: body.get ? body.get('file')?.size : 1000
    };
  }

  // requests
  if (path.startsWith('/requests')) {
    if (method === 'GET') {
      const urlObj = new URL(path, 'http://localhost');
      const page = parseInt(urlObj.searchParams.get('page') || '1');
      const limit = parseInt(urlObj.searchParams.get('limit') || '10');
      const search = (urlObj.searchParams.get('search') || '').toLowerCase();
      const status = urlObj.searchParams.get('status') || '';
      const userId = urlObj.searchParams.get('user_id') || '';

      // Generate mock requests
      const allRequests = generateMockRequests();

      // Filter by user if user_id is provided (employee view)
      let userRequests = allRequests;
      if (userId) {
        userRequests = allRequests.filter(r => r.user_email === userId);
      }

      let filtered = userRequests;
      if (search) {
        filtered = filtered.filter(r =>
          r.request_code.toLowerCase().includes(search) ||
          r.purpose.toLowerCase().includes(search)
        );
      }
      if (status) {
        filtered = filtered.filter(r => r.status === status);
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const items = filtered.slice(start, start + limit);

      // Compute stats from user's requests (unfiltered by search/status)
      const openReqs = userRequests.filter(r => r.status === 'submitted' || r.status === 'in-review').length;
      const approvedReqs = userRequests.filter(r => r.status === 'approved').length;
      const rejectedReqs = userRequests.filter(r => r.status === 'rejected').length;
      const completedReqs = approvedReqs + rejectedReqs;
      const successRate = completedReqs > 0 ? Math.round((approvedReqs / completedReqs) * 1000) / 10 : 0;

      // Estimate avg processing days — exclude cancelled-by-employee
      let totalDays = 0;
      let countWithTime = 0;
      userRequests.forEach(r => {
        if (r.status === 'cancelled') return;
        if (r.status === 'approved') {
          totalDays += 2 + (Math.abs(r.request_code.charCodeAt(r.request_code.length - 1)) % 2) * 0.5;
          countWithTime++;
        } else if (r.status === 'rejected') {
          totalDays += 1 + (Math.abs(r.request_code.charCodeAt(r.request_code.length - 2)) % 2) * 0.5;
          countWithTime++;
        }
      });
      const avgDays = countWithTime > 0 ? Math.round((totalDays / countWithTime) * 10) / 10 : 2.5;

      return {
        requests: items,
        pagination: { page, limit, total, totalPages },
        stats: { avg_days: avgDays, success_rate: successRate, open_requests: openReqs }
      };
    }

    if (method === 'POST') {
      const body = typeof bodyText === 'string' ? JSON.parse(bodyText) : {};
      const existing = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const today = new Date();
      const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const dateStr = body.date || `${today.getDate()} ${thaiMonths[today.getMonth()]} ${today.getFullYear() + 543}`;
      const idStr = body.id || ('EC-' + today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0') + '-' + String(Math.floor(Math.random() * 9000) + 1000));
      const newReq = {
        ...body,
        id: idStr,
        request_code: idStr,
        date: dateStr,
        type: body.type || 'ใบรับรองการทำงาน',
        status: 'submitted',
        statusLabel: 'รอ HR รับทราบเคส',
        canCancel: true,
        canDownload: false,
        canResubmit: false,
        attachments: body.attachments || [],
        user_email: body.user_email || ''
      };
      existing.unshift(newReq);
      localStorage.setItem('hrbp_employee_requests', JSON.stringify(existing));
      return { success: true, request: newReq };
    }

    if (method === 'PUT') {
      const id = path.replace('/requests/', '');
      const existing = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const idx = existing.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Request not found');

      const body = typeof bodyText === 'string' ? JSON.parse(bodyText) : {};

      // Merge update fields
      if (body.status) {
        existing[idx].status = body.status;
        existing[idx].statusLabel = body.statusLabel || body.status;
      }
      if (body.eta_date !== undefined) existing[idx].eta_date = body.eta_date;
      if (body.eta_submitted_at !== undefined) existing[idx].eta_submitted_at = body.eta_submitted_at;
      if (body.acknowledged_by !== undefined) existing[idx].acknowledged_by = body.acknowledged_by;
      if (body.rejection_reason !== undefined) existing[idx].rejection_reason = body.rejection_reason;
      if (body.rejected_by !== undefined) existing[idx].rejected_by = body.rejected_by;
      if (body.canCancel !== undefined) existing[idx].canCancel = body.canCancel;
      if (body.canResubmit !== undefined) existing[idx].canResubmit = body.canResubmit;
      if (body.canDownload !== undefined) existing[idx].canDownload = body.canDownload;
      if (body.cert_ready !== undefined) existing[idx].cert_ready = body.cert_ready;
      if (body.notes !== undefined) existing[idx].notes = body.notes;
      if (body.type !== undefined) existing[idx].type = body.type;
      if (body.purpose !== undefined) existing[idx].purpose = body.purpose;

      // ── Certificate Builder fields ──────────────────────────────────────
      const certFields = [
        'cert_number', 'cert_issued_date', 'cert_issued_at', 'cert_download_until',
        'cert_template_id', 'cert_template_name', 'cert_number_generated', 'cert_issue_snapshot',
        'can_download',
        'hr_signer_name', 'hr_signer_position', 'hr_signer_phone',
        'hr_officer_name', 'hr_officer_phone', 'hr_officer_email', 'hr_officer_id',
        'hr_purpose_detail', 'hr_salary_amount',
      ];
      for (const field of certFields) {
        if (body[field] !== undefined) existing[idx][field] = body[field];
      }

      localStorage.setItem('hrbp_employee_requests', JSON.stringify(existing));
      return { success: true, request: existing[idx] };
    }


    if (method === 'DELETE') {
      const id = path.replace('/requests/', '');
      const existing = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      // Search by request_code first (e.g. EC-20260707-XXXX), fallback to numeric id
      const idx = existing.findIndex(r => r.request_code === id || String(r.id) === String(id));
      if (idx === -1) throw new Error('Request not found');

      // Mirror the server-side behavior: use native 'cancelled' status
      // (migration 007 adds 'cancelled' to the CHECK constraint) +
      // cancel_by_employee flag in request_data for backward compatibility.
      const meta = existing[idx].request_data || {};
      meta.cancelled_by_employee = true;
      meta.cancelled_at = new Date().toISOString();
      meta.statusLabel = 'ยกเลิกโดยพนักงาน';
      existing[idx].status = 'cancelled';
      existing[idx].statusLabel = 'ยกเลิกโดยพนักงาน';
      existing[idx].canCancel = false;
      existing[idx].can_cancel = false;
      existing[idx].cancelled_by_employee = true;
      existing[idx].cancelled_at = new Date().toISOString();
      existing[idx].request_data = meta;
      localStorage.setItem('hrbp_employee_requests', JSON.stringify(existing));
      return { success: true, message: 'Request cancelled', request: existing[idx] };
    }
  }

  throw new Error('Method or Path not mock-implemented');
}

async function request(method, path, body, extraHeaders = {}) {
  const opts = { method, headers: {} };

  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  Object.assign(opts.headers, extraHeaders);

  const isProd = import.meta.env.VITE_USE_WRANGLER === 'true';

  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    
    if (res.status >= 500) {
      if (isProd) throw new Error(`Server error ${res.status}`);
      console.warn(`[API Client] Server response ${res.status}. Falling back to mock database.`);
      return handleMockRequest(path, method, body);
    }

    const text = await res.text();

    if (!res.ok) {
      let err;
      try { err = JSON.parse(text); } catch { err = { error: res.statusText }; }
      
      if (err.error && (err.error.includes('Proxy error') || err.error.includes('Gateway') || err.error.includes('Bad Gateway') || err.error.includes('Timeout'))) {
        if (isProd) throw new Error(err.error);
        console.warn(`[API Client] Proxy error: ${err.error}. Falling back to mock database.`);
        return handleMockRequest(path, method, body);
      }
      
      throw new Error(err.error || 'Request failed');
    }

    try { return JSON.parse(text); } catch {
      if (isProd) throw new Error(`Expected JSON from ${method} ${path}`);
      console.warn(`[API Client] Expected JSON from ${method} ${path}, got content-type: ${res.headers.get('content-type')}. Falling back to mock database.`);
      return handleMockRequest(path, method, body);
    }
  } catch (error) {
    if (isProd) throw error;
    console.warn(`[API Client] Request failed. Falling back to mock database.`, error);
    return handleMockRequest(path, method, body);
  }
}

// ── Auth ──────────────────────────────────────
export async function login(username, password) {
  const isProd = import.meta.env.VITE_USE_WRANGLER === 'true';
  try {
    return await request('POST', '/auth', { action: 'login', username, password });
  } catch (e) {
    if (isProd) throw e;
    console.warn('[api] login request failed, direct mock fallback:', e);
    return handleMockRequest('/auth', 'POST', { action: 'login', username, password });
  }
}

export async function register(profile) {
  const isProd = import.meta.env.VITE_USE_WRANGLER === 'true';
  try {
    return await request('POST', '/auth', { action: 'register', profile });
  } catch (e) {
    if (isProd) throw e;
    console.warn('[api] register request failed, direct mock fallback:', e);
    return handleMockRequest('/auth', 'POST', { action: 'register', profile });
  }
}

// ── Users ─────────────────────────────────────
export async function getUsers(role) {
  const qs = role ? `?role=${role}` : '';
  return request('GET', `/users${qs}`);
}

export async function getHrmsEmployee(empId) {
  return request('GET', `/hrms/employee/${empId}`);
}

export async function updateUser(id, data) {
  return request('PUT', `/users/${id}`, data);
}

// ── Business Units ────────────────────────────
export async function getBusinessUnits() {
  return request('GET', '/business-units');
}

export async function createBusinessUnit(name) {
  return request('POST', '/business-units', { name });
}

export async function updateBusinessUnit(id, name) {
  return request('PUT', `/business-units/${id}`, { name });
}

export async function deleteBusinessUnit(id) {
  return request('DELETE', `/business-units/${id}`);
}

// ── Pickup Locations ─────────────────────────
export async function getPickupLocations() {
  return request('GET', '/pickup-locations');
}

export async function createPickupLocation(name) {
  return request('POST', '/pickup-locations', { name });
}

export async function updatePickupLocation(id, name) {
  return request('PUT', `/pickup-locations/${id}`, { name });
}

export async function deletePickupLocation(id) {
  return request('DELETE', `/pickup-locations/${id}`);
}

// ── Requests ──────────────────────────────────
function generateMockRequests() {
  const statusLabels = { 'submitted': 'ส่งคำขอแล้ว', 'in-review': 'รอดำเนินการ', 'approved': 'อนุมัติแล้ว', 'rejected': 'ปฏิเสธ', 'cancelled': 'ยกเลิกโดยพนักงาน' };

  // Read mock users to merge fields
  const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
  const userMap = {};
  users.forEach(u => { if (u.email) userMap[u.email.toLowerCase()] = u; });

  // Read existing stored requests (from HR acknowledge / cancel / etc.)
  const storedReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
  const storedMap = {};
  storedReqs.forEach(r => { if (r.id) storedMap[r.id] = r; });

  const synced = syncStoredRequestsDownloadAccess();
  const validItems = synced.filter(r => r.user_email);
  if (validItems.length > 0) {
    return validItems.map(r => {
      const stored = storedMap[r.id] || {};
      const normalized = enrichRequestDownloadAccess(r);
      // Merge stored fields (from HR/Employee actions) over original data
      const mergedStatus = stored.status || normalized.status;
      const u = userMap[(normalized.user_email || '').toLowerCase()] || {};
      return {
        id: normalized.id,
        request_code: normalized.id,
        purpose: normalized.type || normalized.purpose || '',
        status: mergedStatus,
        status_label: stored.statusLabel || normalized.statusLabel || normalized.status_label || statusLabels[mergedStatus] || mergedStatus,
        statusLabel: stored.statusLabel || normalized.statusLabel || normalized.status_label || statusLabels[mergedStatus] || mergedStatus,
        supporting_docs: typeof normalized.supporting_docs === 'string' ? normalized.supporting_docs : JSON.stringify(normalized.attachments || []),
        created_at: normalized.date || normalized.created_at || '',
        can_cancel: stored.canCancel ?? stored.can_cancel ?? normalized.can_cancel ?? normalized.canCancel ?? (mergedStatus === 'submitted' || mergedStatus === 'in-review'),
        canCancel: stored.canCancel ?? stored.can_cancel ?? normalized.can_cancel ?? normalized.canCancel ?? (mergedStatus === 'submitted' || mergedStatus === 'in-review'),
        can_download: stored.canDownload ?? normalized.can_download ?? normalized.canDownload ?? false,
        canDownload: stored.canDownload ?? normalized.can_download ?? normalized.canDownload ?? false,
        can_resubmit: stored.canResubmit ?? normalized.can_resubmit ?? normalized.canResubmit ?? (mergedStatus === 'rejected'),
        canResubmit: stored.canResubmit ?? normalized.can_resubmit ?? normalized.canResubmit ?? (mergedStatus === 'rejected'),
        user_email: normalized.user_email || '',
        full_name: u.full_name || normalized.full_name || normalized.employee_name || '',
        emp_id: u.emp_id || u.empCode || '',
        position: u.position || '',
        start_date: u.start_date || '',
        company_name: u.company_name || '',
        // Preserve cancellation/employee flags from stored data
        cancelled_by_employee: stored.cancelled_by_employee ?? normalized.cancelled_by_employee ?? false,
        cancelled_at: stored.cancelled_at || normalized.cancelled_at || '',
        request_data: stored.request_data || normalized.request_data || {},
        // Merge fields from HR actions
        eta_date: stored.eta_date || normalized.eta_date || '',
        eta_submitted_at: stored.eta_submitted_at || normalized.eta_submitted_at || '',
        acknowledged_by: stored.acknowledged_by || normalized.acknowledged_by || null,
        rejection_reason: stored.rejection_reason || normalized.rejection_reason || '',
        rejected_by: stored.rejected_by || normalized.rejected_by || '',
        cert_ready: stored.cert_ready ?? normalized.cert_ready ?? false,
        cert_issued_at: stored.cert_issued_at || normalized.cert_issued_at || '',
        cert_download_until: stored.cert_download_until || normalized.cert_download_until || '',
      };
    });
  }

  // Clear stale dummy data from old code (no user_email)
  if (existing.length > 0) {
    localStorage.removeItem('hrbp_employee_requests');
  }

  return [];
}

export async function getEmployeeRequests({ page = 1, limit = 10, search = '', status = '', user_id = '' } = {}) {
  const qs = `?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&user_id=${encodeURIComponent(user_id)}`;
  return request('GET', `/requests${qs}`);
}

export async function createRequest(data) {
  return request('POST', '/requests', data);
}

export async function updateRequest(id, data) {
  return request('PUT', `/requests/${id}`, data);
}

export async function cancelRequest(id) {
  return request('DELETE', `/requests/${id}`);
}

// ── Certificate Master Data ────────────────────
export async function getCertMasterData(key) {
  const path = key ? `/cert-master-data/${key}` : '/cert-master-data';
  return request('GET', path);
}

export async function setCertMasterData(key, items) {
  return request('POST', '/cert-master-data', { key, items });
}

// ── Files ─────────────────────────────────────
export async function uploadFile(file, prefix = 'supporting-docs') {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('prefix', prefix);
  return request('POST', '/upload', fd);
}

// ── Templates ──────────────────────────────────
export async function getTemplates() {
  return request('GET', '/templates');
}

export async function createTemplate(data) {
  return request('POST', '/templates', data);
}

export async function updateTemplate(id, data) {
  return request('PUT', `/templates/${id}`, data);
}

export async function deleteTemplate(id) {
  return request('DELETE', `/templates/${id}`);
}

