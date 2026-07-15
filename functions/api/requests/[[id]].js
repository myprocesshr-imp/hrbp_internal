function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function mapRequestRow(r, userRow) {
  const meta = parseJson(r.request_data, {});
  const attachments = parseJson(r.supporting_docs, []);

  return {
    id: r.request_code,
    request_code: r.request_code,
    type: meta.type || r.purpose || '',
    purpose: meta.purpose || r.purpose || '',
    doc_type: meta.doc_type || '',
    purpose_value: meta.purpose_value || '',
    language: meta.language || r.language || '',
    salary: meta.salary || '',
    delivery: meta.delivery || '',
    delivery_value: meta.delivery_value || '',
    pickup_location: meta.pickup_location || '',
    abroad_destination: meta.abroad_destination || '',
    abroad_start_date: meta.abroad_start_date || '',
    abroad_end_date: meta.abroad_end_date || '',
    visa_country: meta.visa_country || '',
    visa_travel_date: meta.visa_travel_date || '',
    institution_name: meta.institution_name || '',
    other_purpose: meta.other_purpose || '',
    notes: meta.notes || r.notes || '',
    status: r.status,
    status_label: meta.statusLabel || r.status,
    statusLabel: meta.statusLabel || r.status,
    // Expose the cancellation flag both nested (for backwards compatibility
    // with any consumer reading request_data directly) and at the top level
    // so the HR dashboard can distinguish "ยกเลิกโดยพนักงาน" from "ปฏิเสธ"
    // without parsing JSON strings.
    cancelled_by_employee: meta.cancelled_by_employee === true,
    cancelled_at: meta.cancelled_at || '',
    request_data: meta,
    supporting_docs: r.supporting_docs || '[]',
    attachments,
    user_email: meta.user_email || userRow?.email || '',
    user_name: userRow?.full_name || '',
    user_department: userRow?.department || '',
    user_id: r.user_id,
    phone: meta.phone || userRow?.phone || '',
    emp_id: userRow?.emp_id || '',
    position: userRow?.position || '',
    start_date: userRow?.start_date || '',
    company_name: userRow?.company_name || '',
    hr_officer: meta.hr_officer || null,
    acknowledged_by: meta.acknowledged_by || null,
    eta_date: meta.eta_date || '',
    eta_submitted_at: meta.eta_submitted_at || '',
    cert_ready: meta.cert_ready || false,
    physical_delivered: meta.physical_delivered || false,
    date: meta.date || r.created_at || '',
    created_at: r.created_at || '',
    updated_at: r.updated_at || '',
    // Allow cancellation only for active requests (not yet approved/rejected/cancelled)
    can_cancel: r.status === 'submitted' || r.status === 'in-review',
    can_download: r.status === 'approved' && !!meta.cert_ready,
    // Allow resubmit when rejected by HR or cancelled by employee
    can_resubmit: r.status === 'rejected' || r.status === 'cancelled',
    rejection_reason: meta.rejection_reason || '',
    // ── Certificate Builder fields ──────────────────────────────────────────
    cert_number: meta.cert_number || '',
    cert_issued_date: meta.cert_issued_date || '',
    cert_issued_at: meta.cert_issued_at || '',
    cert_download_until: meta.cert_download_until || '',
    cert_template_id: meta.cert_template_id || '',
    cert_template_name: meta.cert_template_name || '',
    cert_number_generated: meta.cert_number_generated || false,
    cert_issue_snapshot: meta.cert_issue_snapshot || null,
    hr_signer_name: meta.hr_signer_name || '',
    hr_signer_position: meta.hr_signer_position || '',
    hr_signer_phone: meta.hr_signer_phone || '',
    hr_officer_name: meta.hr_officer_name || '',
    hr_officer_phone: meta.hr_officer_phone || '',
    hr_officer_email: meta.hr_officer_email || '',
    hr_officer_id: meta.hr_officer_id || '',
    hr_purpose_detail: meta.hr_purpose_detail || '',
    hr_salary_amount: meta.hr_salary_amount || '',
  };
}


