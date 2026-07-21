/**
 * Login Page
 * Built from hrbp_internal/screen.png
 */
import { mockUsers, setCurrentUser } from '../mock-data.js';
import { navigate } from '../router.js';
import md5 from 'js-md5';
import { login as apiLogin, register as apiRegister, updateUser } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { buildEnglishName, getSexLabel, mapHrmsProfileFields, enrichUserFromHrms, persistEnglishNameToMockUsers } from '../lib/hrms-helper.js';

function isProductionHost() {
  const host = window.location.hostname;
  return host === 'hrbp-internal.pages.dev' || host.endsWith('.hrbp-internal.pages.dev');
}

export function renderLoginPage() {
  return `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <!-- Brand -->
      <div class="flex items-center gap-3 mb-10 mt-12">
        <span class="material-symbols-outlined text-primary text-[36px]">corporate_fare</span>
        <span class="text-display font-display text-primary tracking-tight">HRBP Internal</span>
      </div>

      <!-- Login Card -->
      <div class="w-full max-w-md login-card bg-surface-container-lowest rounded-2xl overflow-hidden">
        <!-- Blue accent bar -->
        <div class="h-1.5 bg-primary w-full"></div>

        <div class="p-8 md:p-10">
          <div class="text-center mb-8">
            <h2 class="text-headline-lg font-headline-lg text-on-surface font-bold">${t('login.welcome')}</h2>
            <p class="text-body-md text-on-surface-variant mt-2">${t('login.subtitle')}</p>
          </div>

          <form id="login-form" class="space-y-6">
            <!-- Username -->
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('login.username')}</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">person</span>
                <input
                  id="login-username"
                  type="text"
                  class="w-full bg-white border border-outline-variant rounded-xl pl-11 pr-4 py-3.5 text-body-md focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  placeholder="${t('login.usernamePlaceholder')}"
                  autocomplete="username"
                />
              </div>
            </div>

            <!-- Password -->
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('login.password')}</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">lock</span>
                <input
                  id="login-password"
                  type="password"
                  class="w-full bg-white border border-outline-variant rounded-xl pl-11 pr-12 py-3.5 text-body-md focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  placeholder="${t('login.passwordPlaceholder')}"
                  autocomplete="current-password"
                />
                <button type="button" id="toggle-password" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                  <span class="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>

            <!-- Remember + Forgot -->
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20" />
                <span class="text-label-md text-on-surface-variant">${t('login.remember')}</span>
              </label>
              <a href="#" class="text-label-md text-primary font-semibold hover:underline">${t('login.forgot')}</a>
            </div>

            <!-- Error message -->
            <div id="login-error" class="hidden bg-error-container text-on-error-container px-4 py-3 rounded-lg text-label-md font-medium">
              <span class="material-symbols-outlined text-[16px] mr-1 align-text-bottom">error</span>
              ${t('login.loginError')}
            </div>

            <!-- Submit -->
            <button
              type="submit"
              id="login-submit-btn"
              class="w-full bg-primary text-on-primary py-4 rounded-xl font-bold text-headline-md hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span class="btn-text">${t('login.loginBtn')}</span>
              <span class="material-symbols-outlined btn-icon">login</span>
            </button>
          </form>

          <!-- Confirm Profile Form (Hidden by default) -->
          <form id="confirm-profile-form" class="hidden space-y-5">
            <div class="bg-primary-fixed/30 rounded-xl p-4 border border-primary/10 mb-4">
              <p class="text-label-md font-bold text-primary mb-1">${t('login.provisioningTitle')}</p>
              <p class="text-label-sm text-on-surface-variant mb-1">${t('login.provisioningDesc')}</p>
              <p class="text-label-sm text-on-surface-variant/70">${t('login.provisioningWarn')}</p>
            </div>

            <!-- Hidden fields to store data -->
            <input type="hidden" id="cp-emp-id" />
            <input type="hidden" id="cp-username" />
            <input type="hidden" id="cp-sex-id" />
            <input type="hidden" id="cp-fname-e" />
            <input type="hidden" id="cp-lname-e" />

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.nameLabel')}</label>
              <input id="cp-fullname" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.englishNameLabel')}</label>
              <input id="cp-english-name" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.sexLabel')}</label>
              <input id="cp-sex-label" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.companyLabel')}</label>
              <input id="cp-company" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.empCodeLabel')}</label>
                <input id="cp-empcode" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
              </div>
              <div>
                <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.startDateLabel')}</label>
                <input id="cp-startdate" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
              </div>
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.positionLabel')}</label>
              <input id="cp-position" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.deptLabel')}</label>
              <input id="cp-department" type="text" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.emailLabel')}</label>
              <input id="cp-email" type="email" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all" />
            </div>

            <div>
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('login.phoneLabel')}</label>
              <input id="cp-phone" type="tel" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all" />
            </div>

            <button
              type="submit"
              id="confirm-submit-btn"
              class="w-full mt-4 bg-primary text-on-primary py-3.5 rounded-xl font-bold text-label-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span class="btn-text">${t('login.confirmBtn')}</span>
              <span class="material-symbols-outlined btn-icon">check_circle</span>
            </button>

            <button
              type="button"
              id="cancel-login-btn"
              class="w-full bg-surface-container-high text-on-surface-variant py-3.5 rounded-xl font-bold text-label-lg hover:bg-surface-container-highest active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-3"
            >
              <span class="btn-text">${t('login.cancelLoginBtn')}</span>
              <span class="material-symbols-outlined btn-icon">cancel</span>
            </button>
          </form>

          <!-- Divider -->
          <div class="flex items-center gap-4 my-8">
            <div class="flex-1 h-px bg-outline-variant"></div>
            <span class="text-label-sm text-on-surface-variant">${t('login.help')}</span>
            <div class="flex-1 h-px bg-outline-variant"></div>
          </div>

          <!-- Help info -->
          <div class="bg-surface-container-low rounded-xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-on-surface-variant text-[20px] mt-0.5 shrink-0">info</span>
            <p class="text-label-md text-on-surface-variant leading-relaxed">
              ${t('login.helpText')}
            </p>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <p class="mt-8 text-label-sm text-outline">${t('login.footer')}</p>
    </div>
  `;
}


