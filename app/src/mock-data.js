/**
 * Mock Data for HRBP Internal
 * Simulates backend data for all screens
 */

// ========================================
// Current logged-in user (set after login)
// ========================================
let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('hrbp_user', JSON.stringify(user));
}

export function getCurrentUser() {
  if (!currentUser) {
    const stored = localStorage.getItem('hrbp_user');
    if (stored) currentUser = JSON.parse(stored);
  }
  return currentUser;
}

export function logout() {
  currentUser = null;
  localStorage.removeItem('hrbp_user');
}

// ========================================
// Mock Users (for login)
// ========================================
export const mockUsers = {
  admin: {
    id: 'U001',
    username: 'admin',
    name: 'Admin User',
    nameDisplay: 'Admin User',
    role: 'admin',
    roleLabel: 'Super Admin',
    empCode: 'EMP-2024-ADM',
    department: 'People Operation',
    avatar: null,
  },
  employee: {
    id: 'U002',
    username: 'employee',
    name: 'อเล็กซ์ ริเวร่า',
    nameDisplay: 'อเล็กซ์ ริเวร่า',
    role: 'employee',
    roleLabel: 'พนักงานอาวุโส',
    empCode: 'EMP-2024-0892',
    department: 'การออกแบบประสบการณ์ผู้ใช้',
    position: 'นักออกแบบผลิตภัณฑ์อาวุโส',
    startDate: '15 มกราคม 2564',
    avatar: null,
  },
};

// ========================================
// Employee Requests (_2 page data)
// ========================================
const defaultEmployeeRequests = [
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
  },
];

const defaultActiveTracker = {
  id: 'EC-20260608-0001',
  attachments: [
    { name: 'สลิปเงินเดือน.pdf', key: 'supporting-docs/a1b2c3d4-สลิปเงินเดือน.pdf', size: 245760 },
  ],
  steps: [
    { label: 'ส่งคำขอแล้ว', date: '12 ต.ค. 2026', icon: 'check', completed: true },
    { label: 'ตรวจสอบข้อมูล', date: '14 ต.ค. 2026', icon: 'assignment_turned_in', completed: true },
    { label: 'HR ตรวจสอบ', date: 'กำลังดำเนินการ', icon: 'rate_review', completed: true, active: true },
    { label: 'ออกเอกสารแล้ว', date: 'รอตรวจสอบ', icon: 'verified', completed: false },
  ],
};

export const getEmployeeRequests = () => {
  const stored = localStorage.getItem('hrbp_employee_requests');
  if (!stored) {
    localStorage.setItem('hrbp_employee_requests', JSON.stringify(defaultEmployeeRequests));
    return defaultEmployeeRequests;
  }
  return JSON.parse(stored);
};

export const saveEmployeeRequests = (list) => {
  localStorage.setItem('hrbp_employee_requests', JSON.stringify(list));
};

export const getActiveTracker = () => {
  const stored = localStorage.getItem('hrbp_active_tracker');
  if (!stored) {
    localStorage.setItem('hrbp_active_tracker', JSON.stringify(defaultActiveTracker));
    return defaultActiveTracker;
  }
  return JSON.parse(stored);
};

export const saveActiveTracker = (tracker) => {
  localStorage.setItem('hrbp_active_tracker', JSON.stringify(tracker));
};

export const employeeRequests = new Proxy([], {
  get(target, prop) {
    const list = getEmployeeRequests();
    if (prop === Symbol.iterator) {
      return list[Symbol.iterator].bind(list);
    }
    const val = list[prop];
    return typeof val === 'function' ? val.bind(list) : val;
  },
  set(target, prop, value) {
    const list = getEmployeeRequests();
    list[prop] = value;
    saveEmployeeRequests(list);
    return true;
  }
});

export const activeTracker = new Proxy({}, {
  get(target, prop) {
    const obj = getActiveTracker();
    const val = obj[prop];
    return typeof val === 'function' ? val.bind(obj) : val;
  },
  set(target, prop, value) {
    const obj = getActiveTracker();
    obj[prop] = value;
    saveActiveTracker(obj);
    return true;
  }
});