async function resolveUserId(env, body) {
  // Try user_id first, but verify it exists in DB
  if (body.user_id && Number.isInteger(Number(body.user_id))) {
    const userId = Number(body.user_id);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (exists) return userId;
  }

  // Fallback: look up by emp_id
  const empId = body.emp_id || '';
  if (empId) {
    const byEmp = await env.DB.prepare('SELECT id FROM users WHERE emp_id = ?').bind(empId).first();
    if (byEmp) return byEmp.id;
  }

  // Fallback: look up by email
  const email = body.user_email || '';
  if (email) {
    const byEmail = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (byEmail) return byEmail.id;
  }

  // Fallback: look up by username
  const username = body.username || '';
  if (username) {
    const byUsername = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (byUsername) return byUsername.id;
  }

  // Auto-provision user if they exist in HRMS (empId is provided)
  if (empId || email) {
    const fallbackUsername = username || empId || (email ? email.split('@')[0] : 'user_' + Date.now());
    
    // Ensure uniqueness of username
    let finalUsername = fallbackUsername;
    const existingUser = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(finalUsername).first();
    if (existingUser) {
      finalUsername = `${fallbackUsername}_${Math.floor(Math.random() * 1000)}`;
    }

    try {
      const result = await env.DB.prepare(
        `INSERT INTO users (username, full_name, emp_id, email, phone, position, department, company_name, role, start_date, sex_id, fname_e, lname_e)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        finalUsername,
        body.full_name || '',
        empId,
        email,
        body.phone || '',
        body.position || '',
        body.department || '',
        body.company_name || '',
        'employee',
        body.start_date || '',
        body.sex_id || '',
        body.fname_e || '',
        body.lname_e || ''
      ).run();
      
      return result.meta.last_row_id;
    } catch (err) {
      console.error('Failed to auto-provision user in requests:', err);
      // Fallback query in case of race conditions
      if (empId) {
        const reCheck = await env.DB.prepare('SELECT id FROM users WHERE emp_id = ?').bind(empId).first();
        if (reCheck) return reCheck.id;
      }
    }
  }

  return null;
}

async function resolveAssignedHrId(env, hrOfficer) {
  if (!hrOfficer) return null;
  if (hrOfficer.id) return hrOfficer.id;

  const empId = hrOfficer.emp_id || hrOfficer.empId || '';
  if (!empId) return null;

  const hr = await env.DB.prepare('SELECT id FROM users WHERE emp_id = ?').bind(empId).first();
  return hr?.id || null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/requests — list requests with pagination & filters
  if (method === 'GET') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const status = url.searchParams.get('status') || '';
    const userId = url.searchParams.get('user_id') || '';

    const conditions = [];
    const params = [];

    if (userId) {
      if (String(userId).includes('@')) {
        conditions.push('r.user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)');
        params.push(userId);
      } else if (!Number.isNaN(Number(userId))) {
        conditions.push('r.user_id = ?');
        params.push(Number(userId));
      } else {
        conditions.push('r.user_id = (SELECT id FROM users WHERE username = ? LIMIT 1)');
        params.push(userId);
      }
    }
    if (status) {
      if (status === 'cancelled') {
        // cancelled: either the new native 'cancelled' status (migration 007+)
        // or the legacy rejected + cancelled_by_employee flag pattern
        conditions.push("(r.status = 'cancelled' OR json_extract(r.request_data, '$.cancelled_by_employee') = true)");
      } else {
        conditions.push('r.status = ?');
        params.push(status);
      }
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) as total FROM requests r ${whereClause}`;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const fetchQuery = `
      SELECT r.*, u.email as user_email_lookup, u.phone as user_phone_lookup,
             u.full_name as user_full_name, u.department as user_department,
             u.emp_id as user_emp_id, u.position as user_position,
             u.start_date as user_start_date, u.company_name as user_company_name
      FROM requests r
      LEFT JOIN users u ON u.id = r.user_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const fetchParams = [...params, limit, offset];
    const { results } = await env.DB.prepare(fetchQuery).bind(...fetchParams).all();

    let mapped = (results || []).map((r) => mapRequestRow(r, {
      email: r.user_email_lookup,
      phone: r.user_phone_lookup,
      full_name: r.user_full_name,
      department: r.user_department,
      emp_id: r.user_emp_id,
      position: r.user_position,
      start_date: r.user_start_date,
      company_name: r.user_company_name,
    }));

    if (search) {
      mapped = mapped.filter((r) =>
        (r.request_code || '').toLowerCase().includes(search) ||
        (r.type || '').toLowerCase().includes(search) ||
        (r.purpose || '').toLowerCase().includes(search)
      );
    }

    const statsConditions = [];
    const statsParams = [];
    if (userId) {
      if (String(userId).includes('@')) {
        statsConditions.push('user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)');
        statsParams.push(userId);
      } else if (!Number.isNaN(Number(userId))) {
        statsConditions.push('user_id = ?');
        statsParams.push(Number(userId));
      } else {
        statsConditions.push('user_id = (SELECT id FROM users WHERE username = ? LIMIT 1)');
        statsParams.push(userId);
      }
    }
    const statsWhere = statsConditions.length > 0 ? 'WHERE ' + statsConditions.join(' AND ') : '';

    const allUserReqs = await env.DB.prepare(
      `SELECT status FROM requests ${statsWhere}`
    ).bind(...statsParams).all();
    const allRows = allUserReqs.results || [];
    const openReqs = allRows.filter((r) => r.status === 'submitted' || r.status === 'in-review').length;
    const approvedReqs = allRows.filter((r) => r.status === 'approved').length;
    const rejectedReqs = allRows.filter((r) => r.status === 'rejected').length;
    const completedReqs = approvedReqs + rejectedReqs;
    const successRate = completedReqs > 0 ? Math.round((approvedReqs / completedReqs) * 1000) / 10 : 0;

    let avgDays = 2.5;
    try {
      const timeResults = await env.DB.prepare(`
        SELECT julianday(updated_at) - julianday(created_at) as days
        FROM requests
        ${statsWhere ? statsWhere + ' AND' : 'WHERE'}
        status IN ('approved', 'rejected')
        AND updated_at IS NOT NULL AND updated_at != ''
        AND created_at IS NOT NULL AND created_at != ''
        LIMIT 100
      `).bind(...statsParams).all();
      const timeRows = timeResults.results || [];
      if (timeRows.length > 0) {
        const sum = timeRows.reduce((acc, row) => acc + Math.max(0, parseFloat(row.days) || 0), 0);
        avgDays = Math.round((sum / timeRows.length) * 10) / 10;
      }
    } catch (_) {}

    return json({
      requests: mapped,
      pagination: { page, limit, total, totalPages },
      stats: { avg_days: avgDays, success_rate: successRate, open_requests: openReqs },
    });
  }

  // POST /api/requests — create a new request
  if (method === 'POST') {
    const body = await request.json();
    const userId = await resolveUserId(env, body);

    if (!userId) {
      return json({ error: 'User not found' }, 400);
    }

    const today = new Date();
    const idStr = 'EC-' + today.getFullYear()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0')
      + '-' + String(Math.floor(Math.random() * 9000) + 1000);
    const created_at = today.toISOString();
    const assignedHrId = await resolveAssignedHrId(env, body.hr_officer);

    const requestData = {
      ...body,
      id: idStr,
      date: body.date || created_at,
      statusLabel: body.statusLabel || 'รอ HR รับทราบเคส',
    };

    await env.DB.prepare(`
      INSERT INTO requests (
        request_code, user_id, purpose, language, salary_info, notes, status,
        assigned_hr_id, supporting_docs, request_data, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      idStr,
      userId,
      body.type || body.purpose || 'ใบรับรองการทำงาน',
      body.language || 'ไทย',
      body.salary === 'ใช่' || body.salary === 'Yes' || body.salary === true ? 1 : 0,
      body.notes || '',
      body.status || 'submitted',
      assignedHrId,
      JSON.stringify(body.attachments || []),
      JSON.stringify(requestData),
      created_at,
      created_at
    ).run();

    const user = await env.DB.prepare('SELECT email, phone, full_name, department, emp_id, position, start_date, company_name FROM users WHERE id = ?').bind(userId).first();
    const created = mapRequestRow({
      request_code: idStr,
      user_id: userId,
      purpose: body.type || body.purpose || 'ใบรับรองการทำงาน',
      language: body.language || 'ไทย',
      notes: body.notes || '',
      status: body.status || 'submitted',
      supporting_docs: JSON.stringify(body.attachments || []),
      request_data: JSON.stringify(requestData),
      created_at,
      updated_at: created_at,
    }, user);

    return json({ success: true, request: created });
  }

  // ── PUT /api/requests/:id — update request (cancel, acknowledge, reject, approve, set ETA) ──
  if (method === 'PUT') {
    const body = await request.json();
    const requestCode = url.pathname.split('/').filter(Boolean).pop();

    const existing = await env.DB.prepare('SELECT * FROM requests WHERE request_code = ?').bind(requestCode).first();
    if (!existing) return json({ error: 'Request not found' }, 404);

    const existingMeta = parseJson(existing.request_data, {});
    const now = new Date().toISOString();
    const updateFields = [];
    const updateParams = [];

    if (body.status) {
      updateFields.push('status = ?');
      updateParams.push(body.status);
      existingMeta.statusLabel = body.statusLabel || body.status;
    }
    if (body.eta_date !== undefined) {
      existingMeta.eta_date = body.eta_date;
    }
    if (body.eta_submitted_at !== undefined) {
      existingMeta.eta_submitted_at = body.eta_submitted_at;
    }
    if (body.acknowledged_by !== undefined) existingMeta.acknowledged_by = body.acknowledged_by;
    if (body.rejection_reason !== undefined) existingMeta.rejection_reason = body.rejection_reason;
    if (body.cert_ready !== undefined) existingMeta.cert_ready = body.cert_ready;
    if (body.physical_delivered !== undefined) existingMeta.physical_delivered = body.physical_delivered;
    // Strip employee-cancellation flags when HR rejects — label precedence
    // must be HR-rejected, not employee-cancelled, in the DB.
    if (body.status === 'rejected') {
      delete existingMeta.cancelled_by_employee;
      delete existingMeta.cancelled_at;
    }
    if (body.notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(body.notes);
      existingMeta.notes = body.notes;
    }
    if (body.type !== undefined) {
      updateFields.push('purpose = ?');
      updateParams.push(body.type);
      existingMeta.type = body.type;
    }

    // ── Certificate Builder fields ─────────────────────────────────────────
    // Merge all certificate-related fields sent from the Certificate Builder's
    // handleSave into request_data so they are persisted in D1.
    const certFields = [
      'cert_number', 'cert_issued_date', 'cert_issued_at', 'cert_download_until',
      'cert_template_id', 'cert_template_name', 'cert_number_generated', 'cert_issue_snapshot',
      'canDownload', 'can_download',
      'hr_signer_name', 'hr_signer_position', 'hr_signer_phone',
      'hr_officer_name', 'hr_officer_phone', 'hr_officer_email', 'hr_officer_id',
      'hr_purpose_detail', 'hr_salary_amount',
    ];
    for (const field of certFields) {
      if (body[field] !== undefined) {
        existingMeta[field] = body[field];
      }
    }

    existingMeta.statusLabel = body.statusLabel || existingMeta.statusLabel || existing.status;
    updateFields.push('request_data = ?');
    updateParams.push(JSON.stringify(existingMeta));
    updateFields.push('updated_at = ?');
    updateParams.push(now);

    const sql = `UPDATE requests SET ${updateFields.join(', ')} WHERE request_code = ?`;
    updateParams.push(requestCode);
    await env.DB.prepare(sql).bind(...updateParams).run();

    const updated = await env.DB.prepare(`
      SELECT r.*, u.email as user_email_lookup, u.phone as user_phone_lookup,
             u.full_name as user_full_name, u.department as user_department,
             u.emp_id as user_emp_id, u.position as user_position,
             u.start_date as user_start_date, u.company_name as user_company_name
      FROM requests r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.request_code = ?
    `).bind(requestCode).first();

    return json({ success: true, request: mapRequestRow(updated, {
      email: updated.user_email_lookup, phone: updated.user_phone_lookup,
      full_name: updated.user_full_name, department: updated.user_department,
      emp_id: updated.user_emp_id, position: updated.user_position,
      start_date: updated.user_start_date, company_name: updated.user_company_name,
    }) });
  }


  // ── DELETE /api/requests/:id — cancel request (soft delete) ──
  if (method === 'DELETE') {
    const requestCode = url.pathname.split('/').filter(Boolean).pop();
    const existing = await env.DB.prepare('SELECT * FROM requests WHERE request_code = ?').bind(requestCode).first();
    if (!existing) return json({ error: 'Request not found' }, 404);

    const meta = parseJson(existing.request_data, {});
    meta.statusLabel = 'ยกเลิกโดยพนักงาน';
    meta.cancelled_by_employee = true;
    meta.cancelled_at = new Date().toISOString();
    // Use 'cancelled' status if the CHECK constraint supports it (migration 007+),
    // otherwise fall back to 'rejected' + flag for backward compatibility.
    // The 'cancelled' status is cleaner and avoids the rejected+flag workaround.
    await env.DB.prepare("UPDATE requests SET status = 'cancelled', request_data = ?, updated_at = ? WHERE request_code = ?")
      .bind(JSON.stringify(meta), new Date().toISOString(), requestCode).run();

    // Re-query the updated request so the frontend has fresh data immediately
    // Note: JOIN with users table instead of non-existent employees table
    const updated = await env.DB.prepare(
      `SELECT r.*, u.full_name as employee_name FROM requests r LEFT JOIN users u ON r.user_id = u.id WHERE r.request_code = ?`
    ).bind(requestCode).first();

    const parsedData = parseJson(updated?.request_data, {});
    return json({
      success: true,
      message: 'Request cancelled',
      request: {
        ...(updated || {}),
        request_data: parsedData,
        statusLabel: meta.statusLabel,
        cancelled_by_employee: true,
      }
    });
  }

  return json({ error: 'Method not allowed' }, 405);
}
