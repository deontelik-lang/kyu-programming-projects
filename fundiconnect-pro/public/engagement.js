(function () {
  'use strict';
  if (window.__campushubDiscoveryLoaded) return;
  window.__campushubDiscoveryLoaded = true;

  const STORE = 'campushub.discovery.v1';
  const TODAY = dayKey(new Date());
  const YESTERDAY = dayKey(new Date(Date.now() - 86400000));
  const HUBS = {
    student_gig: ['Student gig', '🎨'], job: ['Job opportunity', '💼'],
    internship: ['Internship', '🎓'], housing: ['Accommodation', '🏡'],
    product: ['Marketplace', '🛍️'], event: ['Campus event', '🎟️'],
    course: ['Learning', '📚'], business: ['Business', '🏪'],
    community: ['Community', '💬'], transport: ['Transport', '🚐'],
    student_service: ['Student service', '🧑‍🎓'], alumni: ['Mentorship', '🤝'],
    service_offer: ['Service offer', '🛠️']
  };
  const FILTERS = [
    ['For you', 'all', '✦'], ['Jobs', 'jobs', '↗'], ['Housing', 'housing', '⌂'],
    ['Events', 'event', '✧'], ['Learning', 'learning', '▤'],
    ['Services', 'services', '⚒'], ['Community', 'community', '◎']
  ];
  let activeFilter = 'all';
  let items = [];
  let providers = [];
  let loaded = false;
  let busy = false;
  let reloadPending = false;
  let model = readModel();

  function dayKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function readModel() {
    const fallback = { xp: 0, streak: 0, lastCheckIn: '', preferences: {}, explored: [], saved: [], liked: [], claimed: [], completed: [] };
    try {
      const value = JSON.parse(localStorage.getItem(STORE) || '{}');
      return { ...fallback, ...value, preferences: value.preferences || {}, explored: Array.isArray(value.explored) ? value.explored : [], saved: Array.isArray(value.saved) ? value.saved : [], liked: Array.isArray(value.liked) ? value.liked : [], claimed: Array.isArray(value.claimed) ? value.claimed : [], completed: Array.isArray(value.completed) ? value.completed : [] };
    } catch (_) { return fallback; }
  }
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(model)); } catch (_) { /* Keep discovery usable if storage is disabled. */ }
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }
  function money(price, currency) {
    if (price === null || price === undefined || price === '') return '';
    const amount = Number(price);
    if (!Number.isFinite(amount)) return '';
    return (currency === 'KSH' || !currency ? 'KSh ' : esc(currency) + ' ') + amount.toLocaleString('en-KE', { maximumFractionDigits: 2 });
  }
  function dateLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }
  function hub(type) { return HUBS[type] || ['Campus opportunity', '✦']; }
  function openToast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else {
      const line = document.querySelector('#dhToastline');
      if (line) line.textContent = message;
    }
  }
  function addXp(points, claimKey, note) {
    if (claimKey && model.claimed.includes(claimKey)) return false;
    if (claimKey) model.claimed.push(claimKey);
    model.xp = Math.max(0, Number(model.xp || 0) + points);
    if (model.claimed.length > 500) model.claimed = model.claimed.slice(-350);
    persist();
    renderProgress();
    if (note) openToast('+' + points + ' XP · ' + note);
    return true;
  }
  function recordInterest(type) {
    if (!type) return;
    model.preferences[type] = Math.min(99, Number(model.preferences[type] || 0) + 1);
    if (!model.explored.includes(type)) model.explored.push(type);
    if (model.explored.length > 40) model.explored = model.explored.slice(-30);
    if (type.startsWith('filter:')) {
      const key = 'filter:' + TODAY + ':' + type.slice(7);
      addXp(0, key, '');
    }
    persist();
  }
  function currentStreak() {
    return model.lastCheckIn === TODAY || model.lastCheckIn === YESTERDAY ? Number(model.streak || 0) : 0;
  }
  function checkIn() {
    if (model.lastCheckIn === TODAY) {
      openToast('You have checked in for today. Come back to your own priorities—no extra check-in needed.');
      return;
    }
    model.streak = model.lastCheckIn === YESTERDAY ? Number(model.streak || 0) + 1 : 1;
    model.lastCheckIn = TODAY;
    addXp(10, 'checkin:' + TODAY, 'daily check-in');
    renderProgress();
  }
  function levelData() {
    const xp = Math.max(0, Number(model.xp || 0));
    const level = Math.floor(xp / 100) + 1;
    const inLevel = xp % 100;
    return { xp, level, inLevel, remaining: 100 - inLevel, progress: inLevel };
  }

  function shellMarkup() {
    return `
      <section class="dh-section" id="campusDiscovery" aria-labelledby="dhTitle">
        <div class="dh-heading-row">
          <div class="dh-heading">
            <div class="dh-topline"><span class="dh-spark">✦</span> THE CAMPUSHUB DISCOVERY</div>
            <h2 id="dhTitle">Find your <span class="heading-gradient">next move.</span></h2>
            <p>Explore current opportunities, meet available professionals, and shape your picks as you go. <strong>Recommendations learn from your clicks on this device</strong>—no connected AI feed is claimed.</p>
          </div>
          <button class="btn outline dh-refresh" type="button" data-dh="refresh">↻ Refresh feed</button>
        </div>
        <div class="dh-layout">
          <div class="dh-glass dh-discovery-panel">
            <div class="dh-tabs" role="group" aria-label="Filter discovery feed">
              ${FILTERS.map(([label, key, icon]) => `<button class="dh-tab" type="button" data-filter="${key}" aria-pressed="${key === activeFilter}">${icon} ${label}</button>`).join('')}
            </div>
            <div class="dh-feed-toolbar">
              <div><div class="dh-feed-title" id="dhFeedTitle">Your discovery feed</div><div class="dh-feed-subtitle" id="dhFeedSubtitle">Real listings · updated when you refresh</div></div>
              <select class="dh-sort" id="dhSort" aria-label="Sort discovery results"><option value="for-you">For you</option><option value="newest">Newest first</option><option value="popular">Most activity</option></select>
            </div>
            <div class="dh-feed" id="dhFeed" aria-live="polite">
              <div class="dh-skeleton"></div><div class="dh-skeleton"></div>
            </div>
            <div class="dh-toastline" id="dhToastline" aria-live="polite"></div>
            <div class="dh-quicklinks" aria-label="Quick ways to explore">
              <a href="#hubs" class="dh-quicklink" data-explore="job">↗ Find work</a>
              <a href="#hubs" class="dh-quicklink" data-explore="housing">⌂ Find a room</a>
              <a href="#services" class="dh-quicklink" data-explore="service_offer">⚒ Find a professional</a>
              <a href="#people" class="dh-quicklink" data-explore="alumni">◎ Meet the network</a>
            </div>
          </div>
          <aside class="dh-sidebar" aria-label="Your progress and people">
            <section class="dh-glass dh-momentum">
              <div class="dh-panel-head"><h3>Your momentum</h3><span class="dh-mini-label">Personal progress</span></div>
              <div class="dh-level-row">
                <div class="dh-level-orb" id="dhLevelOrb" style="--dh-progress:0%"><strong id="dhLevel">1</strong></div>
                <div class="dh-level-copy"><b id="dhLevelName">Campus Explorer</b><span id="dhXpCopy">0 XP earned on this device</span></div>
              </div>
              <div class="dh-xpbar"><span id="dhXpBar" style="--dh-progress:0%"></span></div>
              <div class="dh-progress-caption"><span id="dhXpHere">0 / 100 XP</span><span id="dhXpNext">100 XP to next level</span></div>
              <div class="dh-streak-row">
                <div class="dh-streak-stat"><span>Check-in streak</span><b id="dhStreak">0 <small>days</small></b></div>
                <div class="dh-streak-stat"><span>Hubs explored</span><b id="dhExplored">0</b></div>
              </div>
              <button class="btn primary dh-checkin" type="button" data-dh="checkin">✦ Check in for today · +10 XP</button>
              <p class="dh-checkin-note">Optional, no countdowns or penalties. XP and streaks are stored only in this browser for now, not on your account.</p>
            </section>
            <section class="dh-glass dh-missions">
              <div class="dh-panel-head"><h3>Small wins</h3><span class="dh-mini-label">Your pace</span></div>
              <div class="dh-mission"><span class="dh-mission-icon">⌕</span><div class="dh-mission-copy"><b>Explore one useful hub</b><span>Find one place, opportunity or resource relevant to you.</span></div><span class="dh-mission-state" id="dhExploreMission">＋5 XP</span></div>
              <div class="dh-mission"><span class="dh-mission-icon">♡</span><div class="dh-mission-copy"><b>Keep a useful opportunity</b><span>Save a listing to your account after signing in.</span></div><span class="dh-mission-state" id="dhSaveMission">＋6 XP</span></div>
              <div class="dh-panel-head" style="margin:13px 0 7px"><h3>Milestone badges</h3><span class="dh-mini-label">Unlocked locally</span></div>
              <div class="dh-badges" id="dhBadges"></div>
              <p class="dh-checkin-note">Private interest signals and local rewards are not public likes, creator rankings or transferable points.</p>
            </section>
            <section class="dh-glass dh-provider-panel">
              <div class="dh-panel-head"><h3>Available professionals</h3><button class="dh-provider-open" type="button" data-dh="all-providers">View all ↗</button></div>
              <div id="dhProviders" class="dh-provider-list"><div class="dh-skeleton" style="height:70px"></div></div>
              <p class="dh-side-note">Ratings appear only when real reviews exist. Verification labels are shown only from platform-reviewed records.</p>
            </section>
          </aside>
        </div>
      </section>
    `;
  }

  function getFilteredItems() {
    let list = items.slice();
    const groups = {
      jobs: ['job','internship','student_gig'],
      housing: ['housing'],
      event: ['event'],
      learning: ['course','alumni'],
      services: ['service_offer','student_service','business','transport'],
      community: ['community','product']
    };
    if (groups[activeFilter]) list = list.filter(item => groups[activeFilter].includes(item.hub_type));
    const sort = document.getElementById('dhSort')?.value || 'for-you';
    if (sort === 'newest') list.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    else if (sort === 'popular') list.sort((a,b) => Number(b.action_count || 0) + Number(b.comment_count || 0) - Number(a.action_count || 0) - Number(a.comment_count || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0));
    else list.sort((a,b) => {
      const interest = item => Number(model.preferences[item.hub_type] || 0) * 4 + Number(item.action_count || 0) + (item.is_featured ? 1.5 : 0);
      return interest(b) - interest(a) || new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return list.slice(0, 10);
  }

  function listingCard(item, index) {
    const type = item.hub_type || '';
    const [label, icon] = hub(type);
    const location = [item.city || item.town, item.region || item.county, item.country].filter(Boolean).filter((value,index,array)=>value && array.indexOf(value)===index).join(', ');
    const price = money(item.price, item.currency);
    const saved = item.is_saved === true || model.saved.includes(item.id);
    const liked = model.liked.includes(item.id);
    const activity = Number(item.action_count || 0) + Number(item.comment_count || 0);
    const poster = item.owner_name ? 'by ' + item.owner_name : '';
    const meta = [
      location ? '⌖ ' + esc(location) : '',
      price ? '◆ ' + esc(price) : '',
      item.created_at ? '◷ ' + dateLabel(item.created_at) : '',
      activity > 0 ? '↗ ' + activity + ' interactions' : ''
    ].filter(Boolean).slice(0, 3).map(value => '<span>' + value + '</span>').join('');
    return `
      <article class="dh-card" data-type="${esc(type)}" style="animation-delay:${Math.min(index,5)*45}ms">
        <div class="dh-card-top">
          <span class="dh-type-pill"><span aria-hidden="true">${icon}</span> ${esc(label)}</span>
          <div style="display:flex;gap:5px;align-items:center">
            ${item.is_featured ? '<span class="dh-feature-pill">✦ Featured</span>' : ''}
            <button class="dh-save-mini" type="button" data-save="${esc(item.id)}" aria-label="${saved ? 'Saved listing' : 'Save listing'}" aria-pressed="${saved}">${saved ? '✓' : '＋'}</button>
          </div>
        </div>
        <h3>${esc(item.title || 'CampusHub opportunity')}</h3>
        <p class="dh-card-desc">${esc(item.description || 'Open this listing in CampusHub to review the details.')}</p>
        <div class="dh-meta">${meta || '<span>✦ A CampusHub community listing</span>'}<span> ${esc(poster)}</span></div>
        <div class="dh-card-actions">
          <button class="btn primary" type="button" data-open="${esc(item.id)}" data-type="${esc(type)}">View in hub ↗</button>
          <button class="dh-private-like" type="button" data-like="${esc(item.id)}" aria-label="Use this category to personalise your feed" aria-pressed="${liked}" title="Tune your private recommendations">${liked ? '♥' : '♡'}</button>
        </div>
      </article>
    `;
  }

  function renderFeed() {
    const feed = document.getElementById('dhFeed');
    if (!feed) return;
    const titles = { all:'Your discovery feed', jobs:'Work & opportunity picks', housing:'Places to call home', event:'What is happening', learning:'Learning & mentorship', services:'People who can help', community:'Campus & community' };
    const subtitle = {
      all: model.explored.length ? 'Sorted with your on-device interest signals' : 'Fresh picks from published CampusHub listings',
      jobs: 'Jobs, internships and student gigs from current listings',
      housing: 'Current accommodation listings, when available',
      event: 'Published events from the CampusHub community',
      learning: 'Learning, training and alumni opportunities',
      services: 'Business, service and transport listings',
      community: 'Community spaces and marketplace listings'
    };
    const title = document.getElementById('dhFeedTitle');
    const sub = document.getElementById('dhFeedSubtitle');
    if (title) title.textContent = titles[activeFilter] || titles.all;
    if (sub) sub.textContent = subtitle[activeFilter] || subtitle.all;
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter)));
    const list = getFilteredItems();
    if (!loaded) {
      feed.innerHTML = '<div class="dh-skeleton"></div><div class="dh-skeleton"></div>';
      return;
    }
    if (!list.length) {
      const isEmptyAll = items.length === 0;
      feed.innerHTML = `<div class="dh-empty"><div class="dh-empty-mark">${isEmptyAll ? '✦' : '⌕'}</div><h3>${isEmptyAll ? 'Your first discovery is waiting' : 'Nothing in this lane just yet'}</h3><p>${isEmptyAll ? 'There are no published listings to show yet. Explore a hub, browse real professionals, or help the community get started by posting the first opportunity.' : 'Try another discovery lane, or explore the full opportunities directory.'}</p><button class="btn primary" type="button" data-dh="${isEmptyAll ? 'explore-hubs' : 'show-all'}">${isEmptyAll ? 'Explore all hubs ↗' : 'Show every listing'}</button></div>`;
      return;
    }
    feed.innerHTML = list.map(listingCard).join('');
  }

  function renderProviders() {
    const host = document.getElementById('dhProviders');
    if (!host) return;
    const list = providers.filter(item => item.available !== false).slice(0, 4);
    if (!list.length) {
      host.innerHTML = '<div class="dh-empty" style="padding:17px 10px"><div class="dh-empty-mark">⚒</div><h3>No available profiles yet</h3><p>Professionals appear here after completing their profile and service area.</p><button class="btn outline" type="button" data-dh="all-providers">Browse services</button></div>';
      return;
    }
    host.innerHTML = list.map(person => {
      const letters = String(person.full_name || 'CH').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
      const review = Number(person.review_count || 0) > 0 ? '★ ' + Number(person.rating).toFixed(1) + ' · ' + Number(person.review_count) : 'New profile';
      const location = [person.town, person.county].filter(Boolean).join(', ') || 'Location not added';
      const verified = person.verification_level && person.verification_level !== 'none';
      return `<article class="dh-provider"><div class="dh-provider-avatar">${esc(letters)}</div><div class="dh-provider-copy"><b>${esc(person.full_name)}</b><span>${esc(person.professional_title || person.category_name || 'Skilled professional')} · ${esc(location)}</span><span>${verified ? '✓ Platform-reviewed status' : 'Profile not reviewed'}</span></div><span class="dh-provider-rating">${esc(review)}</span><button class="dh-provider-open" type="button" data-provider="${esc(person.profile_id)}" aria-label="View ${esc(person.full_name)}">↗</button></article>`;
    }).join('');
  }

  function renderProgress() {
    if (!document.getElementById('dhLevel')) return;
    const data = levelData();
    const streak = currentStreak();
    const percent = data.progress + '%';
    document.getElementById('dhLevel').textContent = data.level;
    document.getElementById('dhLevelOrb').style.setProperty('--dh-progress', percent);
    document.getElementById('dhLevelName').textContent = data.level >= 10 ? 'Campus Trailblazer' : data.level >= 5 ? 'Opportunity Builder' : data.level >= 3 ? 'Curious Connector' : 'Campus Explorer';
    document.getElementById('dhXpCopy').textContent = data.xp + ' XP earned on this device';
    document.getElementById('dhXpBar').style.setProperty('--dh-progress', percent);
    document.getElementById('dhXpHere').textContent = data.inLevel + ' / 100 XP';
    document.getElementById('dhXpNext').textContent = data.remaining + ' XP to next level';
    document.getElementById('dhStreak').innerHTML = streak + ' <small>days</small>';
    document.getElementById('dhExplored').textContent = String(model.explored.filter(type => !type.startsWith('filter:')).length);
    const checkin = document.querySelector('[data-dh="checkin"]');
    if (checkin) {
      checkin.disabled = model.lastCheckIn === TODAY;
      checkin.textContent = model.lastCheckIn === TODAY ? '✓ Checked in today' : '✦ Check in for today · +10 XP';
    }
    const badges = [
      ['✦','First spark',data.xp >= 10],
      ['⌕','Curious mind',model.explored.filter(type => !type.startsWith('filter:')).length >= 3],
      ['♡','Opportunity saver',model.saved.length >= 1],
      ['☼','Steady steps',streak >= 3]
    ];
    const host = document.getElementById('dhBadges');
    if (host) host.innerHTML = badges.map(([icon,label,unlocked]) => `<span class="dh-badge ${unlocked ? 'unlocked' : ''}" title="${unlocked ? 'Unlocked on this device' : 'Not unlocked yet'}"><span>${icon}</span> ${label} ${unlocked ? '✓' : '<span class="dh-lock">·</span>'}</span>`).join('');
    const explore = document.getElementById('dhExploreMission');
    if (explore) explore.textContent = model.claimed.includes('explore:' + TODAY) ? '✓ Done' : '+5 XP';
    const save = document.getElementById('dhSaveMission');
    if (save) save.textContent = model.claimed.includes('save:' + TODAY) ? '✓ Done' : '+6 XP';
  }

  async function loadData() {
    if (busy) { reloadPending = true; return; }
    busy = true;
    const feed = document.getElementById('dhFeed');
    if (feed) feed.innerHTML = '<div class="dh-skeleton"></div><div class="dh-skeleton"></div>';
    const loc = window.StudentOS && typeof window.StudentOS.getLocationParams === 'function' ? window.StudentOS.getLocationParams() : {};
    const listingParams = new URLSearchParams({ ...loc, limit: '80' });
    const fundiParams = new URLSearchParams();
    if (loc.country) fundiParams.set('country', loc.country);
    if (loc.city) fundiParams.set('city', loc.city);
    if (loc.region) fundiParams.set('county', loc.region);
    const requests = await Promise.allSettled([
      fetch('/api/hubs/listings?' + listingParams.toString(), { credentials: 'same-origin' }).then(res => { if (!res.ok) throw new Error('Listings unavailable'); return res.json(); }),
      fetch('/api/fundis?' + fundiParams.toString(), { credentials: 'same-origin' }).then(res => { if (!res.ok) throw new Error('Professionals unavailable'); return res.json(); })
    ]);
    if (requests[0].status === 'fulfilled') items = Array.isArray(requests[0].value.listings) ? requests[0].value.listings : [];
    if (requests[1].status === 'fulfilled') providers = Array.isArray(requests[1].value.fundis) ? requests[1].value.fundis : [];
    loaded = requests.some(result => result.status === 'fulfilled');
    busy = false;
    renderFeed();
    renderProviders();
    if (!loaded && feed) feed.innerHTML = '<div class="dh-empty"><div class="dh-empty-mark">↻</div><h3>Could not reach discovery</h3><p>StudentOS could not refresh discovery records just now. Check your connection and try again.</p><button class="btn primary" type="button" data-dh="refresh">Try again</button></div>';
    if (reloadPending) { reloadPending = false; loadData(); }
  }

  function goToHub(type) {
    recordInterest(type);
    const key = 'explore:' + TODAY;
    const first = !model.claimed.includes(key);
    addXp(5, key, first ? 'explore a hub' : '');
    if (typeof window.chooseHub === 'function') window.chooseHub(type);
    else document.getElementById('hubs')?.scrollIntoView({ behavior: 'smooth' });
    renderProgress();
  }

  async function saveListing(id, button) {
    const item = items.find(value => value.id === id);
    if (!item) return;
    if (item.is_saved || model.saved.includes(id)) {
      openToast('This listing is already in your saved items. You can manage saved items from your dashboard.');
      return;
    }
    const authButton = document.getElementById('loginNav');
    if (authButton && !authButton.classList.contains('hidden') && typeof window.openAuth === 'function') {
      window.openAuth('login');
      openToast('Sign in to save this listing to your account.');
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch('/api/hubs/listings/' + encodeURIComponent(id) + '/actions', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not save this listing.');
      item.is_saved = true;
      model.saved = [...new Set([...model.saved, id])].slice(-300);
      recordInterest(item.hub_type);
      addXp(6, 'save:' + TODAY, 'save a useful listing');
      addXp(2, 'saved-item:' + id, '');
      renderFeed();
      renderProgress();
      openToast('Saved to your CampusHub account. +6 XP for today’s small win.');
    } catch (error) {
      openToast(error.message || 'Could not save this listing.');
      button.disabled = false;
    }
  }

  function toggleLike(id) {
    const item = items.find(value => value.id === id);
    if (!item) return;
    const has = model.liked.includes(id);
    model.liked = has ? model.liked.filter(value => value !== id) : [...model.liked, id].slice(-250);
    if (!has) recordInterest(item.hub_type);
    persist();
    renderFeed();
    openToast(has ? 'Preference removed from this device.' : 'Your private picks now lean a little more toward ' + hub(item.hub_type)[0].toLowerCase() + '.');
  }

  function render() {
    renderFeed();
    renderProviders();
    renderProgress();
  }

  function handleClick(event) {
    const button = event.target.closest('button, a');
    if (!button) return;
    const filter = button.dataset.filter;
    if (filter) {
      activeFilter = filter;
      if (filter !== 'all') recordInterest('filter:' + filter);
      renderFeed();
      return;
    }
    if (button.dataset.dh === 'refresh') { loadData(); return; }
    if (button.dataset.dh === 'checkin') { checkIn(); return; }
    if (button.dataset.dh === 'show-all') { activeFilter = 'all'; renderFeed(); return; }
    if (button.dataset.dh === 'explore-hubs') { goToHub('job'); document.getElementById('hubs')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (button.dataset.dh === 'all-providers') { document.getElementById('fundis')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (button.dataset.open) { goToHub(button.dataset.type); document.getElementById('hubListings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (button.dataset.save) { saveListing(button.dataset.save, button); return; }
    if (button.dataset.like) { toggleLike(button.dataset.like); return; }
    if (button.dataset.provider) {
      document.getElementById('fundis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof window.viewFundi === 'function') window.viewFundi(button.dataset.provider);
      return;
    }
    if (button.dataset.explore) { goToHub(button.dataset.explore); return; }
  }

  function init() {
    const ecosystem = document.getElementById('ecosystem');
    if (!ecosystem || document.getElementById('campusDiscovery')) return;
    ecosystem.insertAdjacentHTML('beforebegin', shellMarkup());
    document.addEventListener('click', handleClick);
    document.getElementById('dhSort')?.addEventListener('change', renderFeed);
    render();
    loadData();
  }

  window.CampusHubDiscovery = { refresh: loadData, setFilter(filter) { activeFilter = FILTERS.some(item => item[1] === filter) ? filter : 'all'; renderFeed(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