// ========================================
// Admin: User Management (_1 page data)
// ========================================
export const adminUsers = [
  {
    name: 'วิภาดา รักษาธรรม',
    code: '5-0001',
    email: 'wipada.r@company.com',
    empCode: 'EMP-2024-001',
    department: 'People Operation',
    role: 'HR Admin',
    status: 'active',
    hasAvatar: true,
    avatarUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLv9_vNZR765tqZ8pfryCO0l2_1ZXta4hRGAqGneBCTcqc0mBM3JhEmThKKk2s9MVjL4KqNr0qNW9W4vAWfA7oW7K5Pg42mj3Snmi6AKJQTmQWgqtbtrmkM76uURQZ_8Rt8wDa2xLCfY5bq2KZzxjDB2UGVoT_pati5UMM91RL9bB7ICx_JAlp4N-N01TGKOG3QivWqTMjzeP-Qrjl3XFvqOwhifcA5KpThmyKpvgq89hrRsAXXn7o6vCRA',
  },
  {
    name: 'ชัยพล รัตนศิริ',
    code: '5-0015',
    email: 'chaiyaphol.r@company.com',
    empCode: 'EMP-2024-015',
    department: 'Business Partnering',
    role: 'HRBP',
    status: 'active',
    hasAvatar: true,
    avatarUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLtH0j1JH-lE4SP-wF63fDqtAXvqHYEuDbsDsF5HPsLwF5SafGeJCsNOtAyNGDCg8xhUes9V1dxmsjFPO9C8dcH3sJH4A4jcsX_4Ff7aDBacMfolWe3oZ3M3Z1s4EpsNCcPPBZR_VIuYCwi4R9BAoOBoER0c4URAM78n8frIWm8n1ZjevQN-iItJYHLJs86LsQComYDFNuJETSwisXJeveiiHhbW7P1YWg4gZGU3g9a5Ltl2gxiLeDQINT8',
  },
  {
    name: 'พิมลพรรณ เกียรติวุฒิ',
    code: '5-0089',
    email: 'pimonphan.k@company.com',
    empCode: 'EMP-2023-089',
    department: 'Marketing',
    role: 'Employee',
    status: 'inactive',
    hasAvatar: true,
    avatarUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLsMYr3BvlajmOyxkyzZgSPeoPtUGtkECl6K3tgzNZ_AvLvIG302BzSgy7N-KoF4648nuHEZ-rFMP22dOiBQNfBKJPUEuKa9VhiKsWRHWwLu4KAbyQk0-2Oi6ZE_uPj1-bP3cpqfVAido3kVp2KNfkeI4NYqFb0TqV9e4oUJGnGNze794nY_1UnZG7REIWsTt4X2YRlmtTDD8T8YB-WpLXTEqCV9Guw_TA1hFYHDkB7l44o2iqVRxKibjQ',
  },
  {
    name: 'ธนพล พร้อมใจ',
    code: '5-0112',
    email: 'thanapol.p@company.com',
    empCode: 'EMP-2024-112',
    department: 'Technology',
    role: 'Employee',
    status: 'active',
    hasAvatar: false,
    initials: 'ธพ',
  },
];

// ========================================
// Admin: Dashboard (hr_admin_2 page data)
// ========================================
export const dashboardKPIs = [
  { label: 'คำขอทั้งหมด', value: '1,429', icon: 'description', trend: '+12%', color: 'primary' },
  { label: 'รอตรวจสอบ (HR)', value: '24', icon: 'assignment_ind', sublabel: 'รอตรวจสอบ', color: 'secondary' },
  { label: 'รอตรวจสอบ (รายได้)', value: '18', icon: 'receipt_long', sublabel: 'กำลังรอ', color: 'secondary' },
  { label: 'ดำเนินการเสร็จวันนี้', value: '56', icon: 'check_circle', sublabel: 'เป้าหมายวัน', color: 'success' },
  { label: 'เกินกำหนด SLA', value: '3', icon: 'error', sublabel: 'วิกฤต', color: 'error' },
];

export const dashboardChart = {
  months: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
  values: [180, 220, 250, 200, 310, 280],
};

export const slaAlerts = [
  { level: 'critical', code: '#90210', message: 'คำขอจากแผนกการตลาดเกินกำหนด 14 ชม.' },
  { level: 'warning', code: '#90245', message: 'ใกล้ครบกำหนด (เหลืออีก 2 ชม.)' },
  { level: 'warning', code: '#90289', message: 'ปริมาณคำขอเพิ่มขึ้นอย่างรวดเร็วในแผนกวิศวกรรม' },
];

const defaultPendingRequests = [
  {
    initials: 'JD', name: 'เจน โด', email: 'jane.doe@corp.com',
    type: 'หนังสือรับรองการทำงาน', department: 'ออกแบบผลิตภัณฑ์',
    status: 'in-review', statusLabel: 'อยู่ระหว่างการตรวจสอบ', date: '24 ต.ค. 2023',
  },
  {
    initials: 'MS', name: 'มาร์ค สมิธ', email: 'm.smith@corp.com',
    type: 'ใบรับรองเงินเดือน', department: 'การเงิน',
    status: 'critical', statusLabel: 'ด่วน', date: '25 ต.ค. 2023',
  },
  {
    initials: 'AL', name: 'อลิซ โล', email: 'a.lo@corp.com',
    type: 'จดหมายรับรองวีซ่า', department: 'การปฏิบัติการ',
    status: 'draft', statusLabel: 'ร่าง', date: '25 ต.ค. 2023',
  },
];

