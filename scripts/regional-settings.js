(() => {
  const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
  const defaults = {
    country: 'SA',
    currency: 'SAR',
    timeZone: detectedTimeZone,
    locale: 'en-SA',
    dateStyle: 'medium',
    weekStart: 'saturday'
  };
  const regionCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const fallbackCurrencies = 'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWL'.split(' ');
  const localeChoices = [
    ['en-SA', 'English (Saudi Arabia)'], ['ar-SA', 'العربية (السعودية)'],
    ['en-AE', 'English (United Arab Emirates)'], ['ar-AE', 'العربية (الإمارات)'],
    ['en-GB', 'English (United Kingdom)'], ['en-US', 'English (United States)'],
    ['fr-FR', 'Français (France)'], ['de-DE', 'Deutsch (Deutschland)'],
    ['es-ES', 'Español (España)'], ['it-IT', 'Italiano (Italia)'],
    ['pt-BR', 'Português (Brasil)'], ['nl-NL', 'Nederlands (Nederland)'],
    ['tr-TR', 'Türkçe (Türkiye)'], ['hi-IN', 'हिन्दी (भारत)'],
    ['ur-PK', 'اردو (پاکستان)'], ['zh-CN', '中文（中国）'],
    ['ja-JP', '日本語（日本）'], ['ko-KR', '한국어 (대한민국)']
  ];

  function supportedValues(kind, fallback) {
    try { return Intl.supportedValuesOf(kind); } catch (error) { return fallback; }
  }
  function displayNames(type, locale) {
    try { return new Intl.DisplayNames([locale || 'en'], { type }); } catch (error) { return null; }
  }
  function countryName(code, locale = 'en') { return displayNames('region', locale)?.of(code) || code; }
  function currencyName(code, locale = 'en') { return displayNames('currency', locale)?.of(code) || code; }
  function selectedRegional() { return accountPreferences.regional || defaults; }
  function currencyCode() { return selectedRegional().currency || 'SAR'; }
  function regionalLocale() { return selectedRegional().locale || 'en-SA'; }
  function formatMoney(value, options = {}) {
    const amount = Number(value) || 0;
    try {
      return new Intl.NumberFormat(regionalLocale(), {
        style: 'currency', currency: currencyCode(),
        maximumFractionDigits: options.decimals ?? (Number.isInteger(amount) ? 0 : 2)
      }).format(amount);
    } catch (error) { return `${currencyCode()} ${amount.toLocaleString()}`; }
  }
  function previewDate() {
    let region = selectedRegional(), dateStyle = region.dateStyle === 'numeric' ? undefined : region.dateStyle;
    try {
      return new Intl.DateTimeFormat(region.locale, {
        ...(dateStyle ? { dateStyle } : { year: 'numeric', month: '2-digit', day: '2-digit' }),
        timeStyle: 'short', timeZone: region.timeZone
      }).format(new Date());
    } catch (error) { return new Date().toLocaleString(); }
  }

  let remoteRegional = window.__NAZOFT_REMOTE_STATE__?.accountPreferences?.regional;
  let existingRegional = accountPreferences.regional;
  accountPreferences.regional = {
    ...defaults,
    ...(window.__NAZOFT_AUTHENTICATED__ && remoteRegional ? remoteRegional : existingRegional || {})
  };
  accountPreferences.notifications.timezoneMode = 'manual';
  accountPreferences.notifications.timezone = accountPreferences.regional.timeZone;
  account.country = countryName(accountPreferences.regional.country, accountPreferences.regional.locale);
  account.currency = accountPreferences.regional.currency;

  window.NazoftRegional = { currencyCode, formatMoney, countryName, selectedRegional };

  const workspaceStateRegionalBase = currentWorkspaceState;
  currentWorkspaceState = function () { return { ...workspaceStateRegionalBase(), accountPreferences }; };
  const savePreferencesRegionalBase = saveAccountPreferences;
  saveAccountPreferences = function () {
    accountPreferences.notifications.timezoneMode = 'manual';
    accountPreferences.notifications.timezone = accountPreferences.regional.timeZone;
    account.country = countryName(accountPreferences.regional.country, accountPreferences.regional.locale);
    account.currency = accountPreferences.regional.currency;
    savePreferencesRegionalBase();
    saveState();
  };

  function optionList(values, selected, label) {
    return values.map(value => `<option value="${safe(value)}" ${value === selected ? 'selected' : ''}>${safe(label(value))}</option>`).join('');
  }
  function regionalSettingsHtml() {
    let region = selectedRegional(), countries = regionCodes.slice().sort((a, b) => countryName(a, region.locale).localeCompare(countryName(b, region.locale))), currencies = supportedValues('currency', fallbackCurrencies), zones = supportedValues('timeZone', [detectedTimeZone, 'Asia/Riyadh', 'UTC']);
    return `<div class="regional-settings-head"><div><h2>Country, currency & time</h2><p class="muted">One workspace-wide area for commercial values, dates, reports, notifications, and working hours.</p></div><span class="regional-globe" aria-hidden="true">◎</span></div><form id="regionalSettingsForm"><section class="preference-section regional-grid"><div class="field"><label for="regionalCountry">Business country</label><select id="regionalCountry" name="country">${optionList(countries, region.country, code => `${countryName(code, region.locale)} · ${code}`)}</select><small>Used for the workspace identity and regional defaults.</small></div><div class="field"><label for="regionalCurrency">Currency</label><select id="regionalCurrency" name="currency">${optionList(currencies, region.currency, code => `${code} · ${currencyName(code, region.locale)}`)}</select><small>Applied to leads, pipelines, won deals, Excel files, and PDF reports.</small></div><div class="field"><label for="regionalTimeZone">Time zone</label><select id="regionalTimeZone" name="timeZone">${optionList(zones, region.timeZone, zone => zone.replaceAll('_', ' '))}</select><small>Controls reminders, summaries, work hours, and timestamps.</small></div><div class="field"><label for="regionalLocale">Number & date language</label><select id="regionalLocale" name="locale">${localeChoices.map(([value, label]) => `<option value="${safe(value)}" ${value === region.locale ? 'selected' : ''}>${safe(label)}</option>`).join('')}</select><small>Controls separators, currency placement, and translated date names.</small></div><div class="field"><label for="regionalDateStyle">Date display</label><select id="regionalDateStyle" name="dateStyle"><option value="medium" ${region.dateStyle === 'medium' ? 'selected' : ''}>3 Sep 2026</option><option value="long" ${region.dateStyle === 'long' ? 'selected' : ''}>3 September 2026</option><option value="short" ${region.dateStyle === 'short' ? 'selected' : ''}>03/09/2026</option><option value="numeric" ${region.dateStyle === 'numeric' ? 'selected' : ''}>2026-09-03 style</option></select></div><div class="field"><label for="regionalWeekStart">Week starts on</label><select id="regionalWeekStart" name="weekStart"><option value="saturday" ${region.weekStart === 'saturday' ? 'selected' : ''}>Saturday</option><option value="sunday" ${region.weekStart === 'sunday' ? 'selected' : ''}>Sunday</option><option value="monday" ${region.weekStart === 'monday' ? 'selected' : ''}>Monday</option></select></div></section><section class="regional-preview" aria-live="polite"><span><small>Money preview</small><b data-regional-money>${safe(formatMoney(125000))}</b></span><span><small>Local date & time</small><b data-regional-date>${safe(previewDate())}</b></span></section><div class="preference-actions"><button class="btn primary" type="submit">Save regional settings</button></div></form>`;
  }

  let regionalButton = document.createElement('button');
  regionalButton.dataset.setting = 'regional'; regionalButton.textContent = 'Country, currency & time';
  $('[data-setting="fields"]')?.insertAdjacentElement('beforebegin', regionalButton);
  regionalButton.onclick = () => selectSetting('regional');

  const settingsHtmlRegionalBase = settingsHtml;
  settingsHtml = function (name) { return name === 'regional' ? regionalSettingsHtml() : settingsHtmlRegionalBase(name); };

  function replaceCurrencyText(root = document) {
    let code = currencyCode(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script,style')) continue;
      if (/\bSAR\b/.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(/\bSAR\b/g, code);
    }
    $('#wonCurrencyCode')?.replaceChildren(code);
  }
  function replaceReportCurrency(sheets) {
    let code = currencyCode();
    (sheets || []).forEach(sheet => (sheet.rows || []).forEach(row => {
      row.cells = (row.cells || []).map(cell => typeof cell === 'string' ? cell.replace(/\bSAR\b/g, code) : cell);
    }));
    return sheets;
  }

  const renderConfigRegionalBase = renderConfigSetting;
  renderConfigSetting = function (name = currentSetting) {
    renderConfigRegionalBase(name);
    let pane = $('#settingsPane');
    if (name === 'notifications') {
      let row = pane.querySelector('.timezone-row');
      if (row) row.innerHTML = `<div class="grow"><b>Time zone</b><small>${safe(selectedRegional().timeZone)} · managed with the workspace regional settings.</small></div><button class="btn" type="button" data-open-regional>Change</button>`;
      pane.querySelector('[data-open-regional]')?.addEventListener('click', () => selectSetting('regional'));
    }
    if (name === 'regional') {
      let form = $('#regionalSettingsForm');
      form?.addEventListener('change', () => {
        let draft = Object.fromEntries(new FormData(form));
        let old = accountPreferences.regional; accountPreferences.regional = { ...old, ...draft };
        form.querySelector('[data-regional-money]').textContent = formatMoney(125000);
        form.querySelector('[data-regional-date]').textContent = previewDate();
        accountPreferences.regional = old;
      });
      form?.addEventListener('submit', event => {
        event.preventDefault();
        accountPreferences.regional = { ...accountPreferences.regional, ...Object.fromEntries(new FormData(form)) };
        saveAccountPreferences();
        renderLeads($('#leadSearch').value); renderBoard($('#boardSearch').value); renderToday(); renderSalesPerformance();
        renderConfigSetting('regional'); replaceCurrencyText(); toast('Regional settings saved across the workspace');
      });
    }
    replaceCurrencyText(pane);
  };

  const renderTodayRegionalBase = renderToday;
  renderToday = function (...args) { let result = renderTodayRegionalBase(...args); replaceCurrencyText($('#today')); return result; };
  const renderLeadsRegionalBase = renderLeads;
  renderLeads = function (...args) { let result = renderLeadsRegionalBase(...args); replaceCurrencyText($('#leads')); return result; };
  const renderBoardRegionalBase = renderBoard;
  renderBoard = function (...args) { let result = renderBoardRegionalBase(...args); replaceCurrencyText($('#pipeline')); return result; };
  const renderSalesRegionalBase = renderSalesPerformance;
  renderSalesPerformance = function (...args) { let result = renderSalesRegionalBase(...args); replaceCurrencyText($('#performance')); return result; };
  const openLeadRegionalBase = openLead;
  openLead = function (...args) { let result = openLeadRegionalBase(...args); replaceCurrencyText($('#drawer')); return result; };
  const reportsRegionalBase = buildReportSheets;
  buildReportSheets = function (...args) { return replaceReportCurrency(reportsRegionalBase(...args)); };
  const allLeadsRegionalBase = allLeadExportSheet;
  allLeadExportSheet = function (...args) { return replaceReportCurrency(allLeadsRegionalBase(...args)); };

  saveAccountPreferences();
  replaceCurrencyText();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && /\bSAR\b/.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(/\bSAR\b/g, currencyCode());
    else if (node.nodeType === Node.ELEMENT_NODE) replaceCurrencyText(node);
  }))).observe(document.body, { childList: true, subtree: true });
  if (typeof applyAccess === 'function') applyAccess();
})();
