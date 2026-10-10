(function () {
  'use strict';
  if (window.__studentOSLoaded) return;
  window.__studentOSLoaded = true;

  const LOCATION_KEY = 'studentos.location.v1';
  const COUNTRY_DATA = `AF:Afghanistan|AX:Åland Islands|AL:Albania|DZ:Algeria|AS:American Samoa|AD:Andorra|AO:Angola|AI:Anguilla|AQ:Antarctica|AG:Antigua and Barbuda|AR:Argentina|AM:Armenia|AW:Aruba|AU:Australia|AT:Austria|AZ:Azerbaijan|BS:Bahamas|BH:Bahrain|BD:Bangladesh|BB:Barbados|BY:Belarus|BE:Belgium|BZ:Belize|BJ:Benin|BM:Bermuda|BT:Bhutan|BO:Bolivia|BQ:Caribbean Netherlands|BA:Bosnia and Herzegovina|BW:Botswana|BV:Bouvet Island|BR:Brazil|IO:British Indian Ocean Territory|BN:Brunei|BG:Bulgaria|BF:Burkina Faso|BI:Burundi|CV:Cabo Verde|KH:Cambodia|CM:Cameroon|CA:Canada|KY:Cayman Islands|CF:Central African Republic|TD:Chad|CL:Chile|CN:China|CX:Christmas Island|CC:Cocos Islands|CO:Colombia|KM:Comoros|CG:Congo|CD:Democratic Republic of the Congo|CK:Cook Islands|CR:Costa Rica|CI:Côte d’Ivoire|HR:Croatia|CU:Cuba|CW:Curaçao|CY:Cyprus|CZ:Czechia|DK:Denmark|DJ:Djibouti|DM:Dominica|DO:Dominican Republic|EC:Ecuador|EG:Egypt|SV:El Salvador|GQ:Equatorial Guinea|ER:Eritrea|EE:Estonia|SZ:Eswatini|ET:Ethiopia|FK:Falkland Islands|FO:Faroe Islands|FJ:Fiji|FI:Finland|FR:France|GF:French Guiana|PF:French Polynesia|TF:French Southern Territories|GA:Gabon|GM:Gambia|GE:Georgia|DE:Germany|GH:Ghana|GI:Gibraltar|GR:Greece|GL:Greenland|GD:Grenada|GP:Guadeloupe|GU:Guam|GT:Guatemala|GG:Guernsey|GN:Guinea|GW:Guinea-Bissau|GY:Guyana|HT:Haiti|HM:Heard Island and McDonald Islands|VA:Vatican City|HN:Honduras|HK:Hong Kong|HU:Hungary|IS:Iceland|IN:India|ID:Indonesia|IR:Iran|IQ:Iraq|IE:Ireland|IM:Isle of Man|IL:Israel|IT:Italy|JM:Jamaica|JP:Japan|JE:Jersey|JO:Jordan|KZ:Kazakhstan|KE:Kenya|KI:Kiribati|KP:North Korea|KR:South Korea|KW:Kuwait|KG:Kyrgyzstan|LA:Laos|LV:Latvia|LB:Lebanon|LS:Lesotho|LR:Liberia|LY:Libya|LI:Liechtenstein|LT:Lithuania|LU:Luxembourg|MO:Macao|MG:Madagascar|MW:Malawi|MY:Malaysia|MV:Maldives|ML:Mali|MT:Malta|MH:Marshall Islands|MQ:Martinique|MR:Mauritania|MU:Mauritius|YT:Mayotte|MX:Mexico|FM:Micronesia|MD:Moldova|MC:Monaco|MN:Mongolia|ME:Montenegro|MS:Montserrat|MA:Morocco|MZ:Mozambique|MM:Myanmar|NA:Namibia|NR:Nauru|NP:Nepal|NL:Netherlands|NC:New Caledonia|NZ:New Zealand|NI:Nicaragua|NE:Niger|NG:Nigeria|NU:Niue|NF:Norfolk Island|MK:North Macedonia|MP:Northern Mariana Islands|NO:Norway|OM:Oman|PK:Pakistan|PW:Palau|PS:Palestine|PA:Panama|PG:Papua New Guinea|PY:Paraguay|PE:Peru|PH:Philippines|PN:Pitcairn Islands|PL:Poland|PT:Portugal|PR:Puerto Rico|QA:Qatar|RE:Réunion|RO:Romania|RU:Russia|RW:Rwanda|BL:Saint Barthélemy|SH:Saint Helena|KN:Saint Kitts and Nevis|LC:Saint Lucia|MF:Saint Martin|PM:Saint Pierre and Miquelon|VC:Saint Vincent and the Grenadines|WS:Samoa|SM:San Marino|ST:Sao Tome and Principe|SA:Saudi Arabia|SN:Senegal|RS:Serbia|SC:Seychelles|SL:Sierra Leone|SG:Singapore|SX:Sint Maarten|SK:Slovakia|SI:Slovenia|SB:Solomon Islands|SO:Somalia|ZA:South Africa|GS:South Georgia and the South Sandwich Islands|SS:South Sudan|ES:Spain|LK:Sri Lanka|SD:Sudan|SR:Suriname|SJ:Svalbard and Jan Mayen|SE:Sweden|CH:Switzerland|SY:Syria|TW:Taiwan|TJ:Tajikistan|TZ:Tanzania|TH:Thailand|TL:Timor-Leste|TG:Togo|TK:Tokelau|TO:Tonga|TT:Trinidad and Tobago|TN:Tunisia|TR:Türkiye|TM:Turkmenistan|TC:Turks and Caicos Islands|TV:Tuvalu|UG:Uganda|UA:Ukraine|AE:United Arab Emirates|GB:United Kingdom|US:United States|UM:United States Minor Outlying Islands|UY:Uruguay|UZ:Uzbekistan|VU:Vanuatu|VE:Venezuela|VN:Vietnam|VG:British Virgin Islands|VI:U.S. Virgin Islands|WF:Wallis and Futuna|EH:Western Sahara|YE:Yemen|ZM:Zambia|ZW:Zimbabwe|XK:Kosovo|IC:Canary Islands|EA:Ceuta and Melilla`;
  const COUNTRIES = COUNTRY_DATA.split('|').map(item => {
    const split = item.indexOf(':');
    return { code: item.slice(0, split), name: item.slice(split + 1) };
  }).sort((a,b) => a.name.localeCompare(b.name, 'en'));
  const LANGUAGES = [
    ['en','English'],['fr','Français'],['es','Español'],['pt','Português'],['ar','العربية'],['sw','Kiswahili'],['zh','中文'],['de','Deutsch']
  ];
  const UI_TEXT = {
    en:{navHome:'Home',navExplore:'Explore',navGlobal:'Global',navServices:'Services',navCommunity:'Community',navMedia:'Media',navAccount:'My space',launchKicker:'YOUR EVERYDAY ECOSYSTEM',launchTitle:'One home. Your whole world.',launchLede:'Choose a destination and focus on one task at a time. The rest of StudentOS stays out of your way.',tileCampus:'Campus & community',tileMySpace:'My space',assistantTitle:'Need a helpful next step?',assistantBody:'Ask StudentOS for a practical plan for study, work, housing or career goals.',assistantButton:'Ask StudentOS ↗',locationTitle:'Your discovery region',locationEdit:'Edit location ↗',hero1:'Study. Live.',hero2:'Work. Connect.',hero3:'Create. Explore.'},
    fr:{navHome:'Accueil',navExplore:'Explorer',navGlobal:'Monde',navServices:'Services',navCommunity:'Vie étudiante',navMedia:'Médias',navAccount:'Mon espace',launchKicker:'VOTRE ÉCOSYSTÈME AU QUOTIDIEN',launchTitle:'Un espace. Votre monde entier.',launchLede:'Choisissez une destination et concentrez-vous sur une tâche à la fois.',tileCampus:'Campus et communauté',tileMySpace:'Mon espace',assistantTitle:'Besoin d’une prochaine étape ?',assistantBody:'Demandez à StudentOS un plan pratique pour les études, le travail ou le logement.',assistantButton:'Demander à StudentOS ↗',locationTitle:'Votre région de découverte',locationEdit:'Modifier ↗',hero1:'Étudier. Vivre.',hero2:'Travailler. Connecter.',hero3:'Créer. Explorer.'},
    es:{navHome:'Inicio',navExplore:'Explorar',navGlobal:'Global',navServices:'Servicios',navCommunity:'Campus',navMedia:'Medios',navAccount:'Mi espacio',launchKicker:'TU ECOSISTEMA DIARIO',launchTitle:'Un espacio. Todo tu mundo.',launchLede:'Elige un destino y céntrate en una tarea cada vez.',tileCampus:'Campus y comunidad',tileMySpace:'Mi espacio',assistantTitle:'¿Necesitas un siguiente paso?',assistantBody:'Pide a StudentOS un plan práctico para estudiar, trabajar, encontrar vivienda o avanzar profesionalmente.',assistantButton:'Preguntar a StudentOS ↗',locationTitle:'Tu región de descubrimiento',locationEdit:'Cambiar ubicación ↗',hero1:'Estudia. Vive.',hero2:'Trabaja. Conecta.',hero3:'Crea. Explora.'},
    pt:{navHome:'Início',navExplore:'Explorar',navGlobal:'Global',navServices:'Serviços',navCommunity:'Campus',navMedia:'Mídia',navAccount:'Meu espaço',launchKicker:'SEU ECOSSISTEMA DIÁRIO',launchTitle:'Um lugar. Seu mundo inteiro.',launchLede:'Escolha um destino e concentre-se em uma tarefa de cada vez.',tileCampus:'Campus e comunidade',tileMySpace:'Meu espaço',assistantTitle:'Precisa do próximo passo?',assistantBody:'Peça ao StudentOS um plano prático para estudo, trabalho, moradia ou carreira.',assistantButton:'Perguntar ao StudentOS ↗',locationTitle:'Sua região de descoberta',locationEdit:'Editar localização ↗',hero1:'Estude. Viva.',hero2:'Trabalhe. Conecte.',hero3:'Crie. Explore.'},
    ar:{navHome:'الرئيسية',navExplore:'استكشف',navGlobal:'العالم',navServices:'الخدمات',navCommunity:'الحرم والمجتمع',navMedia:'الو��ائط',navAccount:'مساحتي',launchKicker:'منظومتك اليومية',launchTitle:'مكان واحد. عالمك كله.',launchLede:'اختر وجهة وركّز على مهمة واحدة في كل مرة.',tileCampus:'الحرم والمجتمع',tileMySpace:'مساحتي',assistantTitle:'هل تحتاج إلى خطوة تالية؟',assistantBody:'اطلب من StudentOS خطة عملية للدراسة أو العمل أو السكن أو التطور المهني.',assistantButton:'اسأل StudentOS ↗',locationTitle:'منطقة الاستكشاف',locationEdit:'تعديل الموقع ↗',hero1:'ادرس. عش.',hero2:'اعمل. تواصل.',hero3:'ابتكر. استكشف.'},
    sw:{navHome:'Nyumbani',navExplore:'Gundua',navGlobal:'Kimataifa',navServices:'Huduma',navCommunity:'Kampasi',navMedia:'Media',navAccount:'Nafasi yangu',launchKicker:'MFUMO WAKO WA KILA SIKU',launchTitle:'Nyumbani pamoja. Dunia yako yote.',launchLede:'Chagua unakoenda na ushughulikie jambo moja kwa wakati.',tileCampus:'Kampasi na jamii',tileMySpace:'Nafasi yangu',assistantTitle:'Unahitaji hatua inayofuata?',assistantBody:'Uliza StudentOS mpango wa vitendo kuhusu masomo, kazi, makazi au taaluma.',assistantButton:'Uliza StudentOS ↗',locationTitle:'Eneo lako la ugunduzi',locationEdit:'Badili eneo ↗',hero1:'Soma. Ishi.',hero2:'Fanya kazi. Ungana.',hero3:'Buni. Gundua.'},
    zh:{navHome:'首页',navExplore:'探索',navGlobal:'全球',navServices:'服务',navCommunity:'校园与社区',navMedia:'媒体',navAccount:'我的空间',launchKicker:'你的日常生态系统',launchTitle:'一个家，连接整个世界。',launchLede:'选择一个目的地，一次专注完成一件事。',tileCampus:'校园与社区',tileMySpace:'我的空间',assistantTitle:'需要下一步建议吗？',assistantBody:'向 StudentOS 获取有关学习、工作、住宿或职业目标的实用计划。',assistantButton:'询问 StudentOS ↗',locationTitle:'你的探索地区',locationEdit:'编辑位置 ↗',hero1:'学习。生活。',hero2:'工作。连接。',hero3:'创造。探索。'},
    de:{navHome:'Start',navExplore:'Entdecken',navGlobal:'Weltweit',navServices:'Dienste',navCommunity:'Campus & Community',navMedia:'Medien',navAccount:'Mein Bereich',launchKicker:'DEIN ALLTÄGLICHES ÖKOSYSTEM',launchTitle:'Ein Zuhause. Deine ganze Welt.',launchLede:'Wähle einen Bereich und konzentriere dich jeweils auf eine Aufgabe.',tileCampus:'Campus & Community',tileMySpace:'Mein Bereich',assistantTitle:'Brauchst du den nächsten Schritt?',assistantBody:'Bitte StudentOS um einen praktischen Plan für Studium, Arbeit, Wohnen oder Karriere.',assistantButton:'StudentOS fragen ↗',locationTitle:'Deine Entdeckungsregion',locationEdit:'Standort ändern ↗',hero1:'Lernen. Leben.',hero2:'Arbeiten. Verbinden.',hero3:'Gestalten. Entdecken.'}
  };
  const CURRENCIES = [
    ['USD','US Dollar ($)'],['EUR','Euro (€)'],['GBP','British Pound (£)'],['CAD','Canadian Dollar (CA$)'],
    ['AUD','Australian Dollar (A$)'],['KES','Kenyan Shilling (KSh)'],['UGX','Ugandan Shilling (USh)'],
    ['TZS','Tanzanian Shilling (TSh)'],['NGN','Nigerian Naira (₦)'],['ZAR','South African Rand (R)'],
    ['INR','Indian Rupee (₹)'],['CNY','Chinese Yuan (¥)'],['BRL','Brazilian Real (R$)']
  ];
  const CURRENCY_BY_COUNTRY = {
    US:'USD',CA:'CAD',GB:'GBP',IE:'EUR',DE:'EUR',FR:'EUR',ES:'EUR',PT:'EUR',IT:'EUR',NL:'EUR',BE:'EUR',AT:'EUR',FI:'EUR',GR:'EUR',
    KE:'KES',UG:'UGX',TZ:'TZS',NG:'NGN',ZA:'ZAR',IN:'INR',CN:'CNY',BR:'BRL',AU:'AUD',NZ:'AUD'
  };
  const UNIVERSITIES_BY_COUNTRY = {
    US:['Harvard University','Stanford University','Massachusetts Institute of Technology','University of California, Berkeley','Columbia University'],
    CA:['University of Toronto','University of British Columbia','McGill University','University of Waterloo'],
    GB:['University of Oxford','University of Cambridge','Imperial College London','University College London'],
    DE:['Technical University of Munich','Ludwig Maximilian University of Munich','Heidelberg University'],
    FR:['Sorbonne University','PSL University','Université Paris-Saclay'],
    KE:['University of Nairobi','Kenyatta University','Jomo Kenyatta University of Agriculture and Technology','Strathmore University','Moi University'],
    UG:['Makerere University','Kyambogo University'],TZ:['University of Dar es Salaam','University of Dodoma'],
    ZA:['University of Cape Town','University of the Witwatersrand','Stellenbosch University','University of Pretoria'],
    NG:['University of Lagos','University of Ibadan','Ahmadu Bello University'],
    IN:['University of Delhi','Indian Institute of Technology Delhi','Indian Institute of Technology Bombay'],
    AU:['University of Melbourne','Australian National University','University of Sydney','Monash University'],
    BR:['University of São Paulo','University of Campinas'],CN:['Peking University','Tsinghua University','Fudan University'],
    NZ:['University of Auckland','University of Otago'],IE:['Trinity College Dublin','University College Dublin'],
    NL:['University of Amsterdam','Delft University of Technology'],SG:['National University of Singapore','Nanyang Technological University'],
    RW:['University of Rwanda','Kigali Independent University']
  };
  const REGION_LANGUAGE = { KE:'sw',TZ:'sw',UG:'en',FR:'fr',ES:'es',PT:'pt',BR:'pt',CN:'zh',DE:'de',AT:'de',CH:'de',SA:'ar',AE:'ar',EG:'ar',MA:'ar',TN:'ar',US:'en',GB:'en',CA:'en',AU:'en',IN:'en' };
  const fallback = { country:'Kenya',countryCode:'KE',region:'',city:'',university:'',language:'en',currency:'KES',mode:'country',savedByUser:false };
  let location = readLocation();
  let profileHydrated = false;
  const $ = id => document.getElementById(id);
  const sectionIds = ['ecosystem','hubs','people','services','fundis','how','journeys','membership','faq','contact','trust'];
  const pageContent = {
    home: [],
    explore: ['hubs'],
    global: ['studentosGlobal','hubs'],
    community: ['people','hubs'],
    services: ['services','fundis'],
    studentlife: ['hubs','people'],
    media: ['hubs'],
    about: ['how','journeys','membership','faq','contact','trust']
  };
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function readLocation() {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(LOCATION_KEY) || '{}') }; }
    catch (_) { return { ...fallback }; }
  }
  function persistLocation() {
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(location)); } catch (_) {}
  }
  function hydrateFromProfile(profile) {
    if (!profile || profileHydrated || location.savedByUser) return;
    location.country = profile.country || location.country || 'Kenya';
    location.countryCode = profile.country_code || codeForCountry(location.country);
    location.region = profile.region || '';
    location.city = profile.city || '';
    location.university = profile.university || profile.campus || '';
    location.language = profile.language || 'en';
    location.currency = profile.currency || CURRENCY_BY_COUNTRY[location.countryCode] || 'USD';
    location.savedByUser = true;
    profileHydrated = true;
    persistLocation();
    updateLocationInputs();
    applyLanguage();
  }
  function adoptLocation(values) {
    const v = values || {};
    location.country = v.country || location.country || 'Kenya';
    location.countryCode = v.countryCode || v.country_code || codeForCountry(location.country);
    location.region = v.region || '';
    location.city = v.city || '';
    location.university = v.university || v.campus || '';
    location.language = v.language || location.language || 'en';
    location.currency = v.currency || location.currency || 'USD';
    location.savedByUser = true;
    profileHydrated = true;
    persistLocation();
    updateLocationInputs();
    applyLanguage();
  }
  function applyLanguage() {
    const code = LANGUAGES.some(item => item[0] === location.language) ? location.language : 'en';
    const words = UI_TEXT[code] || UI_TEXT.en;
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-so-i18n]').forEach(node => {
      const translation = words[node.dataset.soI18n];
      if (translation) node.textContent = translation;
    });
    const hero = document.querySelector('.hero h1');
    if (hero && words.hero1) hero.innerHTML = esc(words.hero1) + '<br><span>' + esc(words.hero2) + '</span><br><span class="gradient-word">' + esc(words.hero3) + '</span>';
    const heroButton = document.querySelector('.hero .hero-actions .btn.primary');
    if (heroButton) heroButton.innerHTML = esc(words.navExplore) + ' StudentOS <span aria-hidden="true">↗</span>';
  }
  function renderGlobalMapStats(data) {
    const totals = data?.totals || {};
    const values = {
      soWorldOpportunities: totals.opportunities || 0,
      soWorldProviders: totals.providers || 0,
      soWorldProfiles: totals.publicProfiles || 0,
      soWorldCountries: totals.countriesWithRecords || 0,
      soWorldUniversities: totals.universities || 0,
      soWorldEvents: totals.events || 0,
      soWorldMedia: totals.mediaItems || 0
    };
    for (const [id,value] of Object.entries(values)) {
      const node = $(id);
      if (node) node.textContent = Number(value).toLocaleString();
    }
    const byCode = new Map((data?.countries || []).map(item => [String(item.countryCode || '').trim(),item]));
    document.querySelectorAll('.so-map-pin[data-so-preset]').forEach(pin => {
      const item = byCode.get(pin.dataset.soPreset) || {};
      const country = COUNTRIES.find(row => row.code === pin.dataset.soPreset)?.name || pin.dataset.soPreset;
      const count = Number(item.opportunities || 0) + Number(item.providers || 0) + Number(item.publicProfiles || 0);
      pin.classList.toggle('has-content',count > 0);
      pin.title = country + ': ' + Number(item.opportunities || 0) + ' published opportunities, ' + Number(item.providers || 0) + ' service providers, ' + Number(item.publicProfiles || 0) + ' public profiles. Select to explore this country.';
      pin.setAttribute('aria-label',pin.title);
    });
    const host = $('soCountryMapLegend');
    if (!host) return;
    const rows = (data?.countries || []).filter(item => Number(item.opportunities || 0) + Number(item.providers || 0) + Number(item.publicProfiles || 0) > 0)
      .sort((a,b) => (Number(b.opportunities||0)+Number(b.providers||0)+Number(b.publicProfiles||0)) - (Number(a.opportunities||0)+Number(a.providers||0)+Number(a.publicProfiles||0)))
      .slice(0,5);
    if (!rows.length) {
      host.innerHTML = '<p class="so-map-empty">No published opportunities or eligible profiles are grouped by country yet. Choose a country above and help the community get started.</p>';
      return;
    }
    host.innerHTML = rows.map(item => {
      const name = esc(item.country || 'Country');
      const count = Number(item.opportunities||0)+Number(item.providers||0)+Number(item.publicProfiles||0);
      return '<button type="button" class="so-map-legend-row" data-so-preset="' + esc(String(item.countryCode||'').trim()) + '"><span class="so-map-legend-country"><b>' + name + '</b><small>' + Number(item.opportunities||0) + ' opportunities · ' + Number(item.providers||0) + ' services</small></span><span class="so-map-legend-count">' + count.toLocaleString() + '</span></button>';
    }).join('');
  }
  async function loadGlobalMapStats() {
    const host = $('soCountryMapLegend');
    try {
      const response = await fetch('/api/public/global-stats', { credentials:'same-origin' });
      if (!response.ok) throw new Error('Country data unavailable');
      renderGlobalMapStats(await response.json());
    } catch (_) {
      if (host) host.innerHTML = '<p class="so-map-empty">Country activity could not be loaded right now. You can still choose a location manually.</p>';
    }
  }
  function countryByName(value) {
    return COUNTRIES.find(item => item.name.toLowerCase() === String(value || '').toLowerCase());
  }
  function countryOptions(selected) {
    const current = selected || location.country;
    return COUNTRIES.map(country => `<option value="${esc(country.name)}" data-country-code="${country.code}" ${country.name === current ? 'selected' : ''}>${esc(country.name)}</option>`).join('');
  }
  function currencyOptions(selected) {
    const current = selected || location.currency;
    return CURRENCIES.map(([code,label]) => `<option value="${code}" ${code === current ? 'selected' : ''}>${label}</option>`).join('');
  }
  function languageOptions(selected) {
    const current = selected || location.language;
    return LANGUAGES.map(([code,label]) => `<option value="${code}" ${code === current ? 'selected' : ''}>${label}</option>`).join('');
  }
  function updateUniversitySuggestions(code = location.countryCode) {
    const list = $('so-university-suggestions');
    if (list) list.innerHTML = (UNIVERSITIES_BY_COUNTRY[code] || []).map(name => '<option value="' + esc(name) + '"></option>').join('');
  }
  function codeForCountry(name) { return countryByName(name)?.code || 'ZZ'; }
  function setCountryDefaults(select, currency, language, hiddenCode) {
    const code = codeForCountry(select.value);
    const currencySelect = currency;
    const languageSelect = language;
    if (hiddenCode) hiddenCode.value = code;
    if (currencySelect) currencySelect.value = CURRENCY_BY_COUNTRY[code] || 'USD';
    if (languageSelect && REGION_LANGUAGE[code]) languageSelect.value = REGION_LANGUAGE[code];
  }
  function locationFieldsMarkup(kind) {
    const idSuffix = kind.replace(/[^a-z0-9]/gi,'');
    return `<fieldset class="studentos-fields" data-studentos-fields="${esc(kind)}"><legend>GLOBAL PROFILE</legend>
      <div class="studentos-field-grid">
        <div class="so-field"><label for="so-${idSuffix}-country">Country / territory</label><select id="so-${idSuffix}-country" name="country" data-so-country required>${countryOptions()}</select><input type="hidden" name="countryCode" data-so-code value="${esc(location.countryCode || codeForCountry(location.country))}"></div>
        <div class="so-field"><label for="so-${idSuffix}-language">Preferred language</label><select id="so-${idSuffix}-language" name="language" data-so-language>${languageOptions()}</select></div>
        <div class="so-field"><label for="so-${idSuffix}-region">Region / state / county</label><input id="so-${idSuffix}-region" name="region" maxlength="100" value="${esc(location.region)}" placeholder="e.g. Nairobi County, California"></div>
        <div class="so-field"><label for="so-${idSuffix}-city">City</label><input id="so-${idSuffix}-city" name="city" maxlength="100" value="${esc(location.city)}" placeholder="e.g. Nairobi, London"></div>
        <div class="so-field"><label for="so-${idSuffix}-university">University / institution</label><input id="so-${idSuffix}-university" name="university" list="so-university-suggestions" maxlength="180" value="${esc(location.university)}" placeholder="Your campus or institution"></div>
        <div class="so-field"><label for="so-${idSuffix}-currency">Preferred supported currency</label><select id="so-${idSuffix}-currency" name="currency" data-so-currency>${currencyOptions()}</select></div>
      </div><p class="studentos-field-note">Choose your own location. University suggestions cover selected institutions only; type any other institution. Automatic location lookup still needs a reverse-geocoding provider.</p>
    </fieldset>`;
  }
  function locationParams(modeOverride) {
    const mode = modeOverride || location.mode;
    const params = {};
    if (mode === 'worldwide') return params;
    if (location.country) params.country = location.country;
    if ((mode === 'city' || mode === 'university') && location.city) params.city = location.city;
    if (mode === 'city' && location.region) params.region = location.region;
    if (mode === 'university' && location.university) params.university = location.university;
    return params;
  }
  function getLocationParams(modeOverride) { return locationParams(modeOverride); }
  function getLocation() { return { ...location }; }
  function syncHomeLocationFilter() {
    const homeSelect = $('heroCounty');
    if (!homeSelect) return;
    const current = location.country || 'Kenya';
    const isKenya = current.toLowerCase() === 'kenya' && location.mode !== 'worldwide';
    if (isKenya) {
      const countySource = $('countyFilter');
      const countyOptions = countySource ? Array.from(countySource.options).slice(1).map(option =>
        '<option value="' + esc(option.value) + '">' + esc(option.textContent) + '</option>'
      ).join('') : '';
      const selected = homeSelect.value;
      homeSelect.innerHTML = '<option value="">All counties in Kenya</option>' + countyOptions;
      homeSelect.value = Array.from(homeSelect.options).some(option => option.value === selected) ? selected : '';
      homeSelect.setAttribute('aria-label', 'Optional county filter for Kenya');
      homeSelect.title = 'Optional Kenyan county filter';
    } else {
      const label = location.mode === 'worldwide' ? 'All locations worldwide' : 'Use selected location';
      homeSelect.innerHTML = '<option value="">' + esc(label) + '</option>';
      homeSelect.value = '';
      homeSelect.setAttribute('aria-label', location.mode === 'worldwide' ? 'Worldwide search location' : 'Use selected global location');
      homeSelect.title = location.mode === 'worldwide' ? 'Search worldwide' : 'Location is set in StudentOS Global';
    }
  }
  function updateLocationInputs() {
    const chip = $('studentosCurrentLocation');
    if (chip) {
      const details = [location.city, location.region, location.country].filter(Boolean);
      chip.textContent = details.join(' · ') || 'Worldwide';
    }
    const countryControl = $('so-global-country');
    const cityControl = $('so-global-city');
    const regionControl = $('so-global-region');
    const universityControl = $('so-global-university');
    const languageControl = $('so-global-language');
    const currencyControl = $('so-global-currency');
    if (countryControl) countryControl.value = location.country;
    if (cityControl) cityControl.value = location.city;
    if (regionControl) regionControl.value = location.region;
    if (universityControl) universityControl.value = location.university;
    if (languageControl) languageControl.value = location.language;
    if (currencyControl) currencyControl.value = location.currency;
    document.querySelectorAll('[data-so-mode]').forEach(btn => btn.setAttribute('aria-pressed',String(btn.dataset.soMode === location.mode)));
    syncHomeLocationFilter();
    updateUniversitySuggestions(location.countryCode);
    document.querySelectorAll('[data-so-country]').forEach(select => {
      if (select.value !== location.country && countryByName(location.country)) select.value = location.country;
      const hidden = select.form?.querySelector('[data-so-code]');
      if (hidden) hidden.value = codeForCountry(select.value);
      const currency = select.form?.querySelector('[data-so-currency]');
      const language = select.form?.querySelector('[data-so-language]');
      if (currency && location.currency) currency.value = location.currency;
      if (language && location.language) language.value = location.language;
    });
  }
  function globalMarkup() {
    return `
    <section id="studentosGlobal" class="studentos-global studentos-page-hidden shell" aria-labelledby="soGlobalTitle">
      <div class="so-global-hero">
        <div class="so-global-top">
          <div class="so-global-copy">
            <div class="so-section-kicker">StudentOS · global explorer</div>
            <h2 id="soGlobalTitle">Your campus is local.<br><span class="heading-gradient">Your possibilities aren't.</span></h2>
            <p>Set a location to explore published accommodation, work, businesses, services and student opportunities. Switch to Worldwide to browse the whole available directory. The globe is a visual guide; it does not show live users or an active-user heatmap.</p>
            <div class="so-global-tags"><span class="so-global-tag">🌍 Country-aware search</span><span class="so-global-tag">🎓 Study abroad</span><span class="so-global-tag">💼 International careers</span><span class="so-global-tag">🗣️ Language exchange</span></div>
          </div>
          <div class="so-globe-stage" aria-label="Animated globe illustration"><div class="so-globe"></div><div class="so-globe-ring"></div><span class="so-globe-label">One connected world</span></div>
        </div>
      </div>
      <section class="so-world-map-panel so-glass-panel" aria-labelledby="soMapTitle">
        <div class="so-world-map-heading"><div><div class="so-section-kicker">01 / Explore the world</div><h3 id="soMapTitle" class="so-panel-title">A global window into opportunity</h3><p class="so-panel-help">Choose a country marker to set your region. The counts below come from published opportunities, eligible service profiles and opted-in public profiles—not estimated user activity.</p></div><span class="so-status-badge"><span class="chip-pulse"></span> Database-backed</span></div>
        <div class="so-world-map-layout">
          <div class="so-world-map" role="group" aria-label="Stylized interactive world map. Select a country marker to change your discovery country.">
            <svg viewBox="0 0 720 360" role="img" aria-label="Illustrated world continents" preserveAspectRatio="xMidYMid meet">
              <defs><linearGradient id="soMapLand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa" stop-opacity=".58"/><stop offset="1" stop-color="#8b5cf6" stop-opacity=".25"/></linearGradient><pattern id="soMapGrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#94a3b8" stroke-opacity=".13" stroke-width="1"/></pattern></defs>
              <rect width="720" height="360" fill="url(#soMapGrid)"/>
              <g fill="url(#soMapLand)" stroke="#67e8f9" stroke-opacity=".36" stroke-width="1.4" stroke-linejoin="round">
                <path d="M45 74L59 54 83 46 97 30 127 35 145 49 171 54 192 76 184 94 169 101 160 119 143 124 131 145 116 157 102 151 95 132 78 123 67 105 53 98Z"/>
                <path d="M151 153L169 151 185 167 194 190 210 205 219 229 211 251 201 276 188 302 177 283 170 260 160 239 157 219 144 199 143 179Z"/>
                <path d="M298 76L314 62 329 68 340 82 330 96 315 94 306 87Z"/>
                <path d="M319 107L339 100 359 113 369 137 358 160 353 181 337 200 327 185 316 161 309 135Z"/>
                <path d="M350 72L371 61 391 64 405 73 421 66 440 72 454 67 477 77 500 73 523 81 546 76 561 90 589 91 609 108 603 122 582 130 564 118 542 124 525 143 503 143 487 155 467 147 452 135 434 137 421 119 400 119 386 105 367 101Z"/>
                <path d="M377 148L396 139 415 151 424 174 419 199 410 225 397 247 386 237 378 215 365 190 365 168Z"/>
                <path d="M555 207L579 201 600 213 619 219 642 236 633 253 616 259 600 250 580 248 569 233Z"/>
                <path d="M666 139L677 134 685 145 681 159 671 159Z"/>
              </g>
              <path d="M12 180H708M360 10V350" stroke="#67e8f9" stroke-opacity=".12" stroke-dasharray="4 8"/>
            </svg>
            <button type="button" class="so-map-pin" data-so-preset="CA" style="--so-pin-x:21%;--so-pin-y:18%" aria-label="Select Canada"><span class="so-map-pin-dot"></span><span>CA</span></button>
            <button type="button" class="so-map-pin" data-so-preset="US" style="--so-pin-x:23%;--so-pin-y:31%" aria-label="Select United States"><span class="so-map-pin-dot"></span><span>US</span></button>
            <button type="button" class="so-map-pin" data-so-preset="BR" style="--so-pin-x:36%;--so-pin-y:60%" aria-label="Select Brazil"><span class="so-map-pin-dot"></span><span>BR</span></button>
            <button type="button" class="so-map-pin" data-so-preset="GB" style="--so-pin-x:49.5%;--so-pin-y:23%" aria-label="Select United Kingdom"><span class="so-map-pin-dot"></span><span>UK</span></button>
            <button type="button" class="so-map-pin" data-so-preset="NG" style="--so-pin-x:52%;--so-pin-y:48%" aria-label="Select Nigeria"><span class="so-map-pin-dot"></span><span>NG</span></button>
            <button type="button" class="so-map-pin" data-so-preset="KE" style="--so-pin-x:60.5%;--so-pin-y:54%" aria-label="Select Kenya"><span class="so-map-pin-dot"></span><span>KE</span></button>
            <button type="button" class="so-map-pin" data-so-preset="ZA" style="--so-pin-x:57%;--so-pin-y:72%" aria-label="Select South Africa"><span class="so-map-pin-dot"></span><span>ZA</span></button>
            <button type="button" class="so-map-pin" data-so-preset="IN" style="--so-pin-x:71.8%;--so-pin-y:41%" aria-label="Select India"><span class="so-map-pin-dot"></span><span>IN</span></button>
            <button type="button" class="so-map-pin" data-so-preset="CN" style="--so-pin-x:76%;--so-pin-y:33%" aria-label="Select China"><span class="so-map-pin-dot"></span><span>CN</span></button>
            <button type="button" class="so-map-pin" data-so-preset="AU" style="--so-pin-x:87%;--so-pin-y:70%" aria-label="Select Australia"><span class="so-map-pin-dot"></span><span>AU</span></button>
          </div>
          <div class="so-world-map-aside">
            <div class="so-world-metrics">
              <div class="so-world-metric"><b id="soWorldOpportunities">—</b><span>Published opportunities</span></div>
              <div class="so-world-metric"><b id="soWorldProviders">—</b><span>Service providers</span></div>
              <div class="so-world-metric"><b id="soWorldProfiles">—</b><span>Opt-in public profiles</span></div>
              <div class="so-world-metric"><b id="soWorldCountries">—</b><span>Countries with records</span></div>
              <div class="so-world-metric"><b id="soWorldUniversities">—</b><span>Universities on public profiles</span></div>
              <div class="so-world-metric"><b id="soWorldEvents">—</b><span>Published events</span></div>
              <div class="so-world-metric"><b id="soWorldMedia">—</b><span>Media & creator listings</span></div>
            </div>
            <div class="so-world-map-legend"><div class="so-world-map-legend-title">Places with shared content</div><div id="soCountryMapLegend" aria-live="polite"><p class="so-map-empty">Loading country aggregates…</p></div></div>
            <p class="so-location-note">Map markers are quick country selectors, not a live location tracker. Choose from the full country list for other locations; no precise coordinates or private profiles are exposed here.</p>
          </div>
        </div>
      </section>
      <div class="so-global-layout">
        <section class="so-glass-panel">
          <div class="so-section-kicker">01 / Your location</div><h3 class="so-panel-title">Make it yours</h3><p class="so-panel-help">Country, city and university filters apply to listings and professional profiles that have matching location data. Location preferences stay on this device until you save them to your account.</p>
          <div class="so-location-grid">
            <div class="so-field"><label for="so-global-country">Country / territory</label><select id="so-global-country" data-so-main-country>${countryOptions()}</select></div>
            <div class="so-field"><label for="so-global-region">Region / state / county</label><input id="so-global-region" maxlength="100" value="${esc(location.region)}" placeholder="Nairobi County, Texas…"></div>
            <div class="so-field"><label for="so-global-city">City</label><input id="so-global-city" maxlength="100" value="${esc(location.city)}" placeholder="Nairobi, London, Toronto…"></div>
            <div class="so-field"><label for="so-global-university">University / institution</label><input id="so-global-university" list="so-university-suggestions" maxlength="180" value="${esc(location.university)}" placeholder="Start typing your institution"><datalist id="so-university-suggestions"></datalist></div>
            <div class="so-field"><label for="so-global-language">Preferred language</label><select id="so-global-language">${languageOptions()}</select></div>
            <div class="so-field"><label for="so-global-currency">Currency for new listings</label><select id="so-global-currency">${currencyOptions()}</select></div>
          </div>
          <div class="so-mode-label">DISCOVERY MODE</div>
          <div class="so-mode-row" role="group" aria-label="Global discovery mode">
            <button type="button" class="so-mode-btn" data-so-mode="country" aria-pressed="true">My country</button>
            <button type="button" class="so-mode-btn" data-so-mode="city" aria-pressed="false">My city</button>
            <button type="button" class="so-mode-btn" data-so-mode="university" aria-pressed="false">My university</button>
            <button type="button" class="so-mode-btn" data-so-mode="worldwide" aria-pressed="false">Worldwide</button>
          </div>
          <div class="so-save-row"><button class="btn primary" type="button" data-so-action="save-location">Save location</button><button class="btn outline" type="button" data-so-action="use-location">Use device location</button></div>
          <div class="so-location-note" id="soLocationNote" aria-live="polite">Manual location is available. Device location requires permission and will not be reverse-geocoded without a location provider.</div>
        </section>
        <aside>
          <section class="so-glass-panel">
            <div class="so-section-kicker">02 / Go international</div><h3 class="so-panel-title">Global opportunities</h3><p class="so-panel-help">Publish and discover opportunities in these new hubs. Information is supplied by members; the platform does not verify visa requirements or scholarship eligibility automatically.</p>
            <div class="so-global-links">
              <button type="button" class="so-global-link" data-so-type="scholarship"><span class="so-link-icon">🎓</span><span><b>Scholarships</b><small>Funding & grants</small></span></button>
              <button type="button" class="so-global-link" data-so-type="study_abroad"><span class="so-link-icon">🌍</span><span><b>Study abroad</b><small>Exchange & programmes</small></span></button>
              <button type="button" class="so-global-link" data-so-type="internship"><span class="so-link-icon">↗</span><span><b>International jobs</b><small>Internships & graduate roles</small></span></button>
              <button type="button" class="so-global-link" data-so-type="language_exchange"><span class="so-link-icon">🗣️</span><span><b>Language exchange</b><small>Practice together</small></span></button>
              <button type="button" class="so-global-link" data-so-type="club"><span class="so-link-icon">◎</span><span><b>Student clubs</b><small>Join a community</small></span></button>
              <button type="button" class="so-global-link" data-so-type="student_discount"><span class="so-link-icon">✦</span><span><b>Student discounts</b><small>Member-posted offers</small></span></button>
              <button type="button" class="so-global-link" data-so-page="community"><span class="so-link-icon">🤝</span><span><b>Student Match & networking</b><small>Study partners, mentors & public profiles</small></span></button>
            </div>
            <div class="so-location-pills"><button class="so-location-pill" data-so-preset="KE">🇰🇪 Kenya</button><button class="so-location-pill" data-so-preset="US">🇺🇸 United States</button><button class="so-location-pill" data-so-preset="GB">🇬🇧 United Kingdom</button><button class="so-location-pill" data-so-preset="ZA">🇿🇦 South Africa</button><button class="so-location-pill" data-so-preset="IN">🇮🇳 India</button><button class="so-location-pill" data-so-preset="CA">🇨🇦 Canada</button></div>
            <p class="so-location-note">Multi-currency records are labelled with their own currency. Automatic exchange-rate conversion is not enabled.</p>
          </section>
        </aside>
      </div>
    </section>`;
  }
  function launchpadMarkup() {
    return `
    <section id="studentosLaunchpad" class="studentos-launchpad shell" aria-label="StudentOS app launcher">
      <div class="so-section-kicker" data-so-i18n="launchKicker">YOUR EVERYDAY ECOSYSTEM</div>
      <h2 class="so-title" data-so-i18n="launchTitle">One home. Your whole world.</h2>
      <p class="so-lede" data-so-i18n="launchLede">Choose a destination and focus on one task at a time. The rest of StudentOS stays out of your way.</p>
      <div class="so-launch-grid">
        <button class="so-launch-card" type="button" data-so-page="explore"><span class="so-launch-icon">⌕</span><b data-so-i18n="navExplore">Explore</b><small>Jobs, housing, scholarships & listings</small></button>
        <button class="so-launch-card" type="button" data-so-page="global"><span class="so-launch-icon">🌍</span><b data-so-i18n="navGlobal">Global</b><small>World search, universities & study abroad</small></button>
        <button class="so-launch-card" type="button" data-so-page="community"><span class="so-launch-icon">◎</span><b data-so-i18n="tileCampus">Campus & community</b><small>People, clubs, events & campus posts</small></button>
        <button class="so-launch-card" type="button" data-so-page="services"><span class="so-launch-icon">⚒</span><b data-so-i18n="navServices">Services</b><small>Skilled professionals & local help</small></button>
        <button class="so-launch-card" type="button" data-so-page="media"><span class="so-launch-icon">▶️</span><b data-so-i18n="navMedia">Media</b><small>Videos, music, podcasts & creators</small></button>
        <button class="so-launch-card" type="button" data-so-page="account"><span class="so-launch-icon">◉</span><b data-so-i18n="tileMySpace">My space</b><small>Profile, applications & saved items</small></button>
      </div>
      <div class="so-assistant-strip">
        <span class="so-assistant-orb" aria-hidden="true">✦</span>
        <div class="so-assistant-copy"><b data-so-i18n="assistantTitle">Need a helpful next step?</b><span data-so-i18n="assistantBody">Ask StudentOS for a practical plan for study, work, housing or career goals.</span></div>
        <button class="btn outline" type="button" data-so-action="assistant" data-so-i18n="assistantButton">Ask StudentOS ↗</button>
      </div>
      <div class="so-loc-strip"><span class="so-loc-orb">⌖</span><div class="so-loc-copy"><b data-so-i18n="locationTitle">Your discovery region</b><span id="studentosCurrentLocation">${esc([location.city,location.region,location.country].filter(Boolean).join(' · ')||'Worldwide')}</span></div><button class="so-loc-button" type="button" data-so-page="global" data-so-i18n="locationEdit">Edit location ↗</button></div>
      <p class="so-translation-note">Navigation and key app-shell labels adapt to your preferred language. Listing text and many remaining descriptions stay in the language provided by their authors.</p>
    </section>`;
  }
  function entertainmentMarkup() {
    const cards = [
      ['CampusTV & videos','▶️','Videos shared by student creators','media_video'],
      ['Music & artists','🎵','Original tracks and artist pages','music'],
      ['Podcasts','🎙️','Student, campus and learning podcasts','podcast'],
      ['Student Originals','🎬','Films, documentaries and comedy','student_original'],
      ['Creator directory','✨','Portfolio links and creator profiles','creator']
    ];
    const cardsHtml=cards.map(item=>'<button class="so-media-card" type="button" data-so-type="'+item[3]+'"><span class="so-media-icon">'+item[1]+'</span><span><b>'+item[0]+'</b><small>'+item[2]+'</small></span><span class="so-media-arrow">↗</span></button>').join('');
    return '<section id="studentosEntertainment" class="studentos-entertainment studentos-page-hidden shell" aria-labelledby="soMediaTitle">'+
      '<div class="so-media-hero"><div class="so-section-kicker">StudentOS · Media & creators</div>'+
      '<h2 id="soMediaTitle">Made on campus.<br><span class="heading-gradient">Shared with the world.</span></h2>'+
      '<p>Discover creator pages, video links, music, podcasts and student originals shared by members. This release links to creator-hosted media; native uploads, HD streaming, playlists, livestreams, ad revenue and creator payouts are not enabled.</p>'+
      '<div class="so-media-note"><span>◉</span><span><b>Respect creators.</b> Share original work or content you have permission to post. External links open on their provider site.</span></div></div>'+
      '<div class="so-media-grid">'+cardsHtml+'</div>'+
      '<div class="so-media-actions"><div><h3>Share your work</h3><p>Publish a link to a video, song, podcast, film or creator portfolio that you own or have permission to share.</p></div><button class="btn primary" type="button" data-so-action="publish-media">＋ Share creator content</button></div>'+
      '<div class="so-media-disclaimer">Media listings are public community posts. StudentOS does not host the media file, guarantee external availability, or provide copyright clearance, livestream controls or creator earnings in this version.</div></section>';
  }
  function openMediaType(type) {
    openPage('media');
    if (typeof window.chooseHub === 'function') window.chooseHub(type);
    setTimeout(() => $('hubs')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }
  function updateCountryAndCurrency(code, selectedCountry) {
    const country = selectedCountry || COUNTRIES.find(item => item.code === code)?.name || 'Kenya';
    location.country = country;
    location.countryCode = code || codeForCountry(country);
    location.currency = CURRENCY_BY_COUNTRY[location.countryCode] || 'USD';
    if (REGION_LANGUAGE[location.countryCode]) location.language = REGION_LANGUAGE[location.countryCode];
    persistLocation();
    updateLocationInputs();
    applyLanguage();
  }
  function applyMode(mode) {
    location.mode = ['country','city','university','worldwide'].includes(mode) ? mode : 'country';
    location.savedByUser = true;
    persistLocation();
    updateLocationInputs();
    applyLanguage();
    const note = $('soLocationNote');
    if (note) note.textContent = location.mode === 'worldwide' ? 'Worldwide mode: country, city and university filters are cleared for discovery.' : 'Mode set to ' + ({country:'My country',city:'My city',university:'My university'}[location.mode]) + '. Save location to refresh discovery.';
  }
  async function saveLocation() {
    location.country = $('so-global-country')?.value || location.country;
    location.countryCode = codeForCountry(location.country);
    location.region = $('so-global-region')?.value.trim() || '';
    location.city = $('so-global-city')?.value.trim() || '';
    location.university = $('so-global-university')?.value.trim() || '';
    location.language = $('so-global-language')?.value || location.language;
    location.currency = $('so-global-currency')?.value || location.currency;
    location.savedByUser = true;
    persistLocation();
    updateLocationInputs();
    const note = $('soLocationNote');
    let accountSaved = false;
    try {
      const currentResponse = await fetch('/api/platform-profile', { credentials:'same-origin' });
      if (currentResponse.ok) {
        const current = await currentResponse.json();
        const p = current.profile || {};
        const payload = {
          persona:p.persona || 'customer', headline:p.headline || '', campus:p.campus || '',
          course:p.course || '', studyLevel:p.study_level || '', graduationYear:p.graduation_year || null,
          bio:p.bio || '', skills:Array.isArray(p.skills)?p.skills:[], organisation:p.organisation || '',
          portfolioUrl:p.portfolio_url || '', publicDirectory:p.public_directory===true,
          country:location.country,countryCode:location.countryCode,region:location.region,city:location.city,
          university:location.university,language:location.language,currency:location.currency
        };
        const saveResponse = await fetch('/api/platform-profile', {
          method:'PATCH', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
        });
        accountSaved = saveResponse.ok;
      }
    } catch (_) { /* Keep the selected location usable locally if account saving fails. */ }
    if (location.mode==='worldwide') {
      if ($('hubCounty')) $('hubCounty').value='';
      if ($('countyFilter')) $('countyFilter').value='';
      if ($('heroCounty')) $('heroCounty').value='';
    }
    if (note) note.textContent = accountSaved
      ? 'Location saved on this device and to your StudentOS profile. Refreshing discovery…'
      : 'Location saved on this device. Sign in to save it to your StudentOS profile.';
    refreshContent();
    if (window.toast) window.toast(accountSaved?'StudentOS location saved to your profile.':'StudentOS location saved on this device.');
  }
  function refreshContent() {
    try { window.CampusHubDiscovery?.refresh?.(); } catch (_) {}
    try { if (typeof window.loadHubListings === 'function') window.loadHubListings(); } catch (_) {}
    try { if (typeof window.loadFundis === 'function') window.loadFundis(); } catch (_) {}
    try { if (typeof window.loadMembers === 'function') window.loadMembers(); } catch (_) {}
  }
  function openPage(page) {
    if (page === 'account') {
      document.body.dataset.studentosView = 'account';
      document.querySelectorAll('[data-so-page]').forEach(button => button.setAttribute('aria-current',String(button.dataset.soPage === 'account' ? 'page' : 'false')));
      document.querySelectorAll('.studentos-nav-btn').forEach(button => button.setAttribute('aria-current',String(button.dataset.soPage === 'account' ? 'page' : 'false')));
      if (typeof window.showDashboard === 'function') window.showDashboard();
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(pageContent,page)) page='home';
    document.body.dataset.studentosView = page;
    document.body.classList.toggle('studentos-content-view',page!=='home');
    const show = new Set(pageContent[page] || []);
    const listingTypeInput = $('hubType');
    if (listingTypeInput && typeof window.chooseHub === 'function') {
      const desiredType = page === 'community' ? 'community' : '';
      if (listingTypeInput.value !== desiredType) window.chooseHub(desiredType);
    }
    for (const id of sectionIds) {
      const node = $(id);
      if (!node) continue;
      node.classList.toggle('studentos-page-hidden',!show.has(id));
    }
    $('studentosGlobal')?.classList.toggle('studentos-page-hidden',page!=='global');
    $('studentosEntertainment')?.classList.toggle('studentos-page-hidden',page!=='media');
    $('studentosLaunchpad')?.classList.toggle('studentos-page-hidden',page!=='home');
    $('campusDiscovery')?.classList.toggle('studentos-page-hidden',page!=='explore');
    $('dashboard')?.classList.remove('show');
    $('publicMain')?.classList.remove('hidden');
    document.querySelector('.hero')?.classList.remove('hidden');
    document.querySelector('.stats')?.classList.remove('hidden');
    document.querySelectorAll('[data-so-page]').forEach(button => {
      const active=button.dataset.soPage===page || (button.dataset.soPage==='account' && page==='account');
      button.setAttribute('aria-current',active?'page':'false');
    });
    document.querySelectorAll('.studentos-nav-btn').forEach(button=>button.setAttribute('aria-current',button.dataset.soPage===page?'page':'false'));
    if (page==='global') loadGlobalMapStats();
    if (page==='explore' || page==='global' || page==='community' || page==='studentlife' || page==='media') {
      if (typeof window.renderHubTiles==='function') window.renderHubTiles();
      if (typeof window.loadHubListings==='function') window.loadHubListings();
      if (page==='community' && typeof window.loadMembers==='function') window.loadMembers();
    }
    if (page==='services' && typeof window.loadFundis==='function') window.loadFundis();
    window.scrollTo({top:0,behavior:'smooth'});
    persistLocation();
  }
  function openGlobalType(type) {
    openPage('global');
    if (typeof window.chooseHub === 'function') {
      window.chooseHub(type);
    }
    setTimeout(() => $('hubs')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }
  function presetCountry(code) {
    const item=COUNTRIES.find(value=>value.code===code);
    if (!item) return;
    location.country=item.name;location.countryCode=item.code;location.savedByUser=true;
    location.currency=CURRENCY_BY_COUNTRY[code]||'USD';
    location.language=REGION_LANGUAGE[code]||'en';location.mode='country';
    location.region='';location.city='';location.university='';
    persistLocation();updateLocationInputs();applyLanguage();
    if ($('soLocationNote')) $('soLocationNote').textContent='Selected '+item.name+'. Press Save location to refresh current records.';
  }
  async function useDeviceLocation() {
    const note=$('soLocationNote');
    if (!navigator.geolocation) { if(note)note.textContent='This browser does not provide location access. Select a country manually.'; return; }
    if(note)note.textContent='Requesting one-time location permission…';
    navigator.geolocation.getCurrentPosition(
      position => {
        if(note)note.textContent='Coordinates received. A reverse-geocoding provider is not configured, so no country or city has been guessed. Select your place manually.';
        try { sessionStorage.setItem('studentos.coordinates-consented',JSON.stringify({lat:Number(position.coords.latitude.toFixed(3)),lon:Number(position.coords.longitude.toFixed(3)),accuracy:Math.round(position.coords.accuracy)})); } catch (_) {}
      },
      () => { if(note)note.textContent='Location access was unavailable or declined. Nothing was saved; you can select your location manually.'; },
      { enableHighAccuracy:false, timeout:8000, maximumAge:300000 }
    );
  }
  function bindLocationFields(form) {
    if (!form || form.dataset.studentosBound === 'true') return;
    form.dataset.studentosBound='true';
    const applyProviderLocationRequirements = () => {
      const shouldRequire = form.id === 'profileForm' ||
        (form.id === 'registerForm' && form.querySelector('[name="persona"]')?.value === 'worker');
      const group = form.querySelector('[data-studentos-fields]');
      for (const name of ['region','city']) {
        const input = group?.querySelector('[name="' + name + '"]');
        if (input) input.required = Boolean(shouldRequire);
      }
    };
    form.querySelector('[name="persona"]')?.addEventListener('change',applyProviderLocationRequirements);
    form.querySelectorAll('[data-so-country]').forEach(select=>{
      const currency=form.querySelector('[data-so-currency]');
      const language=form.querySelector('[data-so-language]');
      const hidden=form.querySelector('[data-so-code]');
      select.addEventListener('change',()=>{
        setCountryDefaults(select,currency,language,hidden);
        updateUniversitySuggestions(codeForCountry(select.value));
        // Preserve current region/city fields. The location chooser updates its own settings separately.
      });
      if (hidden) hidden.value=codeForCountry(select.value);
    });
    const county = form.querySelector('select[name="county"]');
    if (county) {
      const input=document.createElement('input');
      input.name='county';input.id=county.id;input.value=county.value;input.maxLength=100;
      input.placeholder='Region / state / county';input.setAttribute('aria-label','Region / state / county');
      county.replaceWith(input);
    }
    const town = form.querySelector('input[name="town"]');
    if (town && ['hubCreateForm','profileForm','registerForm'].includes(form.id)) {
      const row=town.closest('.formgrid');
      if (row) row.classList.add('studentos-hide-legacy-location');
      // Hidden legacy fields remain in FormData for backward compatibility, but should not block native form validation.
      town.required=false;
      const legacyCounty=form.querySelector('[name="county"]');
      if (legacyCounty) legacyCounty.required=false;
      const group=form.querySelector('[data-studentos-fields]');
      const regionInput=group?.querySelector('[name="region"]');
      const cityInput=group?.querySelector('[name="city"]');
      if (regionInput && !regionInput.value && legacyCounty?.value) regionInput.value=legacyCounty.value;
      if (cityInput && !cityInput.value && town.value) cityInput.value=town.value;
    }
    if (['registerForm','platformProfileForm'].includes(form.id)) {
      const legacyCampus=form.querySelector('input[name="campus"]')?.closest('.field');
      if (legacyCampus) legacyCampus.classList.add('studentos-hide-legacy-location');
    }
    applyProviderLocationRequirements();
    const countryBox = form.querySelector('[data-studentos-fields]');
    if (countryBox) {
      const mainCountry=form.querySelector('[data-so-country]');
      const hiddenCode=form.querySelector('[data-so-code]');
      if (mainCountry && hiddenCode) hiddenCode.value=codeForCountry(mainCountry.value);
    }
  }
  function attachFormFields(form) {
    if (!form || form.dataset.studentosAttached==='true') return;
    if (form.id==='registerForm') {
      form.insertAdjacentHTML('afterbegin',locationFieldsMarkup('register'));
      form.dataset.studentosAttached='true';
      bindLocationFields(form);
    } else if (form.id==='hubCreateForm') {
      form.insertAdjacentHTML('afterbegin',locationFieldsMarkup('listing'));
      // A listing's region and city are collected by the global profile field group.
      form.querySelector('.studentos-fields').querySelector('[name=country]').required=true;
      form.dataset.studentosAttached='true';
      bindLocationFields(form);
      const typeSelect=form.querySelector('#newHubType');
      if(typeSelect) typeSelect.insertAdjacentHTML('beforebegin','<div class="so-field"><label>International opportunity type</label><div class="studentos-field-note">Use Scholarships, Study abroad, Language exchange, Clubs, Lost & found or Student discounts when they fit your post.</div></div>');
      if(typeSelect) {
        const mediaField=document.createElement('div');
        mediaField.className='field so-media-url-field';
        mediaField.innerHTML='<label for="so-media-url">Public content link (optional)</label><input id="so-media-url" name="mediaUrl" type="url" maxlength="800" placeholder="https://your-video-or-audio-page.example"><span class="help">For creator/media listings only. This links to content; it does not upload a file.</span>';
        const titleField=form.querySelector('input[name="title"]')?.closest('.field');
        if(titleField)titleField.insertAdjacentElement('afterend',mediaField);else typeSelect.closest('.field')?.insertAdjacentElement('afterend',mediaField);
        const refreshMedia=()=>{const isMedia=['media_video','music','podcast','student_original','creator'].includes(typeSelect.value);mediaField.classList.toggle('hidden',!isMedia);};
        typeSelect.addEventListener('change',refreshMedia);refreshMedia();
      }
    } else if (form.id==='platformProfileForm') {
      form.insertAdjacentHTML('afterbegin',locationFieldsMarkup('profile'));
      form.dataset.studentosAttached='true';
      bindLocationFields(form);
    } else if (form.id==='profileForm') {
      form.insertAdjacentHTML('afterbegin',locationFieldsMarkup('fundi'));
      form.dataset.studentosAttached='true';
      bindLocationFields(form);
    }
  }
  function scanForms(root) {
    if (!root) return;
    if (root.matches?.('form')) attachFormFields(root);
    root.querySelectorAll?.('#registerForm,#hubCreateForm,#platformProfileForm,#profileForm').forEach(attachFormFields);
  }
  function bind() {
    document.addEventListener('click',event=>{
      const element=event.target.closest('button');
      if(!element)return;
      if(element.dataset.soPage){openPage(element.dataset.soPage);return;}
      if(element.dataset.soMode){applyMode(element.dataset.soMode);return;}
      if(element.dataset.soAction==='save-location'){saveLocation();return;}
      if(element.dataset.soAction==='use-location'){useDeviceLocation();return;}
      if(element.dataset.soPreset){presetCountry(element.dataset.soPreset);return;}
      if(element.dataset.soType){
        const mediaTypes=['media_video','music','podcast','student_original','creator'];
        if(mediaTypes.includes(element.dataset.soType))openMediaType(element.dataset.soType);else openGlobalType(element.dataset.soType);
        return;
      }
      if(element.dataset.soAction==='publish-media'){
        openPage('media');
        if(typeof window.openCreateListing==='function')window.openCreateListing('media_video');
        return;
      }
      if(element.dataset.soAction==='assistant'){
        if(typeof window.openCareerGuide==='function')window.openCareerGuide();
        return;
      }
    });
    document.addEventListener('change',event=>{
      if(event.target.matches('[data-so-main-country]')) {
        const code=codeForCountry(event.target.value);
        updateCountryAndCurrency(code,event.target.value);
        if($('soLocationNote'))$('soLocationNote').textContent='Country changed. Review city, university and language, then save location.';
      }
      if(event.target.id==='so-global-language') {
        location.language=event.target.value;
        persistLocation();
        applyLanguage();
      }
    });
    const observer=new MutationObserver(records=>{
      for(const record of records) for(const node of record.addedNodes) if(node.nodeType===1) scanForms(node);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    scanForms(document);
  }
  function registerFieldsMarkup() { return locationFieldsMarkup('register'); }

  function init() {
    const ecosystem=$('ecosystem');
    if(!ecosystem)return;
    if(!COUNTRIES.some(item=>item.code===location.countryCode))location.countryCode=codeForCountry(location.country);
    ecosystem.insertAdjacentHTML('beforebegin',globalMarkup());
    ecosystem.insertAdjacentHTML('beforebegin',entertainmentMarkup());
    ecosystem.insertAdjacentHTML('beforebegin',launchpadMarkup());
    // Launchpad needs to follow the discovery section and precede the hidden module views.
    const launcher=$('studentosLaunchpad');
    if(launcher && $('campusDiscovery')) $('campusDiscovery').insertAdjacentElement('afterend',launcher);
    // Consolidate top navigation around app areas rather than long scrolling sections.
    const nav=document.querySelector('.navlinks');
    if(nav)nav.innerHTML=[
      ['home','Home'],['explore','Explore'],['global','Global'],['services','Services'],['community','Community'],['media','Media']
    ].map(([page,label])=>`<button type="button" class="studentos-nav-btn" data-so-page="${page}" data-so-i18n="nav${page.charAt(0).toUpperCase()+page.slice(1)}" aria-current="${page==='home'?'page':'false'}">${label}</button>`).join('');
    // Replace the legacy brand wording in the shell/footer while keeping CampusHub as the product alias.
    const brand=document.querySelector('.campus-brand');
    if(brand){brand.setAttribute('aria-label','StudentOS by CampusHub home');brand.innerHTML='<span class="brandmark">S<span>O</span></span><span class="brand-word">Student<span>OS</span></span><span class="brand-caption">CAMPUSHUB · GLOBAL STUDENT LIFE</span>';}
    const footerBrand=document.querySelector('.footer .brand');
    if(footerBrand)footerBrand.innerHTML='<span class="brandmark">S<span>O</span></span> StudentOS <small style="font-size:10px;color:#9aaaca">by CampusHub</small>';
    document.title='StudentOS (CampusHub) — Study. Live. Work. Connect. Create. Explore.';
    document.querySelector('meta[name="description"]')?.setAttribute('content','StudentOS (CampusHub) brings student life, accommodation, jobs, services, learning and communities into one organized ecosystem.');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content','StudentOS (CampusHub) — Study. Live. Work. Connect. Create. Explore.');
    location.countryCode=codeForCountry(location.country);
    if(!CURRENCIES.some(([code]) => code === location.currency)) location.currency = CURRENCY_BY_COUNTRY[location.countryCode] || 'USD';
    persistLocation();
    bind();
    updateLocationInputs();
    addMobileNav();
    applyLanguage();
    loadGlobalMapStats();
    openPage('home');
    // Attach global fields to any form rendered during initial dashboard bootstrap.
    scanForms(document);
  }
  function addMobileNav() {
    if ($('studentosMobileNav'))return;
    document.body.insertAdjacentHTML('beforeend',`<nav id="studentosMobileNav" class="so-mobile-nav" aria-label="StudentOS primary navigation">
      <button type="button" data-so-page="home" aria-current="page"><span aria-hidden="true">⌂</span><small data-so-i18n="navHome">Home</small></button>
      <button type="button" data-so-page="explore"><span aria-hidden="true">⌕</span><small data-so-i18n="navExplore">Explore</small></button>
      <button type="button" data-so-page="global"><span aria-hidden="true">🌍</span><small data-so-i18n="navGlobal">Global</small></button>
      <button type="button" data-so-page="services"><span aria-hidden="true">⚒</span><small data-so-i18n="navServices">Services</small></button>
      <button type="button" data-so-page="account"><span aria-hidden="true">◉</span><small data-so-i18n="navAccount">My space</small></button>
    </nav>`);
  }
  window.StudentOS = {
    getLocation,
    getLocationParams,
    syncHomeLocationFilter,
    countryOptions,
    languageOptions,
    currencyOptions,
    codeForCountry,
    countries: COUNTRIES.map(item=>({...item})),
    registerFieldsMarkup,
    openPage,
    saveLocation,
    hydrateFromProfile,
    adoptLocation,
    currencySymbol(code){
      const values={USD:'$',EUR:'€',GBP:'£',CAD:'CA$',AUD:'A$',KES:'KSh',UGX:'USh',TZS:'TSh',NGN:'₦',ZAR:'R',INR:'₹',CNY:'¥',BRL:'R$'};
      return values[code]||code+' ';
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
