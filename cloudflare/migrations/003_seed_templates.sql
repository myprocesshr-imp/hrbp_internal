-- Seed: 3 default certificate templates from docx templates
-- Category values match getTemplateHtml() catMap keys in templates.js

DELETE FROM templates;

INSERT INTO templates (id, name, category, content, status, version, updated_by) VALUES
('tpl-work-th',
 'หนังสือรับรองการทำงาน (Thai)',
 'หนังสือรับรองการทำงาน',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:''Angsana New'',''TH Sarabun New'',''Sarabun'',serif;color:#1a1a1a;background:#fff; }
.cert-page { width:210mm;min-height:297mm;padding:22mm 28mm 28mm;position:relative;background:#fff; }
@media print{.cert-page{width:100%;min-height:100vh;padding:20mm 25mm;}body{-webkit-print-color-adjust:exact;}}
.header{text-align:center;margin-bottom:8mm;border-bottom:1px solid #1a1a1a;padding-bottom:4mm;}
.header h1{font-size:20pt;font-weight:bold;line-height:1.2;}
.header .co-address{font-size:16pt;line-height:1.2;}
.cert-number-row{font-size:16pt;margin-bottom:6mm;text-align:right;font-weight:bold;}
.doc-title{font-size:20pt;font-weight:700;letter-spacing:1px;margin-bottom:8mm;text-align:center;}
.body-text{font-size:16pt;line-height:1.8;text-align:justify;margin-bottom:8mm;}
.field{display:inline-block;border-bottom:1px solid #1a1a1a;min-width:150px;padding:0 4px;font-weight:700;text-align:center;vertical-align:baseline;line-height:1.2;text-indent:0;}
.purpose-line{margin-top:8mm;font-size:16pt;}
.signature-area{margin-top:12mm;display:flex;justify-content:flex-end;}
.signer{text-align:center;min-width:240px;}
.issue-date{font-size:16pt;margin-bottom:4mm;}
.sig-name{font-weight:700;font-size:16pt;margin-top:2px;}
.sig-pos{font-size:16pt;}
.footer{margin-top:15mm;border-top:1px solid #ccc;padding-top:4mm;font-size:16pt;line-height:1.4;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:48pt;color:rgba(200,200,200,0.02);font-weight:700;pointer-events:none;}
</style></head><body>
<div class="cert-page">
<div class="watermark">HRBP INTERNAL</div>
<div class="header"><h1>{{company_name}}</h1><div class="co-address">{{company_address}}</div></div>
<div class="cert-number-row">HRBP {{cert_number}}</div>
<div class="doc-title" style="margin-top:10mm;margin-bottom:15mm;">หนังสือรับรองการทำงาน</div>
<div class="body-text">
  <p style="text-indent:48px;">โดยหนังสือฉบับนี้ขอรับรองว่า
    <span class="field" style="min-width:200px;">{{full_name}}</span> รหัสพนักงาน
    <span class="field" style="min-width:100px;">{{emp_id}}</span> เป็นพนักงานของบริษัท
    <span class="field" style="min-width:240px;">{{company_name}}</span> ปฏิบัติงานในตำแหน่ง
    <span class="field" style="min-width:150px;">{{position}}</span> ฝ่าย
    <span class="field" style="min-width:120px;">{{department}}</span>
    เริ่มทำงานตั้งแต่ วันที่ <span class="field" style="min-width:120px;">{{start_date}}</span> ถึง ปัจจุบัน
  </p>
  <div class="purpose-line" style="margin-top:12mm;"><strong>หมายเหตุ :</strong> <span style="margin-left:4px;">{{purpose}}</span></div>
</div>
<div class="signature-area" style="margin-top:20mm;"><div class="signer">
  <div class="issue-date">ออกให้ ณ วันที่ {{issue_date}}</div>
  <div id="cb-sig-box" style="width:200px;height:68px;margin:0 auto 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>
  <div class="sig-name">( {{hr_signer_name}} )</div>
  <div class="sig-pos">{{hr_signer_position}}</div>
</div></div>
<div class="footer" style="margin-top:25mm;"><strong><em>ฝ่ายทรัพยากรมนุษย์</em></strong><br/>คุณ{{hr_officer_name}} โทร. 038-540330 / {{hr_officer_phone}} / E-mail : {{hr_officer_email}}</div>
</div></body></html>',
 'published', 'V 1.8', 'System'),

('tpl-work-en',
 'หนังสือรับรองการทำงาน (Eng)',
 'หนังสือรับรองการทำงาน',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:''Angsana New'',''TH Sarabun New'',''Sarabun'',serif;color:#1a1a1a;background:#fff; }
.cert-page { width:210mm;min-height:297mm;padding:22mm 28mm 28mm;position:relative;background:#fff; }
@media print{.cert-page{width:100%;min-height:100vh;padding:20mm 25mm;}body{-webkit-print-color-adjust:exact;}}
.header{text-align:center;margin-bottom:8mm;border-bottom:1px solid #1a1a1a;padding-bottom:4mm;}
.header h1{font-size:20pt;font-weight:bold;line-height:1.2;}
.header .co-address{font-size:16pt;line-height:1.2;}
.cert-number-row{font-size:16pt;margin-bottom:6mm;text-align:right;font-weight:bold;}
.doc-title{font-size:20pt;font-weight:700;letter-spacing:1px;margin-bottom:8mm;text-align:center;}
.body-text{font-size:16pt;line-height:1.8;text-align:justify;margin-bottom:8mm;}
.field{display:inline-block;border-bottom:1px solid #1a1a1a;min-width:150px;padding:0 4px;font-weight:700;text-align:center;vertical-align:baseline;line-height:1.2;text-indent:0;}
.purpose-line{margin-top:8mm;font-size:16pt;}
.signature-area{margin-top:12mm;display:flex;justify-content:flex-end;}
.signer{text-align:center;min-width:240px;}
.issue-date{font-size:16pt;margin-bottom:4mm;}
.sig-name{font-weight:700;font-size:16pt;margin-top:2px;}
.sig-pos{font-size:16pt;}
.footer{margin-top:15mm;border-top:1px solid #ccc;padding-top:4mm;font-size:16pt;line-height:1.4;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:48pt;color:rgba(200,200,200,0.02);font-weight:700;pointer-events:none;}
</style></head><body>
<div class="cert-page">
<div class="watermark">HRBP INTERNAL</div>
<div class="header"><h1>{{company_name}}</h1><div class="co-address">{{company_address_en}}</div></div>
<div class="cert-number-row" style="text-align:justify;display:flex;justify-content:space-between;width:100%;">
  <span>HRBP {{cert_number}}</span>
  <span>Date: {{issue_date_en}}</span>
</div>
<div class="doc-title" style="margin-top:10mm;margin-bottom:15mm;">To Whom It May Concern</div>
<div class="body-text">
  <p style="text-indent:48px;margin-bottom:6mm;">
    This letter is to certify that <span class="field" style="min-width:200px;">{{full_name}}</span> currently employed by <span class="field" style="min-width:240px;">{{company_name}}</span> as <span class="field" style="min-width:180px;">{{position}}</span>. She/He has been working with the company since <span class="field" style="min-width:120px;">{{start_date_en}}</span> - Present.
  </p>
  <p style="margin-bottom:6mm;">
    Should you require any information regarding the above, please do not hesitate to contact us.
  </p>
</div>
<div class="signature-area" style="margin-top:15mm;justify-content:flex-start;"><div class="signer" style="text-align:left;min-width:300px;">
  <div>Sincerely yours,</div>
  <div id="cb-sig-box" style="width:200px;height:68px;margin:0 0 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>
  <div class="sig-name">( {{hr_signer_name}} )</div>
  <div class="sig-pos">{{hr_signer_position}}</div>
  <div style="font-size:16pt;margin-top:2px;">Tel : {{hr_officer_phone}}</div>
</div></div>
<div class="footer" style="margin-top:20mm;">
  <strong>Remark:</strong> {{company_name}} is an affiliated company of Double A (1991) Public Company Limited.
</div>
</div></body></html>',
 'published', 'V 2.0', 'System'),

('tpl-visa-abroad',
 'หนังสือรับรองกรณีส่งพนักงานทำงานไปต่างประเทศ (Eng)',
 'หนังสือรับรองเพื่อทำวีซ่า',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:''Angsana New'',''TH Sarabun New'',''Sarabun'',serif;color:#1a1a1a;background:#fff; }
.cert-page { width:210mm;min-height:297mm;padding:22mm 28mm 28mm;position:relative;background:#fff; }
@media print{.cert-page{width:100%;min-height:100vh;padding:20mm 25mm;}body{-webkit-print-color-adjust:exact;}}
.header{text-align:center;margin-bottom:8mm;border-bottom:1px solid #1a1a1a;padding-bottom:4mm;}
.header h1{font-size:20pt;font-weight:bold;line-height:1.2;}
.header .co-address{font-size:16pt;line-height:1.2;}
.cert-number-row{font-size:16pt;margin-bottom:6mm;text-align:right;font-weight:bold;}
.doc-title{font-size:20pt;font-weight:700;letter-spacing:1px;margin-bottom:8mm;text-align:center;}
.body-text{font-size:16pt;line-height:1.8;text-align:justify;margin-bottom:8mm;}
.field{display:inline-block;border-bottom:1px solid #1a1a1a;min-width:150px;padding:0 4px;font-weight:700;text-align:center;vertical-align:baseline;line-height:1.2;text-indent:0;}
.purpose-line{margin-top:8mm;font-size:16pt;}
.signature-area{margin-top:12mm;display:flex;justify-content:flex-end;}
.signer{text-align:center;min-width:240px;}
.issue-date{font-size:16pt;margin-bottom:4mm;}
.sig-name{font-weight:700;font-size:16pt;margin-top:2px;}
.sig-pos{font-size:16pt;}
.footer{margin-top:15mm;border-top:1px solid #ccc;padding-top:4mm;font-size:16pt;line-height:1.4;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:48pt;color:rgba(200,200,200,0.02);font-weight:700;pointer-events:none;}
</style></head><body>
<div class="cert-page">
<div class="watermark">HRBP INTERNAL</div>
<div class="header"><h1>{{company_name}}</h1><div class="co-address">{{company_address_en}}</div></div>
<div class="cert-number-row" style="text-align:justify;display:flex;justify-content:space-between;width:100%;">
  <span>HRBP {{cert_number}}</span>
  <span>Date: {{issue_date_en}}</span>
</div>
<div class="doc-title" style="margin-top:10mm;margin-bottom:15mm;">To Whom It May Concern</div>
<div class="body-text">
  <p style="text-indent:48px;margin-bottom:6mm;">
    This letter is to certify that <span class="field" style="min-width:200px;">{{full_name}}</span> currently employed by <span class="field" style="min-width:240px;">{{company_name}}</span> as <span class="field" style="min-width:180px;">{{position}}</span>. She/He has been working with the company since <span class="field" style="min-width:120px;">{{start_date_en}}</span> to present. Her/His average salary is <span class="field" style="min-width:100px;">{{salary_amount}}</span> Baht per month.
  </p>
  <p style="text-indent:48px;margin-bottom:6mm;">
    <span class="field" style="min-width:200px;">{{full_name}}</span> will have a business trip to <span class="field" style="min-width:120px;">{{visa_country}}</span> <span class="field" style="min-width:240px;">{{purpose}}</span>. During her/his stay in <span class="field" style="min-width:120px;">{{visa_country}}</span> all the expenses shall be provided by the company and she/he will still receive her/his salary from the company as usual. Moreover, her/his assigned job is not related to her/his own advantage. After finishing her/his mission, she/he will be back to resume her/his work.
  </p>
  <p style="margin-bottom:6mm;">
    Any assistance extended to <span class="field" style="min-width:200px;">{{full_name}}</span> in granting business visa is highly appreciated.
  </p>
</div>
<div class="signature-area" style="margin-top:15mm;justify-content:flex-start;"><div class="signer" style="text-align:left;min-width:300px;">
  <div>Sincerely yours,</div>
  <div id="cb-sig-box" style="width:200px;height:68px;margin:0 0 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>
  <div class="sig-name">( {{hr_signer_name}} )</div>
  <div class="sig-pos">{{hr_signer_position}}</div>
  <div style="font-size:16pt;margin-top:2px;">Tel : {{hr_officer_phone}}</div>
</div></div>
</div></body></html>',
 'published', 'V 2.0', 'System');