export const getPendingRequests = () => {
  const stored = localStorage.getItem('hrbp_pending_requests');
  if (!stored) {
    localStorage.setItem('hrbp_pending_requests', JSON.stringify(defaultPendingRequests));
    return defaultPendingRequests;
  }
  return JSON.parse(stored);
};

export const savePendingRequests = (list) => {
  localStorage.setItem('hrbp_pending_requests', JSON.stringify(list));
};

export const pendingRequests = new Proxy([], {
  get(target, prop) {
    const list = getPendingRequests();
    if (prop === Symbol.iterator) {
      return list[Symbol.iterator].bind(list);
    }
    const val = list[prop];
    return typeof val === 'function' ? val.bind(list) : val;
  },
  set(target, prop, value) {
    const list = getPendingRequests();
    list[prop] = value;
    savePendingRequests(list);
    return true;
  }
});

// ========================================
// Admin: Templates (hr_admin_1 page data)
// ========================================
export const templateStats = {
  totalActive: 12,
  satisfaction: '85%',
  totalIssued: '2.4k',
};

export const recentEdits = [
  { name: 'Employment Certifi...', time: '2 ชม. ที่ผ่านมา', icon: 'description' },
  { name: 'Salary Certificate (...', time: 'เมื่อวานนี้', icon: 'receipt_long' },
];

export const templates = [
  {
    name: 'Employment Certificate (English)',
    version: 'V 2.4 - มาตรฐานบริษัท',
    category: 'สัญญาจ้างงาน',
    status: 'published', statusLabel: 'เผยแพร่แล้ว',
    updatedAt: '15 ต.ค. 2023', updatedBy: 'Somchai K.',
    icon: 'description',
  },
  {
    name: 'Salary Certificate (Thai)',
    version: 'V 1.8 - สำหรับขอสินเชื่อ',
    category: 'การเงิน',
    status: 'published', statusLabel: 'เผยแพร่แล้ว',
    updatedAt: '10 พ.ย. 2023', updatedBy: 'HR Admin',
    icon: 'receipt_long',
  },
  {
    name: 'Visa Support Letter (Europe)',
    version: 'V 1.0 - แบบร่างใหม่',
    category: 'อื่นๆ',
    status: 'draft', statusLabel: 'ร่าง',
    updatedAt: '22 พ.ย. 2023', updatedBy: 'Prapas M.',
    icon: 'flight_takeoff',
  },
];

// ========================================
// HR Officers (for form data table)
// ========================================
export const hrOfficersList = [
  { id: 'HR001', name: 'สมชาย รักงาน', role: 'HRBP - Technology', email: 'somchai.r@company.com', status: 'พร้อมให้บริการ', avatar: 'https://lh3.googleusercontent.com/aida/AP1WRLv9_vNZR765tqZ8pfryCO0l2_1ZXta4hRGAqGneBCTcqc0mBM3JhEmThKKk2s9MVjL4KqNr0qNW9W4vAWfA7oW7K5Pg42mj3Snmi6AKJQTmQWgqtbtrmkM76uURQZ_8Rt8wDa2xLCfY5bq2KZzxjDB2UGVoT_pati5UMM91RL9bB7ICx_JAlp4N-N01TGKOG3QivWqTMjzeP-Qrjl3XFvqOwhifcA5KpThmyKpvgq89hrRsAXXn7o6vCRA' },
  { id: 'HR002', name: 'สมหญิง จริงใจ', role: 'HRBP - Marketing', email: 'somying.j@company.com', status: 'พร้อมให้บริการ', avatar: 'https://lh3.googleusercontent.com/aida/AP1WRLtH0j1JH-lE4SP-wF63fDqtAXvqHYEuDbsDsF5HPsLwF5SafGeJCsNOtAyNGDCg8xhUes9V1dxmsjFPO9C8dcH3sJH4A4jcsX_4Ff7aDBacMfolWe3oZ3M3Z1s4EpsNCcPPBZR_VIuYCwi4R9BAoOBoER0c4URAM78n8frIWm8n1ZjevQN-iItJYHLJs86LsQComYDFNuJETSwisXJeveiiHhbW7P1YWg4gZGU3g9a5Ltl2gxiLeDQINT8' },
  { id: 'HR003', name: 'วิชัย บริการ', role: 'HR Operations', email: 'wichai.b@company.com', status: 'พร้อมให้บริการ', avatar: null },
  { id: 'HR004', name: 'นภา สดใส', role: 'HRBP - Design & Product', email: 'napa.s@company.com', status: 'พร้อมให้บริการ', avatar: null }
];