export function initLoginPage(container) {
  const form = container.querySelector('#login-form');
  const confirmForm = container.querySelector('#confirm-profile-form');
  const usernameInput = container.querySelector('#login-username');
  const passwordInput = container.querySelector('#login-password');
  const errorDiv = container.querySelector('#login-error');
  const toggleBtn = container.querySelector('#toggle-password');
  const loginSubmitBtn = container.querySelector('#login-submit-btn');

  // Toggle password visibility
  toggleBtn?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
  });

  // Helper to show loading state on buttons
  const setLoading = (btn, isLoading, originalText, originalIcon) => {
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    const iconEl = btn.querySelector('.btn-icon');
    
    if (isLoading) {
      btn.disabled = true;
      btn.classList.add('opacity-70', 'cursor-not-allowed');
      if (textEl) textEl.textContent = t('login.loading');
      if (iconEl) iconEl.textContent = 'hourglass_empty';
    } else {
      btn.disabled = false;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
      if (textEl) textEl.textContent = originalText;
      if (iconEl) iconEl.textContent = originalIcon;
    }
  };

  // Quick login buttons
  const quickLoginBtns = container.querySelectorAll('.quick-login');
  quickLoginBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.getAttribute('data-user');
      if (usernameInput && passwordInput) {
        usernameInput.value = u;
        passwordInput.value = 'password';
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  });

  // Form submit (Login)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!username || !password) {
      errorDiv.textContent = t('login.validationError');
      errorDiv.classList.remove('hidden');
      return;
    }

    setLoading(loginSubmitBtn, true);
    errorDiv.classList.add('hidden');

    console.log('[login] 1. Starting login for:', username);
    try {
      // 1. Hash password with MD5
      const hashedPassword = md5(password);

      // 2. Call IDMS Authentication via Proxy
      const idmsUrl = `/api/idms/authentication/?account=${username}&password=${hashedPassword}&Service=0000&AgentId=SystemMango&AgentCode=Np4kfRh5`;
      
      let empId = null;
      console.log('[login] 2. IDMS URL:', idmsUrl);
      
      let idmsFailed = false;
      try {
        const idmsController = new AbortController();
        const idmsTimeout = setTimeout(() => idmsController.abort(), 10000);
        const idmsRes = await fetch(idmsUrl, { signal: idmsController.signal });
        clearTimeout(idmsTimeout);
        if (!idmsRes.ok) idmsFailed = true;
        const idmsText = await idmsRes.text();
        // Assume API returns something like [{"Result":"OK","EmpId":"10005208"}] or JSON
        let idmsData;
        try {
          idmsData = JSON.parse(idmsText);
        } catch (e) {
          // If not JSON, maybe simple string or XML? Let's check for EmpId in string
          const match = idmsText.match(/"EmpId"\s*:\s*"([^"]+)"/i) || idmsText.match(/EmpId=(\d+)/i);
          if (match) empId = match[1];
        }

        if (idmsData && Array.isArray(idmsData) && idmsData[0]?.Result === 'OK') {
          empId = idmsData[0].EmpId;
        } else if (idmsData?.Result === 'OK') {
          empId = idmsData.EmpId;
        } else {
          idmsFailed = true;
        }
      } catch (err) {
        idmsFailed = true;
        console.warn('[login] IDMS API Fetch Error', err);
      }

      console.log('[login] 3. empId after IDMS:', empId);

      if (isProductionHost()) {
        if (!empId) {
          errorDiv.textContent = idmsFailed ? t('login.idmsUnavailable') : t('login.loginError');
          errorDiv.classList.remove('hidden');
          setLoading(loginSubmitBtn, false);
          return;
        }
      } else {
        const demoEmpIds = {
          'wipada.r': 'EMP-2024-001',
          'chaiyaphol.r': 'EMP-2024-015',
        };
        if (!empId && demoEmpIds[username.toLowerCase()]) {
          empId = demoEmpIds[username.toLowerCase()];
        }
        if (!empId) {
          empId = `EMP-MOCK-${Date.now()}`;
          console.log('[login] 5. Generated mock empId:', empId);
        }
      }

      console.log('[login] 4. empId after environment check:', empId);

      console.log('[login] 6. Calling apiLogin with username:', username);
      // 3. Check users via API
      const authResult = await apiLogin(username, password);
      console.log('[login] 7. apiLogin result:', authResult);

      if (authResult.user) {
        console.log('[login] 7a. User found, navigating');
        let user = authResult.user;
        // Pull the real English name (fname_e/lname_e/sex_id) from HRMS for
        // accounts that logged in before those fields existed.
        try {
          const enriched = await enrichUserFromHrms(user);
          if (enriched) {
            user = enriched;
            setCurrentUser(enriched);
            // Keep the shared staff store (Certificate Builder) in sync too.
            try { persistEnglishNameToMockUsers(enriched); } catch (_) {}
            // Best-effort persistence to the users table so it survives sessions.
            try { await updateUser(user.id, { fname_e: enriched.fname_e, lname_e: enriched.lname_e, sex_id: enriched.sex_id }); } catch (_) {}
          }
        } catch (_) { /* keep the original user on enrichment failure */ }
        setCurrentUser(user);
        const target = ['admin', 'hrmanager', 'hrbp'].includes(user.role)
          ? (user.role === 'hrbp' ? '/admin/requests' : '/admin/dashboard')
          : '/employee/requests';
        navigate(target);
      } else if (authResult.needsProvisioning) {
        console.log('[login] 7b. needsProvisioning, showing confirm form');
        // 4. Auto-provisioning: Fetch Profile from HRMS
        let profile = null;
        try {
          const hrmsRes = await fetch(`/api/hrms/employee/${empId}`);
          if (hrmsRes.ok) {
            const hrmsData = await hrmsRes.json();
            if (hrmsData?.data?.employee) {
              profile = hrmsData.data.employee;
            }
          }
        } catch (err) {
          console.warn('HRMS Profile Fetch Error', err);
        }

        // Mock profile for demo if API fails
        if (!profile) {
          profile = {
            ID_Emp: empId,
            EmpName: username,
            Department: 'Unknown Department',
            Position: 'Staff',
            EMail: `${username}@company.com`,
            Sim_Number: '0812345678',
            StartDate: '2024-01-01',
            SexID: '2',
            FNameE: username,
            LNameE: '',
          };
        }

        // 5. Show Confirm Profile UI
        console.log('[login] 8. Showing confirm UI');
        form.classList.add('hidden');
        const h2El = container.querySelector('.text-center h2');
        const pEl = container.querySelector('.text-center p');
        console.log('[login] h2El:', h2El, 'pEl:', pEl);
        if (h2El) h2El.textContent = t('login.confirmProfile');
        if (pEl) pEl.textContent = t('login.confirmProfileSub');
        
        // Populate form
        console.log('[login] 9. Populating form fields');
        const cpEmpIdEl = container.querySelector('#cp-emp-id');
        console.log('[login] cp-emp-id element:', cpEmpIdEl);
        if (cpEmpIdEl) cpEmpIdEl.value = empId;
        const cpUsernameEl = container.querySelector('#cp-username');
        if (cpUsernameEl) cpUsernameEl.value = username;
        const hrmsFields = mapHrmsProfileFields(profile);
        const cpFullnameEl = container.querySelector('#cp-fullname');
        if (cpFullnameEl) cpFullnameEl.value = profile.EmpName || '';
        const cpEnglishNameEl = container.querySelector('#cp-english-name');
        if (cpEnglishNameEl) cpEnglishNameEl.value = buildEnglishName(profile) || '-';
        const cpSexIdEl = container.querySelector('#cp-sex-id');
        if (cpSexIdEl) cpSexIdEl.value = hrmsFields.sex_id;
        const cpSexLabelEl = container.querySelector('#cp-sex-label');
        if (cpSexLabelEl) cpSexLabelEl.value = getSexLabel(hrmsFields.sex_id) || '-';
        const cpFnameEEl = container.querySelector('#cp-fname-e');
        if (cpFnameEEl) cpFnameEEl.value = hrmsFields.fname_e;
        const cpLnameEEl = container.querySelector('#cp-lname-e');
        if (cpLnameEEl) cpLnameEEl.value = hrmsFields.lname_e;
        const cpCompanyEl = container.querySelector('#cp-company');
        if (cpCompanyEl) cpCompanyEl.value = profile.CompanyName || '';
        const cpEmpcodeEl = container.querySelector('#cp-empcode');
        if (cpEmpcodeEl) cpEmpcodeEl.value = profile.ID_Emp || empId;
        const cpPositionEl = container.querySelector('#cp-position');
        if (cpPositionEl) cpPositionEl.value = profile.Position || '';
        const cpDepartmentEl = container.querySelector('#cp-department');
        if (cpDepartmentEl) cpDepartmentEl.value = profile.Department || '';
        const cpEmailEl = container.querySelector('#cp-email');
        if (cpEmailEl) cpEmailEl.value = profile.EMail || '';
        const cpPhoneEl = container.querySelector('#cp-phone');
        if (cpPhoneEl) cpPhoneEl.value = profile.Sim_Number || '';
        let rawDate = profile.StartDate || profile.JoinDate || '-';
        if (rawDate !== '-' && rawDate.includes('T')) {
          rawDate = rawDate.split('T')[0];
        }
        const cpStartdateEl = container.querySelector('#cp-startdate');
        if (cpStartdateEl) cpStartdateEl.value = rawDate;
        
        // Ensure inputs that need to be editable are accessible
        console.log('[login] 10. Showing confirm form');
        confirmForm.classList.remove('hidden');
      }
    } catch (error) {
      console.error('[login] CATCH:', error);
      if (errorDiv) {
        errorDiv.textContent = t('login.connError');
        errorDiv.classList.remove('hidden');
      }
    } finally {
      setLoading(loginSubmitBtn, false, t('login.loginBtn'), 'login');
    }
  });

  // Cancel login button - back to login form
  container.querySelector('#cancel-login-btn')?.addEventListener('click', () => {
    confirmForm.classList.add('hidden');
    form.classList.remove('hidden');
    const h2El = container.querySelector('.text-center h2');
    const pEl = container.querySelector('.text-center p');
    if (h2El) h2El.textContent = t('login.welcome');
    if (pEl) pEl.textContent = t('login.subtitle');
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
    errorDiv.classList.add('hidden');
  });

  // Form submit (Confirm Profile)
  confirmForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = container.querySelector('#confirm-submit-btn');
    setLoading(submitBtn, true, t('login.confirmBtn'), 'check_circle');

    const usernameVal = container.querySelector('#cp-username').value;
    const isSystemAdmin = usernameVal === 'admin';
    const isHRBP = usernameVal.includes('hrbp') || usernameVal === 'chaiyaphol.r';
    const isHRManager = usernameVal === 'wipada.r' || usernameVal.startsWith('hrmanager');
    
    const readField = (id) => {
      const v = container.querySelector(id)?.value?.trim() || '';
      return v === '-' ? '' : v;
    };

    const newUser = {
      emp_id: container.querySelector('#cp-empcode').value,
      username: usernameVal,
      full_name: container.querySelector('#cp-fullname').value,
      company_name: container.querySelector('#cp-company').value,
      position: container.querySelector('#cp-position').value,
      department: container.querySelector('#cp-department').value,
      email: container.querySelector('#cp-email').value,
      phone: container.querySelector('#cp-phone').value,
      sex_id: readField('#cp-sex-id'),
      fname_e: readField('#cp-fname-e'),
      lname_e: readField('#cp-lname-e'),
      role: isSystemAdmin ? 'admin' : (isHRBP ? 'hrbp' : (isHRManager ? 'hrmanager' : 'employee'))
    };

    // Note: To save start_date to DB, the column needs to exist in Supabase users table.
    // For now we add it to the user object (even if DB insert ignores it if column doesn't exist, though it might throw an error if strict).
    // Let's include start_date
    const startDateVal = container.querySelector('#cp-startdate').value;
    if (startDateVal && startDateVal !== '-') {
       newUser.start_date = startDateVal; 
    }

    try {
      const result = await apiRegister(newUser);
      setCurrentUser(result.user);
      const target2 = ['admin', 'hrmanager', 'hrbp'].includes(result.user.role)
        ? (result.user.role === 'hrbp' ? '/admin/requests' : '/admin/dashboard')
        : '/employee/requests';
      navigate(target2);
    } catch (err) {
      console.error('Error saving user profile:', err);
      alert(t('login.saveError'));
    } finally {
      setLoading(submitBtn, false, t('login.confirmBtn'), 'check_circle');
    }
  });

  // Auto-focus
  usernameInput?.focus();
}
