/**
 * Admin: Master Lists / Settings
 * For managing Business Units and Pickup Locations
 */
import { getBusinessUnits, createBusinessUnit, updateBusinessUnit, deleteBusinessUnit } from '../lib/api.js';
import { getPickupLocations, createPickupLocation, updatePickupLocation, deletePickupLocation } from '../lib/api.js';
import { getCertMasterData, setCertMasterData } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { getCertDownloadDays, setCertDownloadDays, MIN_CERT_DOWNLOAD_DAYS, MAX_CERT_DOWNLOAD_DAYS } from '../lib/download-policy.js';
import {
  buildEnglishAddress,
  buildThaiAddress,
  EMPTY_ADDRESS_PARTS,
  escapeHtml,
  groupAddresses,
  makeAddressGroupKey,
  parseEnglishAddress,
  parseThaiAddress,
  partsFromRecord,
} from '../lib/address-helper.js';

export function renderAdminSettings() {
  return `
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
      <div>
        <h2 class="page-title">${t('settings.pageTitle')}</h2>
        <p class="page-subtitle">${t('settings.pageSubtitle')}</p>
      </div>
    </div>

    <!-- Master Lists Layout -->
    <div class="flex flex-col md:flex-row gap-6">
      <!-- Sidebar for settings categories -->
      <div class="w-full md:w-64 shrink-0 flex flex-col gap-2">
        <button id="settings-tab-bu" class="settings-tab flex items-center gap-3 px-4 py-3 bg-secondary-container text-on-secondary-container font-bold rounded-lg transition-colors text-left" data-tab="bu">
          <span class="material-symbols-outlined">domain</span>
          <span>${t('settings.tabBu')}</span>
        </button>
        <button id="settings-tab-pickup" class="settings-tab flex items-center gap-3 px-4 py-3 bg-surface-container text-on-surface-variant font-bold rounded-lg transition-colors text-left hover:bg-surface-container-high" data-tab="pickup">
          <span class="material-symbols-outlined">location_on</span>
          <span>${t('settings.tabPickup')}</span>
        </button>
        <button id="settings-tab-cert" class="settings-tab flex items-center gap-3 px-4 py-3 bg-surface-container text-on-surface-variant font-bold rounded-lg transition-colors text-left hover:bg-surface-container-high" data-tab="cert">
          <span class="material-symbols-outlined">badge</span>
          <span>${t('settings.tabCert')}</span>
        </button>
      </div>

      <!-- ===== BU Section ===== -->
      <div id="settings-section-bu" class="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-headline-md font-bold text-on-surface">${t('settings.buTitle')}</h3>
          <button id="add-bu-btn" class="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity shadow-sm">
            <span class="material-symbols-outlined text-[18px]">add</span>
            ${t('settings.buAdd')}
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-outline-variant bg-surface-container-low">
                <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase">${t('settings.buName')}</th>
                <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase text-right w-32">${t('settings.buManage')}</th>
              </tr>
            </thead>
            <tbody id="bu-tbody" class="divide-y divide-outline-variant">
              <tr>
                <td colspan="2" class="px-6 py-8 text-center text-on-surface-variant font-medium">
                  <div class="flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin text-[20px] text-primary">sync</span>
                    <span>${t('common.loading')}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ===== Cert Form Section (hidden by default) ===== -->
      <div id="settings-section-cert" class="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm hidden">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-headline-md font-bold text-on-surface">${t('settings.certTitle')}</h3>
        </div>
        <p class="text-label-sm text-on-surface-variant mb-6">${t('settings.certDesc')}</p>

        <!-- Download window -->
        <div class="border border-outline-variant rounded-xl p-5 mb-6">
          <h4 class="text-label-md font-bold text-on-surface mb-1">${t('settings.downloadWindowSec')}</h4>
          <p class="text-label-sm text-on-surface-variant mb-4">${t('settings.downloadWindowDesc')}</p>
          <div class="flex flex-col sm:flex-row sm:items-end gap-4">
            <div class="flex-1 max-w-xs">
              <label class="block text-label-sm font-semibold text-on-surface-variant mb-1" for="cert-download-days">${t('settings.downloadWindowDays')}</label>
              <div class="flex items-center gap-2">
                <input type="number" id="cert-download-days" min="${MIN_CERT_DOWNLOAD_DAYS}" max="${MAX_CERT_DOWNLOAD_DAYS}" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" />
                <span class="text-label-sm text-on-surface-variant shrink-0">${t('settings.downloadWindowDaysUnit')}</span>
              </div>
              <p class="text-label-xs text-outline mt-2">${t('settings.downloadWindowRange', { min: MIN_CERT_DOWNLOAD_DAYS, max: MAX_CERT_DOWNLOAD_DAYS })}</p>
            </div>
            <button id="btn-save-download-days" type="button" class="shrink-0 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-opacity shadow-sm">
              ${t('common.save')}
            </button>
          </div>
          <p id="download-days-save-msg" class="hidden text-label-sm text-primary font-bold mt-3"></p>
        </div>

        <!-- Companies -->
        <div class="border border-outline-variant rounded-xl p-5 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h4 class="text-label-md font-bold text-on-surface">${t('settings.companySec')}</h4>
            <button id="btn-add-company" class="text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-label-sm font-bold">
              <span class="material-symbols-outlined text-[16px]">add</span> ${t('settings.companyAdd')}
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left cert-data-table">
              <thead>
                <tr class="border-b border-outline-variant bg-surface-container-low">
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant w-auto">${t('settings.companyHeader')}</th>
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant w-20 text-right">${t('settings.companyManage')}</th>
                </tr>
              </thead>
              <tbody id="company-tbody" class="divide-y divide-outline-variant">
                <tr><td colspan="2" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">${t('common.loading')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Addresses -->
        <div class="border border-outline-variant rounded-xl p-5 mb-6">
          <div class="flex justify-between items-start gap-4 mb-4">
            <div>
              <h4 class="text-label-md font-bold text-on-surface">${t('settings.addressSec')}</h4>
              <p class="text-label-sm text-on-surface-variant mt-1 max-w-2xl">${t('settings.addressSecHint')}</p>
            </div>
            <button id="btn-add-address" class="shrink-0 text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-label-sm font-bold">
              <span class="material-symbols-outlined text-[16px]">add</span> ${t('settings.addressAdd')}
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left cert-data-table">
              <thead>
                <tr class="border-b border-outline-variant bg-surface-container-low">
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant">${t('settings.addressHeaderAddress')}</th>
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant min-w-[11rem]">${t('settings.addressHeaderCompany')}</th>
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant w-20 text-right">${t('settings.addressHeaderManage')}</th>
                </tr>
              </thead>
              <tbody id="address-tbody" class="divide-y divide-outline-variant">
                <tr><td colspan="3" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">${t('common.loading')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Notes -->
        <div class="border border-outline-variant rounded-xl p-5">
          <div class="flex justify-between items-center mb-4">
            <h4 class="text-label-md font-bold text-on-surface">${t('settings.notesSec')}</h4>
            <button id="btn-add-note" class="text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-label-sm font-bold">
              <span class="material-symbols-outlined text-[16px]">add</span> ${t('settings.notesAdd')}
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left cert-data-table">
              <thead>
                <tr class="border-b border-outline-variant bg-surface-container-low">
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant">${t('settings.notesSec')}</th>
                  <th class="px-4 py-2 text-label-sm font-bold text-on-surface-variant w-20 text-right">${t('settings.companyManage')}</th>
                </tr>
              </thead>
              <tbody id="notes-tbody" class="divide-y divide-outline-variant">
                <tr><td colspan="2" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">${t('common.loading')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ===== Pickup Locations Section (hidden by default) ===== -->
      <div id="settings-section-pickup" class="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm hidden">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-headline-md font-bold text-on-surface">${t('settings.pickupTitle')}</h3>
          <button id="add-pickup-btn" class="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity shadow-sm">
            <span class="material-symbols-outlined text-[18px]">add</span>
            ${t('settings.pickupAdd')}
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-outline-variant bg-surface-container-low">
                <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase">${t('settings.pickupName')}</th>
                <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase text-right w-32">${t('settings.pickupManage')}</th>
              </tr>
            </thead>
            <tbody id="pickup-tbody" class="divide-y divide-outline-variant">
              <tr>
                <td colspan="2" class="px-6 py-8 text-center text-on-surface-variant font-medium">
                  <div class="flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin text-[20px] text-primary">sync</span>
                    <span>${t('common.loading')}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===== BU Modal ===== -->
    <div id="bu-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="bu-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 class="text-title-md font-bold text-on-surface" id="bu-modal-title">${t('settings.buModalTitle')}</h3>
          <button id="bu-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <form id="bu-form" class="p-6 space-y-4">
          <input type="hidden" id="bu-id" />
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('settings.buNameLabel')}</label>
            <input type="text" id="bu-name" required class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" placeholder="${t('settings.buNamePlaceholder')}" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" id="bu-modal-cancel" class="flex-1 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-surface-container rounded-xl font-bold transition-all">${t('common.cancel')}</button>
            <button type="submit" class="flex-1 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-xl font-bold transition-all shadow-md">${t('common.save')}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===== Pickup Location Modal ===== -->
    <div id="pickup-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="pickup-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 class="text-title-md font-bold text-on-surface" id="pickup-modal-title">${t('settings.pickupModalTitle')}</h3>
          <button id="pickup-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <form id="pickup-form" class="p-6 space-y-4">
          <input type="hidden" id="pickup-id" />
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('settings.pickupNameLabel')}</label>
            <input type="text" id="pickup-name" required class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" placeholder="${t('settings.pickupNamePlaceholder')}" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" id="pickup-modal-cancel" class="flex-1 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-surface-container rounded-xl font-bold transition-all">${t('common.cancel')}</button>
            <button type="submit" class="flex-1 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-xl font-bold transition-all shadow-md">${t('common.save')}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===== Company Modal ===== -->
    <div id="company-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="company-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 class="text-title-md font-bold text-on-surface" id="company-modal-title">${t('settings.companySec')}</h3>
          <button id="company-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 pb-6 space-y-4">
          <input type="hidden" id="company-edit-id" />
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('settings.companyNameLabel')} <span class="text-error">*</span></label>
            <input type="text" id="company-name-input" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" placeholder="${t('settings.companyNamePlaceholder')}" />
          </div>
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('settings.companyNameEnLabel')} <span class="text-error">*</span></label>
            <input type="text" id="company-name-en-input" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" placeholder="${t('settings.companyNameEnPlaceholder')}" />
          </div>
          <div class="flex gap-3 pt-2">
            <button id="company-modal-cancel" class="flex-1 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-surface-container rounded-xl font-bold transition-all">${t('common.cancel')}</button>
            <button id="company-modal-save" class="flex-1 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-xl font-bold transition-all shadow-md">${t('common.save')}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Address Modal ===== -->
    <div id="address-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="address-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div class="h-1.5 bg-primary w-full shrink-0"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <h3 class="text-title-md font-bold text-on-surface" id="address-modal-title">${t('settings.addressAdd')}</h3>
            <p class="text-label-xs text-on-surface-variant mt-0.5">${t('settings.addressModalHint')}</p>
          </div>
          <button id="address-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 pb-6 space-y-4 overflow-y-auto">
          <input type="hidden" id="address-edit-group-key" />

          <div class="rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <label class="block text-label-sm font-semibold text-on-surface mb-2">${t('settings.addressCompanyLabel')} <span class="text-error">*</span></label>
            <p class="text-label-xs text-on-surface-variant mb-3">${t('settings.addressCompanyMultiHint')}</p>
            <div id="address-company-checkboxes" class="flex flex-wrap gap-2"></div>
            <p id="address-company-empty" class="hidden text-label-xs text-error mt-2">${t('settings.addressCompanyEmpty')}</p>
          </div>

          <div class="flex rounded-xl border border-outline-variant overflow-hidden text-label-sm font-bold">
            <button type="button" id="address-mode-fields" class="flex-1 px-4 py-2.5 bg-secondary-container text-on-secondary-container transition-colors">${t('settings.addressModeFields')}</button>
            <button type="button" id="address-mode-paste" class="flex-1 px-4 py-2.5 bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors">${t('settings.addressModePaste')}</button>
          </div>

          <div id="address-paste-panel" class="hidden space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary-fixed/10 p-4">
            <p class="text-label-xs text-on-surface-variant">${t('settings.addressPasteHint')}</p>
            <div>
              <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressLabel')}</label>
              <textarea id="address-paste-th" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" rows="3" placeholder="${t('settings.addressPastePlaceholder')}"></textarea>
            </div>
            <div>
              <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressEnLabel')} <span class="text-error">*</span></label>
              <textarea id="address-paste-en" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none" rows="2" placeholder="${t('settings.addressEnPastePlaceholder')}"></textarea>
            </div>
            <button type="button" id="address-parse-btn" class="w-full py-2.5 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">auto_fix_high</span>
              ${t('settings.addressParseBtn')}
            </button>
            <p class="text-label-xs text-on-surface-variant">${t('settings.addressParseNote')}</p>
          </div>

          <div id="address-fields-panel" class="space-y-4">
            <div class="rounded-xl border border-outline-variant p-4 space-y-3">
              <div class="flex items-center gap-2 text-label-sm font-bold text-on-surface">
                <span class="material-symbols-outlined text-[18px] text-primary">home</span>
                ${t('settings.addressLabel')}
              </div>
              <p class="text-label-xs text-on-surface-variant -mt-1">${t('settings.addressFieldsHint')}</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressHouseNo')}</label>
                  <input type="text" id="addr-th-house" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressHouseNoPh')}" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressMoo')}</label>
                  <input type="text" id="addr-th-moo" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressMooPh')}" />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressStreet')}</label>
                  <input type="text" id="addr-th-street" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressStreetPh')}" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressSubdistrict')}</label>
                  <input type="text" id="addr-th-subdistrict" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressSubdistrictPh')}" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressDistrict')}</label>
                  <input type="text" id="addr-th-district" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressDistrictPh')}" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressProvince')}</label>
                  <input type="text" id="addr-th-province" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressProvincePh')}" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressPostal')}</label>
                  <input type="text" id="addr-th-postal" class="addr-th-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" placeholder="${t('settings.addressPostalPh')}" maxlength="5" />
                </div>
              </div>
              <div class="rounded-lg bg-surface-container-low px-3 py-2">
                <p class="text-label-xs text-on-surface-variant mb-0.5">${t('settings.addressPreview')}</p>
                <p id="addr-th-preview" class="text-label-sm text-on-surface font-medium break-words">—</p>
              </div>
            </div>

            <div class="rounded-xl border border-outline-variant p-4 space-y-3">
              <div class="flex items-center gap-2 text-label-sm font-bold text-on-surface">
                <span class="material-symbols-outlined text-[18px] text-primary">translate</span>
                ${t('settings.addressEnLabel')} <span class="text-error">*</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressHouseNo')}</label>
                  <input type="text" id="addr-en-house" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressMoo')}</label>
                  <input type="text" id="addr-en-moo" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressStreet')}</label>
                  <input type="text" id="addr-en-street" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressSubdistrict')}</label>
                  <input type="text" id="addr-en-subdistrict" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressDistrict')}</label>
                  <input type="text" id="addr-en-district" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressProvince')}</label>
                  <input type="text" id="addr-en-province" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" />
                </div>
                <div>
                  <label class="block text-label-xs font-semibold text-on-surface-variant mb-1">${t('settings.addressPostal')}</label>
                  <input type="text" id="addr-en-postal" class="addr-en-field w-full bg-white border border-outline-variant rounded-xl px-3 py-2 text-body-md focus:border-primary outline-none" maxlength="10" />
                </div>
              </div>
              <div class="rounded-lg bg-surface-container-low px-3 py-2">
                <p class="text-label-xs text-on-surface-variant mb-0.5">${t('settings.addressPreview')}</p>
                <p id="addr-en-preview" class="text-label-sm text-on-surface font-medium break-words">—</p>
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-2 shrink-0">
            <button id="address-modal-cancel" class="flex-1 py-2.5 border border-outline-variant text-on-surface-variant hover:bg-surface-container rounded-xl font-bold transition-all">${t('common.cancel')}</button>
            <button id="address-modal-save" class="flex-1 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-xl font-bold transition-all shadow-md">${t('common.save')}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initAdminSettings(container) {
  // ── Tab switching ─────────────────────────────
  const sectionBu = container.querySelector('#settings-section-bu');
  const sectionPickup = container.querySelector('#settings-section-pickup');
  const sectionCert = container.querySelector('#settings-section-cert');
  container.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.replace('bg-secondary-container', 'bg-surface-container');
        t.classList.replace('text-on-secondary-container', 'text-on-surface-variant');
      });
      tab.classList.replace('bg-surface-container', 'bg-secondary-container');
      tab.classList.replace('text-on-surface-variant', 'text-on-secondary-container');
      const target = tab.getAttribute('data-tab');
      sectionBu?.classList.toggle('hidden', target !== 'bu');
      sectionPickup?.classList.toggle('hidden', target !== 'pickup');
      sectionCert?.classList.toggle('hidden', target !== 'cert');
      if (target === 'cert') {
        loadDownloadPolicySettings();
        loadCertMasterData();
      }
    });
  });

  // ── BU logic ───────────────────────────────────
  const buTbody = container.querySelector('#bu-tbody');
  const addBuBtn = container.querySelector('#add-bu-btn');
  const buModal = container.querySelector('#bu-modal');
  const buModalTitle = container.querySelector('#bu-modal-title');
  const buForm = container.querySelector('#bu-form');
  const buIdInput = container.querySelector('#bu-id');
  const buNameInput = container.querySelector('#bu-name');
  const buCloseBtn = container.querySelector('#bu-modal-close');
  const buCancelBtn = container.querySelector('#bu-modal-cancel');
  const buBackdrop = container.querySelector('#bu-modal-backdrop');

  let currentBUs = [];

  const loadBUs = async () => {
    try {
      const result = await getBusinessUnits();
      currentBUs = result.data || [];
      renderBUs();
    } catch (err) {
      console.error('Error fetching BUs:', err);
      buTbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-error font-medium">${t('error.loadData')}</td></tr>`;
    }
  };

  const renderBUs = () => {
    if (currentBUs.length === 0) {
      buTbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-on-surface-variant font-medium">${t('settings.buEmpty')}</td></tr>`;
      return;
    }
    buTbody.innerHTML = currentBUs.map(bu => `
      <tr class="hover:bg-surface-container-low transition-colors group">
        <td class="px-6 py-4"><span class="inline-block px-3 py-1 bg-primary-fixed/20 text-primary rounded-lg border border-primary/10 font-bold">${bu.name}</span></td>
        <td class="px-6 py-4 text-right">
          <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors edit-bu-btn" data-id="${bu.id}" title="${t('common.edit')}"><span class="material-symbols-outlined text-[18px]">edit</span></button>
            <button class="p-2 text-error hover:bg-error-container rounded-lg transition-colors delete-bu-btn" data-id="${bu.id}" title="${t('common.delete')}"><span class="material-symbols-outlined text-[18px]">delete</span></button>
          </div>
        </td>
      </tr>
    `).join('');
    buTbody.querySelectorAll('.edit-bu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const bu = currentBUs.find(b => String(b.id) === btn.dataset.id);
        if (bu) openBUModal(bu);
      });
    });
    buTbody.querySelectorAll('.delete-bu-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm(t('settings.buDeleteConfirm'))) {
          try {
            await deleteBusinessUnit(btn.dataset.id);
            currentBUs = currentBUs.filter(b => String(b.id) !== btn.dataset.id);
            renderBUs();
          } catch (err) {
            console.error('Error deleting BU:', err);
            alert(t('settings.buDeleteError'));
          }
        }
      });
    });
  };

  const openBUModal = (bu = null) => {
    buModalTitle.textContent = t('settings.buModalTitle');
    buIdInput.value = bu ? bu.id : '';
    buNameInput.value = bu ? bu.name : '';
    buModal.classList.remove('hidden');
    buNameInput.focus();
  };
  const closeBUModal = () => buModal?.classList.add('hidden');

  buForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = buIdInput.value;
    const name = buNameInput.value.trim();
    if (!name) return;
    try {
      if (id) {
        await updateBusinessUnit(id, name);
        const idx = currentBUs.findIndex(b => String(b.id) === id);
        if (idx > -1) currentBUs[idx].name = name;
      } else {
        const result = await createBusinessUnit(name);
        if (result.data?.length) currentBUs.push(result.data[0]);
      }
      renderBUs();
      closeBUModal();
    } catch (err) {
      console.error('Error saving BU:', err);
      alert(t('settings.buSaveError'));
    }
  });

  addBuBtn?.addEventListener('click', () => openBUModal());
  buCloseBtn?.addEventListener('click', closeBUModal);
  buCancelBtn?.addEventListener('click', closeBUModal);
  buBackdrop?.addEventListener('click', closeBUModal);

  // ── Pickup Locations logic ────────────────────
  const pickupTbody = container.querySelector('#pickup-tbody');
  const addPickupBtn = container.querySelector('#add-pickup-btn');
  const pickupModal = container.querySelector('#pickup-modal');
  const pickupModalTitle = container.querySelector('#pickup-modal-title');
  const pickupForm = container.querySelector('#pickup-form');
  const pickupIdInput = container.querySelector('#pickup-id');
  const pickupNameInput = container.querySelector('#pickup-name');
  const pickupCloseBtn = container.querySelector('#pickup-modal-close');
  const pickupCancelBtn = container.querySelector('#pickup-modal-cancel');
  const pickupBackdrop = container.querySelector('#pickup-modal-backdrop');

  let currentPickups = [];

  const loadPickups = async () => {
    try {
      const result = await getPickupLocations();
      currentPickups = result.data || [];
      renderPickups();
    } catch (err) {
      console.error('Error fetching pickup locations:', err);
      pickupTbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-error font-medium">${t('error.loadData')}</td></tr>`;
    }
  };

  const renderPickups = () => {
    if (currentPickups.length === 0) {
      pickupTbody.innerHTML = `<tr><td colspan="2" class="px-6 py-8 text-center text-on-surface-variant font-medium">${t('settings.pickupEmpty')}</td></tr>`;
      return;
    }
    pickupTbody.innerHTML = currentPickups.map(p => `
      <tr class="hover:bg-surface-container-low transition-colors group">
        <td class="px-6 py-4"><span class="inline-block px-3 py-1 bg-primary-fixed/20 text-primary rounded-lg border border-primary/10 font-bold">${p.name}</span></td>
        <td class="px-6 py-4 text-right">
          <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors edit-pickup-btn" data-id="${p.id}" title="${t('common.edit')}"><span class="material-symbols-outlined text-[18px]">edit</span></button>
            <button class="p-2 text-error hover:bg-error-container rounded-lg transition-colors delete-pickup-btn" data-id="${p.id}" title="${t('common.delete')}"><span class="material-symbols-outlined text-[18px]">delete</span></button>
          </div>
        </td>
      </tr>
    `).join('');
    pickupTbody.querySelectorAll('.edit-pickup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = currentPickups.find(pu => String(pu.id) === btn.dataset.id);
        if (p) openPickupModal(p);
      });
    });
    pickupTbody.querySelectorAll('.delete-pickup-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm(t('settings.pickupDeleteConfirm'))) {
          try {
            await deletePickupLocation(btn.dataset.id);
            currentPickups = currentPickups.filter(p => String(p.id) !== btn.dataset.id);
            renderPickups();
          } catch (err) {
            console.error('Error deleting pickup location:', err);
            alert(t('settings.pickupDeleteError'));
          }
        }
      });
    });
  };

  const openPickupModal = (pickup = null) => {
    pickupModalTitle.textContent = t('settings.pickupModalTitle');
    pickupIdInput.value = pickup ? pickup.id : '';
    pickupNameInput.value = pickup ? pickup.name : '';
    pickupModal.classList.remove('hidden');
    pickupNameInput.focus();
  };
  const closePickupModal = () => pickupModal?.classList.add('hidden');

  pickupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = pickupIdInput.value;
    const name = pickupNameInput.value.trim();
    if (!name) return;
    if (!id) {
      const dup = currentPickups.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (dup) { alert(t('settings.pickupDuplicate')); return; }
    }
    try {
      if (id) {
        await updatePickupLocation(id, name);
        const idx = currentPickups.findIndex(p => String(p.id) === id);
        if (idx > -1) currentPickups[idx].name = name;
      } else {
        const result = await createPickupLocation(name);
        if (result.data?.length) currentPickups.push(result.data[0]);
      }
      renderPickups();
      closePickupModal();
    } catch (err) {
      console.error('Error saving pickup location:', err);
      alert(t('settings.pickupSaveError'));
    }
  });

  addPickupBtn?.addEventListener('click', () => openPickupModal());
  pickupCloseBtn?.addEventListener('click', closePickupModal);
  pickupCancelBtn?.addEventListener('click', closePickupModal);
  pickupBackdrop?.addEventListener('click', closePickupModal);

  // ── Certificate Master Data ──────────────────
  let certData = {};
  const CERT_CELL = 'px-4 py-2 text-label-sm text-on-surface-variant';
  const sortAsc = (a, b) => String(a || '').localeCompare(String(b || ''), 'th', { sensitivity: 'base' });
  const certSection = container.querySelector('#settings-section-cert');
  const companyTbody = certSection?.querySelector('#company-tbody');
  const addressTbody = certSection?.querySelector('#address-tbody');
  const notesTbody = certSection?.querySelector('#notes-tbody');

  const normalizeNoteItem = (item) => {
    if (typeof item === 'string') return { text: item, text_en: '' };
    return {
      text: item?.text || item?.th || '',
      text_en: item?.text_en || item?.en || '',
    };
  };

  const normalizeCertData = (raw = {}) => {
    const notesRaw = Array.isArray(raw.notes) ? raw.notes : [];
    return {
      ...raw,
      notes: notesRaw.map(normalizeNoteItem).filter(n => n.text || n.text_en),
    };
  };

  const downloadDaysInput = container.querySelector('#cert-download-days');
  const downloadDaysSaveBtn = container.querySelector('#btn-save-download-days');
  const downloadDaysSaveMsg = container.querySelector('#download-days-save-msg');

  const loadDownloadPolicySettings = () => {
    if (downloadDaysInput) downloadDaysInput.value = String(getCertDownloadDays());
    downloadDaysSaveMsg?.classList.add('hidden');
  };

  downloadDaysSaveBtn?.addEventListener('click', () => {
    const val = parseInt(downloadDaysInput?.value, 10);
    try {
      setCertDownloadDays(val);
      loadDownloadPolicySettings();
      if (downloadDaysSaveMsg) {
        downloadDaysSaveMsg.textContent = t('settings.downloadWindowSaveSuccess', { days: val });
        downloadDaysSaveMsg.classList.remove('hidden');
        setTimeout(() => downloadDaysSaveMsg.classList.add('hidden'), 3000);
      }
    } catch {
      alert(t('settings.downloadWindowSaveError', { min: MIN_CERT_DOWNLOAD_DAYS, max: MAX_CERT_DOWNLOAD_DAYS }));
    }
  });

  const loadCertMasterData = async () => {
    try {
      const result = await getCertMasterData();
      certData = normalizeCertData(result.data || {});
      renderCompanies();
      renderAddresses();
      renderNotes();
    } catch (err) {
      console.error('Error loading cert master data:', err);
    }
  };

  const saveCert = async (key, val) => {
    certData[key] = val;
    try {
      await setCertMasterData(key, val);
    } catch (err) {
      console.error('Error saving:', err);
    }
  };

  // ── Companies ──
  const renderCompanies = () => {
    if (!companyTbody) return;
    const list = certData.companies || [];
    if (!list.length) {
      companyTbody.innerHTML = '<tr><td colspan="2" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">' + t('settings.companyEmpty') + '</td></tr>';
      return;
    }
    companyTbody.innerHTML = [...list].sort((a, b) => sortAsc(a.name, b.name)).map(c => {
      const addrCount = (certData.addresses || []).filter(a => a.company_id === c.id).length;
      return `
        <tr class="hover:bg-surface-container-low transition-colors group">
          <td class="${CERT_CELL}">
            ${escapeHtml(c.name)}${c.name_en ? ` <span class="text-outline">(${escapeHtml(c.name_en)})</span>` : ''}
            <span class="text-outline"> · ${t('settings.addressCount', { count: addrCount })}</span>
          </td>
          <td class="px-4 py-2 text-right">
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="btn-edit-company p-1 text-primary hover:bg-primary/10 rounded-lg transition-colors" data-id="${c.id}"><span class="material-symbols-outlined text-[14px]">edit</span></button>
              <button class="btn-delete-company p-1 text-error hover:bg-error/10 rounded-lg transition-colors" data-id="${c.id}"><span class="material-symbols-outlined text-[14px]">delete</span></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  };

  container.querySelector('#btn-add-company')?.addEventListener('click', () => {
    container.querySelector('#company-edit-id').value = '';
    container.querySelector('#company-modal-title').textContent = t('settings.companySec');
    container.querySelector('#company-name-input').value = '';
    container.querySelector('#company-name-en-input').value = '';
    container.querySelector('#company-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  const closeCompanyModal = () => {
    container.querySelector('#company-modal').classList.add('hidden');
    document.body.style.overflow = '';
  };
  container.querySelector('#company-modal-close')?.addEventListener('click', closeCompanyModal);
  container.querySelector('#company-modal-cancel')?.addEventListener('click', closeCompanyModal);
  container.querySelector('#company-modal-backdrop')?.addEventListener('click', closeCompanyModal);
  container.querySelector('#company-modal-save')?.addEventListener('click', () => {
    const editId = container.querySelector('#company-edit-id').value;
    const name = container.querySelector('#company-name-input').value.trim();
    const nameEn = container.querySelector('#company-name-en-input').value.trim();
    if (!name) { alert(t('settings.companyRequired')); return; }
    if (!nameEn) { alert(t('settings.companyNameEnRequired')); return; }
    const list = certData.companies || [];
    const duplicate = list.find(c => c.id !== editId && c.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { alert(t('settings.companyDuplicate')); return; }
    const duplicateEn = list.find(c => c.id !== editId && c.name_en && c.name_en.toLowerCase() === nameEn.toLowerCase());
    if (duplicateEn) { alert(t('settings.companyDuplicateEn')); return; }
    if (editId) {
      const idx = list.findIndex(c => c.id === editId);
      if (idx !== -1) { list[idx].name = name; list[idx].name_en = nameEn; }
    } else {
      const maxId = list.reduce((m, c) => Math.max(m, parseInt((c.id || 'c0').replace('c', ''), 10) || 0), 0);
      list.push({ id: 'c' + (maxId + 1), name, name_en: nameEn });
    }
    saveCert('companies', list);
    renderCompanies();
    renderAddresses();
    closeCompanyModal();
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-edit-company');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const c = (certData.companies || []).find(c => c.id === id);
    if (!c) return;
    container.querySelector('#company-edit-id').value = id;
    container.querySelector('#company-modal-title').textContent = t('settings.companySec');
    container.querySelector('#company-name-input').value = c.name;
    container.querySelector('#company-name-en-input').value = c.name_en || '';
    container.querySelector('#company-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-company');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!confirm(t('settings.companyDeleteConfirm'))) return;
    let list = certData.companies || [];
    list = list.filter(c => c.id !== id);
    saveCert('companies', list);
    // Also remove linked addresses
    let addrs = certData.addresses || [];
    addrs = addrs.filter(a => a.company_id !== id);
    saveCert('addresses', addrs);
    renderCompanies();
    renderAddresses();
  });

  // ── Addresses ──
  const ADDR_TH_FIELDS = ['house', 'moo', 'street', 'subdistrict', 'district', 'province', 'postal'];
  const ADDR_EN_FIELDS = ['house', 'moo', 'street', 'subdistrict', 'district', 'province', 'postal'];

  const getThPartsFromForm = () => {
    const parts = EMPTY_ADDRESS_PARTS();
    parts.house_no = container.querySelector('#addr-th-house')?.value.trim() || '';
    parts.moo = container.querySelector('#addr-th-moo')?.value.trim() || '';
    parts.street_line = container.querySelector('#addr-th-street')?.value.trim() || '';
    parts.subdistrict = container.querySelector('#addr-th-subdistrict')?.value.trim() || '';
    parts.district = container.querySelector('#addr-th-district')?.value.trim() || '';
    parts.province = container.querySelector('#addr-th-province')?.value.trim() || '';
    parts.postal_code = container.querySelector('#addr-th-postal')?.value.trim() || '';
    return parts;
  };

  const getEnPartsFromForm = () => {
    const parts = EMPTY_ADDRESS_PARTS();
    parts.house_no = container.querySelector('#addr-en-house')?.value.trim() || '';
    parts.moo = container.querySelector('#addr-en-moo')?.value.trim() || '';
    parts.street_line = container.querySelector('#addr-en-street')?.value.trim() || '';
    parts.subdistrict = container.querySelector('#addr-en-subdistrict')?.value.trim() || '';
    parts.district = container.querySelector('#addr-en-district')?.value.trim() || '';
    parts.province = container.querySelector('#addr-en-province')?.value.trim() || '';
    parts.postal_code = container.querySelector('#addr-en-postal')?.value.trim() || '';
    return parts;
  };

  const setThPartsToForm = (parts) => {
    const p = { ...EMPTY_ADDRESS_PARTS(), ...parts };
    container.querySelector('#addr-th-house').value = p.house_no;
    container.querySelector('#addr-th-moo').value = p.moo;
    container.querySelector('#addr-th-street').value = p.street_line;
    container.querySelector('#addr-th-subdistrict').value = p.subdistrict;
    container.querySelector('#addr-th-district').value = p.district;
    container.querySelector('#addr-th-province').value = p.province;
    container.querySelector('#addr-th-postal').value = p.postal_code;
    updateAddressPreviews();
  };

  const setEnPartsToForm = (parts) => {
    const p = { ...EMPTY_ADDRESS_PARTS(), ...parts };
    container.querySelector('#addr-en-house').value = p.house_no;
    container.querySelector('#addr-en-moo').value = p.moo;
    container.querySelector('#addr-en-street').value = p.street_line;
    container.querySelector('#addr-en-subdistrict').value = p.subdistrict;
    container.querySelector('#addr-en-district').value = p.district;
    container.querySelector('#addr-en-province').value = p.province;
    container.querySelector('#addr-en-postal').value = p.postal_code;
    updateAddressPreviews();
  };

  const updateAddressPreviews = () => {
    const thText = buildThaiAddress(getThPartsFromForm());
    const enText = buildEnglishAddress(getEnPartsFromForm());
    const thPreview = container.querySelector('#addr-th-preview');
    const enPreview = container.querySelector('#addr-en-preview');
    if (thPreview) thPreview.textContent = thText || '—';
    if (enPreview) enPreview.textContent = enText || '—';
  };

  const setAddressInputMode = (mode) => {
    const isPaste = mode === 'paste';
    container.querySelector('#address-paste-panel')?.classList.toggle('hidden', !isPaste);
    container.querySelector('#address-fields-panel')?.classList.toggle('hidden', isPaste);
    const fieldsBtn = container.querySelector('#address-mode-fields');
    const pasteBtn = container.querySelector('#address-mode-paste');
    if (fieldsBtn && pasteBtn) {
      fieldsBtn.classList.toggle('bg-secondary-container', !isPaste);
      fieldsBtn.classList.toggle('text-on-secondary-container', !isPaste);
      fieldsBtn.classList.toggle('bg-surface-container', isPaste);
      fieldsBtn.classList.toggle('text-on-surface-variant', isPaste);
      pasteBtn.classList.toggle('bg-secondary-container', isPaste);
      pasteBtn.classList.toggle('text-on-secondary-container', isPaste);
      pasteBtn.classList.toggle('bg-surface-container', !isPaste);
      pasteBtn.classList.toggle('text-on-surface-variant', !isPaste);
    }
  };

  const fillAddressCompanyCheckboxes = (selectedIds = []) => {
    const wrap = container.querySelector('#address-company-checkboxes');
    const emptyMsg = container.querySelector('#address-company-empty');
    if (!wrap) return;
    const companies = certData.companies || [];
    if (!companies.length) {
      wrap.innerHTML = '';
      emptyMsg?.classList.remove('hidden');
      return;
    }
    emptyMsg?.classList.add('hidden');
    wrap.innerHTML = companies.map(c => {
      const checked = selectedIds.includes(c.id) ? 'checked' : '';
      const label = `${escapeHtml(c.name)}${c.name_en ? ` <span class="text-outline font-normal">(${escapeHtml(c.name_en)})</span>` : ''}`;
      return `
        <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant bg-white hover:border-primary/40 cursor-pointer transition-colors">
          <input type="checkbox" class="address-company-cb accent-primary" value="${escapeHtml(c.id)}" ${checked} />
          <span class="text-label-sm text-on-surface">${label}</span>
        </label>`;
    }).join('');
  };

  const getSelectedCompanyIds = () => {
    return Array.from(container.querySelectorAll('.address-company-cb:checked')).map(cb => cb.value);
  };

  const renderAddresses = () => {
    if (!addressTbody) return;
    const addrs = certData.addresses || [];
    const companies = certData.companies || [];
    const groups = groupAddresses(addrs).sort((a, b) => sortAsc(a.address, b.address));
    if (!groups.length) {
      addressTbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">' + t('settings.addressEmpty') + '</td></tr>';
      return;
    }
    addressTbody.innerHTML = groups.map(group => {
      const sortedCompanyIds = [...group.company_ids].sort((a, b) => {
        const nameA = companies.find(co => co.id === a)?.name || a;
        const nameB = companies.find(co => co.id === b)?.name || b;
        return sortAsc(nameA, nameB);
      });
      const companyBlocks = sortedCompanyIds.length
        ? sortedCompanyIds.map((cid, idx) => {
            const c = companies.find(co => co.id === cid);
            const divider = idx > 0 ? ' pt-2 mt-2 border-t border-outline-variant/50' : '';
            if (!c) {
              return `<div class="leading-relaxed${divider}"><span class="text-outline">${escapeHtml(cid)}</span></div>`;
            }
            return `<div class="leading-relaxed${divider}">${escapeHtml(c.name)}</div>`;
          }).join('')
        : '<span class="text-outline">—</span>';
      return `
        <tr class="hover:bg-surface-container-low transition-colors group align-top">
          <td class="${CERT_CELL} max-w-md">
            ${escapeHtml(group.address)}
            ${group.address_en ? `<div class="text-outline mt-0.5 leading-relaxed">${escapeHtml(group.address_en)}</div>` : ''}
          </td>
          <td class="${CERT_CELL} min-w-[11rem]">
            <div class="flex flex-col">${companyBlocks}</div>
          </td>
          <td class="px-4 py-2 text-right">
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="btn-edit-address p-1 text-primary hover:bg-primary/10 rounded-lg transition-colors" data-group-key="${escapeHtml(group.key)}" title="${t('common.edit')}"><span class="material-symbols-outlined text-[14px]">edit</span></button>
              <button class="btn-delete-address p-1 text-error hover:bg-error/10 rounded-lg transition-colors" data-group-key="${escapeHtml(group.key)}" title="${t('common.delete')}"><span class="material-symbols-outlined text-[14px]">delete</span></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  };

  const resetAddressForm = () => {
    container.querySelector('#address-edit-group-key').value = '';
    container.querySelector('#address-paste-th').value = '';
    container.querySelector('#address-paste-en').value = '';
    setThPartsToForm(EMPTY_ADDRESS_PARTS());
    setEnPartsToForm(EMPTY_ADDRESS_PARTS());
    fillAddressCompanyCheckboxes([]);
    setAddressInputMode('fields');
  };

  const openAddressModal = (group = null) => {
    resetAddressForm();
    const companies = certData.companies || [];
    if (!companies.length) {
      alert(t('settings.addressCompanyEmpty'));
      return;
    }
    if (group) {
      container.querySelector('#address-edit-group-key').value = group.key;
      container.querySelector('#address-modal-title').textContent = t('settings.addressEdit');
      fillAddressCompanyCheckboxes(group.company_ids);
      const sample = group.records[0];
      setThPartsToForm(partsFromRecord(sample, 'th'));
      setEnPartsToForm(partsFromRecord(sample, 'en'));
    } else {
      container.querySelector('#address-modal-title').textContent = t('settings.addressAdd');
      fillAddressCompanyCheckboxes([]);
    }
    container.querySelector('#address-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  const closeAddressModal = () => {
    container.querySelector('#address-modal').classList.add('hidden');
    document.body.style.overflow = '';
  };

  const nextAddressId = (list) => {
    return list.reduce((m, a) => Math.max(m, parseInt((a.id || 'a0').replace('a', ''), 10) || 0), 0) + 1;
  };

  container.querySelector('#btn-add-address')?.addEventListener('click', () => openAddressModal());
  container.querySelector('#address-modal-close')?.addEventListener('click', closeAddressModal);
  container.querySelector('#address-modal-cancel')?.addEventListener('click', closeAddressModal);
  container.querySelector('#address-modal-backdrop')?.addEventListener('click', closeAddressModal);
  container.querySelector('#address-mode-fields')?.addEventListener('click', () => setAddressInputMode('fields'));
  container.querySelector('#address-mode-paste')?.addEventListener('click', () => setAddressInputMode('paste'));

  container.querySelector('#address-parse-btn')?.addEventListener('click', () => {
    const thText = container.querySelector('#address-paste-th')?.value.trim() || '';
    const enText = container.querySelector('#address-paste-en')?.value.trim() || '';
    if (!thText && !enText) {
      alert(t('settings.addressPasteRequired'));
      return;
    }
    if (thText) setThPartsToForm(parseThaiAddress(thText));
    if (enText) setEnPartsToForm(parseEnglishAddress(enText));
    setAddressInputMode('fields');
  });

  ADDR_TH_FIELDS.forEach(field => {
    container.querySelector(`#addr-th-${field}`)?.addEventListener('input', updateAddressPreviews);
  });
  ADDR_EN_FIELDS.forEach(field => {
    container.querySelector(`#addr-en-${field}`)?.addEventListener('input', updateAddressPreviews);
  });

  container.querySelector('#address-modal-save')?.addEventListener('click', () => {
    const editGroupKey = container.querySelector('#address-edit-group-key').value;
    const companyIds = getSelectedCompanyIds();
    const thParts = getThPartsFromForm();
    const enParts = getEnPartsFromForm();
    const address = buildThaiAddress(thParts);
    const addressEn = buildEnglishAddress(enParts);

    if (!companyIds.length) {
      alert(t('settings.addressCompanyRequired'));
      return;
    }
    if (!address) {
      alert(t('settings.addressRequired'));
      return;
    }
    if (!addressEn) {
      alert(t('settings.addressEnRequired'));
      return;
    }

    let list = [...(certData.addresses || [])];
    const newGroupKey = makeAddressGroupKey(address, addressEn);

    if (editGroupKey) {
      list = list.filter(a => makeAddressGroupKey(a.address, a.address_en) !== editGroupKey);
    }

    const conflict = list.find(a => makeAddressGroupKey(a.address, a.address_en) === newGroupKey && companyIds.includes(a.company_id));
    if (conflict) {
      alert(t('settings.addressDuplicateCompany'));
      return;
    }

    let idCounter = nextAddressId(list);
    const oldRecords = editGroupKey
      ? (certData.addresses || []).filter(a => makeAddressGroupKey(a.address, a.address_en) === editGroupKey)
      : [];
    const oldByCompany = Object.fromEntries(oldRecords.map(r => [r.company_id, r]));

    for (const companyId of companyIds) {
      const existing = oldByCompany[companyId];
      list.push({
        id: existing?.id || ('a' + idCounter++),
        company_id: companyId,
        address,
        address_en: addressEn,
        parts: thParts,
        parts_en: enParts,
      });
    }

    saveCert('addresses', list);
    renderAddresses();
    renderCompanies();
    closeAddressModal();
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-edit-address');
    if (!btn) return;
    const key = btn.getAttribute('data-group-key');
    const group = groupAddresses(certData.addresses || []).find(g => g.key === key);
    if (group) openAddressModal(group);
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-address');
    if (!btn) return;
    const key = btn.getAttribute('data-group-key');
    if (!confirm(t('settings.addressDeleteConfirm'))) return;
    let list = certData.addresses || [];
    list = list.filter(a => makeAddressGroupKey(a.address, a.address_en) !== key);
    saveCert('addresses', list);
    renderAddresses();
    renderCompanies();
  });

  // ── Notes ──
  const renderNotes = () => {
    if (!notesTbody) return;
    const items = certData.notes || [];
    if (!items.length) {
      notesTbody.innerHTML = '<tr><td colspan="2" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">' + t('settings.notesEmpty') + '</td></tr>';
      return;
    }
    const rows = items
      .map((item, idx) => ({ item, idx, ...normalizeNoteItem(item) }))
      .filter(entry => entry.text || entry.text_en)
      .sort((a, b) => sortAsc(a.text, b.text))
      .map(({ text, text_en: textEn, idx }) => `
        <tr class="hover:bg-surface-container-low transition-colors group">
          <td class="${CERT_CELL}">
            ${escapeHtml(text)}${textEn ? ` <span class="text-outline">(${escapeHtml(textEn)})</span>` : ''}
          </td>
          <td class="px-4 py-2 text-right">
            <button class="btn-remove-note p-1 text-outline hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" data-index="${idx}" title="${t('common.delete')}">
              <span class="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </td>
        </tr>`);
    notesTbody.innerHTML = rows.length
      ? rows.join('')
      : '<tr><td colspan="2" class="px-4 py-4 text-center text-on-surface-variant text-label-sm">' + t('settings.notesEmpty') + '</td></tr>';
  };

  container.querySelector('#btn-add-note')?.addEventListener('click', () => {
    const val = prompt(t('settings.notesPrompt'));
    if (val && val.trim()) {
      const valEn = prompt(t('settings.notesPromptEn'));
      const list = certData.notes || [];
      list.push({ text: val.trim(), text_en: (valEn && valEn.trim()) ? valEn.trim() : '' });
      saveCert('notes', list);
      renderNotes();
    }
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove-note');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-index'));
    if (!confirm(t('settings.notesDeleteConfirm'))) return;
    const list = certData.notes || [];
    list.splice(idx, 1);
    saveCert('notes', list);
    renderNotes();
  });

  loadBUs();
  loadPickups();
}
