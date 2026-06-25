/* -------------------------------------------------------------
   startpage_kb — app.js (refactored)
   ------------------------------------------------------------- */

'use strict';

/* -- Constants ---------------------------------------------- */
const STORAGE_HISTORY = 'skb_history';
const STORAGE_ALIASES = 'skb_aliases';
const WEATHER_CACHE_KEY = 'skb_weather';
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/* -- Built-in aliases  key → { url, search?, nav? }         */
const DEFAULT_ALIASES = {
    yt: {
        url: 'https://www.youtube.com/results?search_query=%s',
        search: true,
        nav: 'https://www.youtube.com'
    },
    youtube: {
        url: 'https://www.youtube.com/results?search_query=%s',
        search: true,
        nav: 'https://www.youtube.com'
    },
    gh: {
        url: 'https://github.com/search?q=%s',
        search: true,
        nav: 'https://github.com'
    },
    github: {
        url: 'https://github.com/search?q=%s',
        search: true,
        nav: 'https://github.com'
    },
    gm: {
        url: 'https://mail.google.com',
        search: false
    },
    gmail: {
        url: 'https://mail.google.com',
        search: false
    },
    gc: {
        url: 'https://calendar.google.com',
        search: false
    },
    gd: {
        url: 'https://drive.google.com',
        search: false
    },
    drive: {
        url: 'https://drive.google.com',
        search: false
    },
    maps: {
        url: 'https://www.google.com/maps/search/%s',
        search: true,
        nav: 'https://maps.google.com'
    },
    tw: {
        url: 'https://twitter.com/search?q=%s',
        search: true,
        nav: 'https://twitter.com'
    },
    twitter: {
        url: 'https://twitter.com/search?q=%s',
        search: true,
        nav: 'https://twitter.com'
    },
    x: {
        url: 'https://x.com/search?q=%s',
        search: true,
        nav: 'https://x.com'
    },
    rd: {
        url: 'https://www.reddit.com/search/?q=%s',
        search: true,
        nav: 'https://www.reddit.com'
    },
    reddit: {
        url: 'https://www.reddit.com/search/?q=%s',
        search: true,
        nav: 'https://www.reddit.com'
    },
    fb: {
        url: 'https://www.facebook.com',
        search: false
    },
    ig: {
        url: 'https://www.instagram.com',
        search: false
    },
    li: {
        url: 'https://www.linkedin.com',
        search: false
    },
    nf: {
        url: 'https://www.netflix.com',
        search: false
    },
    amz: {
        url: 'https://www.amazon.com/s?k=%s',
        search: true,
        nav: 'https://www.amazon.com'
    },
    mdn: {
        url: 'https://developer.mozilla.org/en-US/search?q=%s',
        search: true,
        nav: 'https://developer.mozilla.org'
    },
    npm: {
        url: 'https://www.npmjs.com/search?q=%s',
        search: true,
        nav: 'https://www.npmjs.com'
    },
    ddg: {
        url: 'https://duckduckgo.com/?q=%s',
        search: true,
        nav: 'https://duckduckgo.com'
    },
    wiki: {
        url: 'https://en.wikipedia.org/w/index.php?search=%s',
        search: true,
        nav: 'https://en.wikipedia.org'
    },
};

const FALLBACK_SEARCH = 'https://www.google.com/search?q=%s';
const FALLBACK_NAV = 'https://www.google.com';

/* Timezone city map */
const CITY_TZ = {
    tokyo: 'Asia/Tokyo',
    osaka: 'Asia/Tokyo',
    seoul: 'Asia/Seoul',
    beijing: 'Asia/Shanghai',
    shanghai: 'Asia/Shanghai',
    hongkong: 'Asia/Hong_Kong',
    singapore: 'Asia/Singapore',
    manila: 'Asia/Manila',
    jakarta: 'Asia/Jakarta',
    bangkok: 'Asia/Bangkok',
    dubai: 'Asia/Dubai',
    mumbai: 'Asia/Kolkata',
    delhi: 'Asia/Kolkata',
    kolkata: 'Asia/Kolkata',
    karachi: 'Asia/Karachi',
    moscow: 'Europe/Moscow',
    london: 'Europe/London',
    paris: 'Europe/Paris',
    berlin: 'Europe/Berlin',
    amsterdam: 'Europe/Amsterdam',
    madrid: 'Europe/Madrid',
    rome: 'Europe/Rome',
    cairo: 'Africa/Cairo',
    lagos: 'Africa/Lagos',
    nairobi: 'Africa/Nairobi',
    newyork: 'America/New_York',
    'new york': 'America/New_York',
    nyc: 'America/New_York',
    chicago: 'America/Chicago',
    denver: 'America/Denver',
    losangeles: 'America/Los_Angeles',
    la: 'America/Los_Angeles',
    sf: 'America/Los_Angeles',
    seattle: 'America/Los_Angeles',
    toronto: 'America/Toronto',
    vancouver: 'America/Vancouver',
    sydney: 'Australia/Sydney',
    melbourne: 'Australia/Melbourne',
    auckland: 'Pacific/Auckland',
};

/* -- State -------------------------------------------------- */
let history_list = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
let user_aliases = JSON.parse(localStorage.getItem(STORAGE_ALIASES) || '{}');
let hist_idx = -1;
let sug_idx = -1;
let current_sugs = [];
let debounceTimer = null;

const getAliases = () => ({
    ...DEFAULT_ALIASES,
    ...user_aliases
});

/* -- DOM refs ----------------------------------------------- */
const $cmd = document.getElementById('cmd');
const $inputWrapper = document.getElementById('input-wrapper')
const $output = document.getElementById('output-log');
const $suggestions = document.getElementById('suggestions');
const $help = document.getElementById('help-overlay');
const $config = document.getElementById('config-overlay');
const $aliasList = document.getElementById('alias-list');
const $aliasKey = document.getElementById('alias-key');
const $aliasUrl = document.getElementById('alias-url');
const $aliasSave = document.getElementById('alias-save');
const $configClose = document.getElementById('config-close');
const $clock = document.getElementById('clock');
const $weather = document.getElementById('weather-display');

let editingRow = null; // currently edited alias row, if any

/* -- Hint bar auto‑hide ------------------------------------- */
const HINT_AUTO_HIDE_DELAY = 3000; // 5 seconds – change here
const $hintBar = document.getElementById('hint-bar');
let hintTimer = null;

function showHintBar() {
    $hintBar.classList.remove('hint-hidden');
    restartHintTimer();
}

function hideHintBar() {
    $hintBar.classList.add('hint-hidden');
    clearTimeout(hintTimer);
}

function restartHintTimer() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHintBar, HINT_AUTO_HIDE_DELAY);
}

/* -- Clock (time + date) ------------------------------------ */
function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const date = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
    $clock.textContent = `${time} · ${date}`;
}
updateClock();
setInterval(updateClock, 5000);

/* -- Focus on load ------------------------------------------ */
window.addEventListener('load', () => $cmd.focus());
document.addEventListener('click', e => {
    if (!$help.contains(e.target) && !$config.contains(e.target)) $cmd.focus();
});

/* -- Storage helpers (history only) ------------------------- */
function saveHistory() {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history_list));
}

function saveAliases() {
    localStorage.setItem(STORAGE_ALIASES, JSON.stringify(user_aliases));
}

function pushHistory(cmd) {
    if (!cmd) return;
    history_list = history_list.filter(h => h !== cmd);
    history_list.unshift(cmd);
    if (history_list.length > 200) history_list.length = 200;
    saveHistory();
}

/* -- Output log --------------------------------------------- */
const MAX_HISTORY_ROWS = 10;

function logEntry(prefix, text, type = 'result') {
    hideMatrix();
    const row = document.createElement('div');
    row.className = `log-entry ${type}`;
    row.innerHTML = `<span class="log-prefix">${escHtml(prefix)}</span><span class="log-text">${escHtml(text)}</span>`;
    $output.appendChild(row);
    while ($output.children.length > MAX_HISTORY_ROWS) {
        $output.removeChild($output.firstChild);
    }
}

function logCmd(text) {
    logEntry('›', text, 'cmd-echo');
}

function logResult(text) {
    logEntry('=', text, 'result');
}

function logError(text) {
    logEntry('!', text, 'error');
}

function escHtml(s) {
    return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

/* -- Fuzzy match – Sørensen–Dice coefficient --------------- */
const bigramCache = new Map(); // Stores string bigrams

function bigrams(str) {
    const s = str.toLowerCase();
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        set.add(s.slice(i, i + 2));
    }
    return set;
}

// Helper to pull from cache or generate if new
function getCachedBigrams(str) {
    if (!bigramCache.has(str)) {
        bigramCache.set(str, bigrams(str));
    }
    return bigramCache.get(str);
}

function diceSimilarity(inputStr, aliasKey) {
    // Input changes constantly, calculate fresh
    const aBig = bigrams(inputStr);
    // Alias keys rarely change, pull from cache
    const bBig = getCachedBigrams(aliasKey);

    let intersect = 0;
    for (const bg of aBig) {
        if (bBig.has(bg)) intersect++;
    }
    const total = aBig.size + bBig.size;
    return total === 0 ? 0 : (2 * intersect) / total;
}

function bestAlias(raw) {
    const aliases = getAliases();
    const input = raw.toLowerCase().trim();
    if (aliases[input]) return input;

    let best = null,
        bestScore = 0.4;
    for (const key of Object.keys(aliases)) {
        let score;
        if (key.startsWith(input)) {
            score = 0.9; // strong prefix match
        } else {
            score = diceSimilarity(input, key);
        }
        if (score > bestScore) {
            bestScore = score;
            best = key;
        }
    }
    return best;
}

/* -- Utilities ---------------------------------------------- */
function tryCalc(expr) {
    try {
        const result = math.evaluate(expr);
        if (typeof result === 'function') return null;
        if (result === undefined || result === null) return null;
        return math.format(result, {
            precision: 12
        });
    } catch {
        return null;
    }
}

/* Improved timezone using Intl.DateTimeFormat (Cached) */
const tzFormatters = new Map(); // Store formatters to save CPU

function getWorldTime(cityRaw) {
    const key = cityRaw.toLowerCase().replace(/\s+/g, '');
    const tz = CITY_TZ[key] || CITY_TZ[cityRaw.toLowerCase()];
    if (!tz) return null;

    try {
        const now = new Date();

        // If we haven't checked this timezone yet, create and store it
        if (!tzFormatters.has(tz)) {
            tzFormatters.set(tz, new Intl.DateTimeFormat('en-GB', {
                timeZone: tz,
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZoneName: 'shortOffset',
            }));
        }

        // Retrieve the cached formatter
        const formatter = tzFormatters.get(tz);
        const parts = formatter.formatToParts(now);

        const timeStr = parts.filter(p => p.type !== 'timeZoneName').map(p => p.value).join('').replace(/,/g, '');
        const offset = parts.find(p => p.type === 'timeZoneName')?.value || '';
        const displayCity = cityRaw.replace(/\b\w/g, c => c.toUpperCase());

        return `${displayCity}: (${offset}) ${timeStr}`;
    } catch {
        return null;
    }
}

/* -- Intent resolution – pipeline of matchers --------------- */

function parseHeadTail(input) {
    const parts = input.split(/\s+/);
    return {
        head: parts[0].toLowerCase(),
        tail: parts.slice(1).join(' ')
    };
}

function tryOverrideSearch(input) {
    if (input.startsWith('!')) {
        const query = input.slice(1).trim();
        if (query) {
            return {
                type: 'redirect',
                url: FALLBACK_SEARCH.replace('%s', encodeURIComponent(query))
            };
        }
    }
    return null;
}

function tryClear(input) {
    if (/^(clear|cls)$/i.test(input)) return {
        type: 'clear'
    };
    return null;
}

function tryCalculator(input) {
    const {
        head,
        tail
    } = parseHeadTail(input);
    if (head !== '=' || !tail) return null;
    const result = tryCalc(tail);
    return result !== null ? {
        type: 'local',
        output: result
    } : {
        type: 'local',
        output: 'invalid math expression',
        err: true
    };
}

function tryMathExpression(input) {
    // Slightly improved regex: now also allows leading '-' or '+' etc.
    const isMathy = /^[\d\(\.\-\+]|^(sqrt|sin|cos|tan|log|exp|pi|e|abs|cbrt|ceil|floor|round)\b/i;
    if (!isMathy.test(input)) return null;
    const result = tryCalc(input);
    if (result !== null && result !== input) {
        return {
            type: 'local',
            output: result
        };
    }
    return null;
}

function tryTime(input) {
    const {
        head,
        tail
    } = parseHeadTail(input);
    if (head !== 'time' || !tail) return null;
    const t = getWorldTime(tail);
    return t ? {
        type: 'local',
        output: t
    } : {
        type: 'redirect',
        url: FALLBACK_SEARCH.replace('%s', encodeURIComponent(input))
    };
}

function tryWeather(input) {
    const {
        head,
        tail
    } = parseHeadTail(input);
    if (head === 'weather' && tail) {
        return {
            type: 'weather',
            city: tail
        };
    }
    return null;
}

/* -- Currency (uses open.er-api.com, free & no key) ------- */
const CURRENCY_CACHE_KEY = 'skb_currency_rates';
const CURRENCY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function tryCurrency(input) {
    const match = input.match(/^(?:(\d+(?:\.\d+)?)\s+)?([a-z]{3})\s+(?:to\s+|in\s+)?([a-z]{3})$/i);
    if (!match) return null;

    let amount = parseFloat(match[1]) || 1;
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    if (from.length !== 3 || to.length !== 3 || from === to) return null;

    try {
        const rates = await getCurrencyRates();
        if (!rates[from] || !rates[to]) return null;

        const result = (amount / rates[from]) * rates[to];
        const rateVal = rates[to] / rates[from];

        const fmt = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        return {
            type: 'local',
            output: `${fmt.format(result)} ${to} (${fmt.format(rateVal)} ${to}/${from})`,
        };
    } catch {
        return null; // fallback to Google if API fails
    }
}

async function getCurrencyRates() {
    const cached = JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CURRENCY_CACHE_TTL) {
        return cached.rates;
    }

    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('Rates fetch failed');
    const data = await res.json();
    const rates = data.rates; // e.g. { EUR: 0.92, JPY: 145.3, ... }

    localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        rates,
    }));
    return rates;
}


function tryExactAlias(input) {
    const {
        head,
        tail
    } = parseHeadTail(input);
    const aliases = getAliases();
    const a = aliases[head];
    if (!a) return null;

    if (!tail) return {
        type: 'redirect',
        url: a.nav || a.url.replace('%s', '')
    };
    if (a.search) return {
        type: 'redirect',
        url: a.url.replace('%s', encodeURIComponent(tail))
    };
    return {
        type: 'redirect',
        url: a.nav || a.url
    };
}

function tryDirectUrl(input) {
    if (/^https?:\/\//.test(input)) return {
        type: 'redirect',
        url: input
    };
    return null;
}

function tryDomainRouting(input) {
    // Now matches: something.com, sub.something.com, a.b.c.co, etc.
    if (/^[\w\-]+(\.[\w\-]+)*\.(com|org|net|io|dev|ph|co|app|ai|me|gg|tv|ly)/i.test(input.trim())) {
        return {
            type: 'redirect',
            url: `https://${input.trim()}`
        };
    }
    return null;
}

function tryFuzzyAlias(input) {
    const {
        head,
        tail
    } = parseHeadTail(input);
    const fuzzy = bestAlias(head);
    if (!fuzzy) return null;

    const aliases = getAliases();
    const a = aliases[fuzzy];
    const hint = `→ ${fuzzy}`;
    if (!tail) return {
        type: 'redirect',
        url: a.nav || a.url.replace('%s', ''),
        fuzzy_hint: hint
    };
    if (a.search) return {
        type: 'redirect',
        url: a.url.replace('%s', encodeURIComponent(tail)),
        fuzzy_hint: hint
    };
    return {
        type: 'redirect',
        url: a.nav || a.url,
        fuzzy_hint: hint
    };
}

function tryFallbackSearch(input) {
    return {
        type: 'redirect',
        url: FALLBACK_SEARCH.replace('%s', encodeURIComponent(input))
    };
}

const MATCHERS = [
    tryOverrideSearch,
    tryClear,
    tryCalculator,
    tryMathExpression,
    tryTime,
    tryWeather,
    tryCurrency,
    tryExactAlias,
    tryDirectUrl,
    tryDomainRouting,
    tryFuzzyAlias,
    tryFallbackSearch,
];

async function resolve(raw) {
    const input = raw.trim();
    if (!input) return null;
    for (const matcher of MATCHERS) {
        const action = await matcher(input);
        if (action) return action;
    }
    return null;
}

/* -- Execute ------------------------------------------------ */
async function execute(raw) {
    const input = raw.trim();
    if (!input) return;

    console.log(`[Startpage] Command Executed: "${input}"`);
    pushHistory(input);
    hist_idx = -1;
    clearSuggestions();

    const action = await resolve(input);
    if (!action) return;

    console.log(`[Startpage] Action Resolved:`, action);

    if (action.type === 'clear') {
        // Remove all log-entry children, but keep the canvas
        $output.querySelectorAll('.log-entry').forEach(el => el.remove());
        $cmd.value = '';
        startMatrix(); // restart rain
        return;
    }

    if (action.type === 'local') {
        logCmd(input);
        if (action.err) logError(action.output);
        else logResult(action.output);
        $cmd.value = '';
        return;
    }

    if (action.type === 'weather') {
        hideMatrix();
        logCmd(input);
        $cmd.value = '';
        const weatherUrl = `https://wttr.in/${encodeURIComponent(action.city)}?format=%l:+%C+%t+%w`;
        fetch(weatherUrl)
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(htmlString => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlString, 'text/html');
                const plaintext = doc.body.textContent.trim();
                logResult(plaintext || 'No data found.');
                console.log(`[Startpage] Weather Fetch Result: ${plaintext}`);
            })
            .catch(() => {
                logError(`Could not fetch weather for ${action.city}`);
                console.error(`[Startpage] Weather Fetch Failed for "${action.city}"`);
            });
        return;
    }

    if (action.type === 'redirect') {
        if (action.fuzzy_hint) {
            logCmd(input);
            logResult(`navigating ${action.fuzzy_hint}`);
            $cmd.value = '';
            setTimeout(() => {
                window.location.href = action.url;
            }, 180);
        } else {
            $cmd.value = '';
            window.location.href = action.url; // or location.replace(action.url)
        }
    }
}

/* -- Suggestions ---------------------------------------------- */
function buildSuggestions(val) {
    const input = val.trim().toLowerCase();
    if (!input) {
        clearSuggestions();
        return;
    }

    if (input.startsWith('!')) {
        const query = input.slice(1).trim();
        if (query) {
            current_sugs = [{
                label: `Strict search "${query}"`,
                dest: FALLBACK_SEARCH.replace('%s', encodeURIComponent(query)),
                tag: 'web',
                score: 10
            }];
            sug_idx = -1;
            renderSuggestions();
        } else {
            clearSuggestions();
        }
        return;
    }

    const aliases = getAliases();
    const parts = input.split(/\s+/);
    const head = parts[0];
    const hasQuery = parts.length > 1;
    const items = [];

    // Exact/prefix alias matches
    for (const [key, a] of Object.entries(aliases)) {
        if (key.startsWith(head) || key === head) {
            const label = hasQuery ?
                `${key} — search "${parts.slice(1).join(' ')}"` :
                key;
            const dest = hasQuery ?
                (a.search ? a.url.replace('%s', encodeURIComponent(parts.slice(1).join(' '))) : (a.nav || a.url)) :
                (a.nav || a.url.replace('%s', ''));
            items.push({
                label,
                dest,
                tag: 'alias',
                score: key === head ? 2 : 1.5
            });
        }
    }

    // History – most recent first
    for (const h of history_list) {
        if (h.toLowerCase().startsWith(input) && h.toLowerCase() !== input) {
            const idx = history_list.indexOf(h); // 0 = most recent
            // Score: 2 for most recent, scaling down to 1 for oldest
            const score = 1 + (history_list.length - idx) / history_list.length;
            items.push({
                label: h,
                dest: null,
                tag: 'history',
                score
            });
        }
    }

    // Fuzzy alias suggestions when no query typed
    if (!hasQuery && items.length < 3) {
        for (const [key] of Object.entries(aliases)) {
            const s = diceSimilarity(head, key);
            if (s > 0.5 && !items.find(i => i.label === key)) {
                items.push({
                    label: key,
                    dest: null,
                    tag: 'fuzzy',
                    score: s
                });
            }
        }
    }

    // Fallback web search
    if (input.length > 1) {
        items.push({
            label: `Search "${val.trim()}"`,
            dest: FALLBACK_SEARCH.replace('%s', encodeURIComponent(val.trim())),
            tag: 'web',
            score: 0,
        });
    }

    items.sort((a, b) => b.score - a.score);
    current_sugs = items.slice(0, 5);
    sug_idx = -1;
    renderSuggestions();
}

function renderSuggestions() {
    $suggestions.innerHTML = '';
    const fragment = document.createDocumentFragment(); // Create the fragment

    current_sugs.forEach((s, i) => {
        const el = document.createElement('div');
        el.className = 'suggestion-item' + (i === sug_idx ? ' active' : '');
        el.innerHTML =
            `<span class="sug-arrow">→</span><span class="sug-label">${escHtml(s.label)}</span><span class="sug-tag">${s.tag}</span>`;

        el.addEventListener('mousedown', e => {
            e.preventDefault();
        });
        el.addEventListener('click', () => {
            if (s.dest) {
                window.location.href = s.dest;
            } else {
                $cmd.value = s.label;
                buildSuggestions(s.label);
                $cmd.focus();
            }
        });
        fragment.appendChild(el); // Append to memory, not the DOM
    });

    $suggestions.appendChild(fragment); // Push to DOM all at once
}

function clearSuggestions() {
    current_sugs = [];
    sug_idx = -1;
    $suggestions.innerHTML = '';
}

/* -- Input events ---------------------------------------------- */
$cmd.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    hist_idx = -1;
    debounceTimer = setTimeout(() => buildSuggestions($cmd.value), 50);
});

$cmd.addEventListener('keydown', e => {
    clearTimeout(debounceTimer); // cancel any pending suggestion rebuild
    switch (e.key) {
        case 'Enter': {
            if (sug_idx >= 0 && current_sugs[sug_idx]?.dest) {
                e.preventDefault();
                window.location.href = current_sugs[sug_idx].dest;
            } else if (sug_idx >= 0 && current_sugs[sug_idx]) {
                e.preventDefault();
                $cmd.value = current_sugs[sug_idx].label;
                clearSuggestions();
            } else {
                e.preventDefault();
                execute($cmd.value);
            }
            break;
        }
        case 'Tab': {
            e.preventDefault();
            if (current_sugs.length > 0) {
                const top = current_sugs[0];
                if (top.dest && top.tag !== 'history') {
                    $cmd.value = top.label.split(' ')[0] + ' ';
                } else {
                    $cmd.value = top.label;
                }
                clearSuggestions();
                buildSuggestions($cmd.value);
            }
            break;
        }
        case 'Escape': {
            e.preventDefault();
            e.stopPropagation();

            if (current_sugs.length > 0) {
                clearSuggestions();
            } else if ($cmd.value) {
                $cmd.value = '';
                clearSuggestions();
            } else if (!$help.hidden) {
                toggleHelp();
            } else if (!$config.hidden) {
                closeConfig();
            } else {
                // Soft refresh: show hint bar and restart its timer
                showHintBar();
            }
            break;
        }
        case 'ArrowUp': {
            e.preventDefault();
            if (current_sugs.length > 0) {
                sug_idx = Math.max(sug_idx - 1, -1);
                renderSuggestions();
            } else {
                hist_idx = Math.min(hist_idx + 1, history_list.length - 1);
                $cmd.value = history_list[hist_idx] || '';
                buildSuggestions($cmd.value);
            }
            break;
        }
        case 'ArrowDown': {
            e.preventDefault();
            if (current_sugs.length > 0) {
                sug_idx = Math.min(sug_idx + 1, current_sugs.length - 1);
                renderSuggestions();
            } else {
                hist_idx = Math.max(hist_idx - 1, -1);
                $cmd.value = hist_idx >= 0 ? (history_list[hist_idx] || '') : '';
                buildSuggestions($cmd.value);
            }
            break;
        }
    }
});

/* -- Global key bindings --------------------------------------- */
document.addEventListener('keydown', e => {

    // Cancel alias editing on Escape (global)
    if (e.key === 'Escape' && editingRow) {
        e.preventDefault();
        cancelEdit(editingRow);
        return;
    }

    if (e.key === 'Escape') {
        if (!$config.hidden) {
            e.preventDefault();
            closeConfig();
            return;
        }
        if (!$help.hidden) {
            e.preventDefault();
            toggleHelp();
            return;
        }
    }

    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (!$help.hidden) toggleHelp();
        if ($config.hidden) openConfig();
        else closeConfig();
        return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = document.activeElement.tagName;
    // Don't intercept keystrokes inside overlay inputs
    const inOverlay = tag === 'INPUT' && document.activeElement !== $cmd;

    if (!inOverlay) {
        if (e.key === '?') {
            e.preventDefault();
            toggleHelp();
            return;
        }
        if (e.key === '`') {
            e.preventDefault();
            $cmd.focus();
            return;
        }
        if (e.key.length === 1 && document.activeElement !== $cmd) {
            $cmd.focus();
        }
    }
});

/* -- Help ------------------------------------------------------- */
function toggleHelp() {
    $help.hidden = !$help.hidden;
    if (!$help.hidden) $config.hidden = true;
    else $cmd.focus();
}

$help.addEventListener('click', e => {
    if (e.target === $help) toggleHelp();
});

/* -- Config ----------------------------------------------------- */
function openConfig() {
    $config.hidden = false;
    renderAliasList();
    $aliasKey.focus();
}

function closeConfig() {
    $config.hidden = true;
    $cmd.focus();
}

$configClose.addEventListener('click', closeConfig);
$config.addEventListener('click', e => {
    if (e.target === $config) closeConfig();
});

function makeAliasRow(key, val, isBuiltin) {
    const url = typeof val === 'string' ? val : (val.url || val.nav || '');
    const displayUrl = url;

    const row = document.createElement('div');
    row.className = 'alias-row' + (isBuiltin ? ' is-builtin' : '');

    if (isBuiltin) {
        row.innerHTML = `
      <span class="alias-key">${escHtml(key)}</span>
      <span class="alias-url" title="${escHtml(url)}">${escHtml(displayUrl)}</span>
    `;
    } else {
        row.innerHTML = `
      <span class="alias-key">${escHtml(key)}</span>
      <span class="alias-url" title="${escHtml(url)}">${escHtml(url)}</span>
      <button class="alias-del" data-key="${escHtml(key)}" aria-label="Delete alias ${escHtml(key)}">✕</button>
    `;

        // Delete button
        row.querySelector('.alias-del').addEventListener('click', (e) => {
            e.stopPropagation();
            delete user_aliases[key];
            saveAliases();
            renderAliasList();
        });

        // Double‑click on key → focus key input
        row.querySelector('.alias-key').addEventListener('dblclick', () => {
            enterEditMode(row, key, 'key');
        });

        // Double‑click on url → focus url input
        row.querySelector('.alias-url').addEventListener('dblclick', () => {
            enterEditMode(row, key, 'url');
        });
    }

    return row;
}

function enterEditMode(row, key, focusTarget = 'key') {
    if (row.classList.contains('editing')) return;
    if (editingRow) cancelEdit(editingRow);

    const keySpan = row.querySelector('.alias-key');
    const urlSpan = row.querySelector('.alias-url');
    const delBtn = row.querySelector('.alias-del');

    // Store original elements for later restoration
    row._keySpan = keySpan;
    row._urlSpan = urlSpan;
    row._delBtn = delBtn || null;

    const currentAlias = user_aliases[key] || {};
    const currentUrl = currentAlias.url || currentAlias.nav || '';

    // Hide spans and delete button
    keySpan.style.display = 'none';
    urlSpan.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';

    // Create key input and insert after keySpan
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'alias-edit-input alias-edit-key';
    keyInput.value = key;
    keySpan.insertAdjacentElement('afterend', keyInput);

    // Create url input and insert after urlSpan
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'alias-edit-input alias-edit-url';
    urlInput.value = currentUrl;
    urlSpan.insertAdjacentElement('afterend', urlInput);

    // Store input references for cleanup
    row._keyInput = keyInput;
    row._urlInput = urlInput;

    row.classList.add('editing');
    editingRow = row;

    // Focus the targeted input
    if (focusTarget === 'url') {
        urlInput.focus();
        urlInput.setSelectionRange(0, urlInput.value.length);
    } else {
        keyInput.focus();
        keyInput.select();
    }

    // Save logic
    const save = () => {
        const newKey = keyInput.value.trim().toLowerCase();
        const newUrl = urlInput.value.trim();
        if (!newKey || !newUrl) {
            cancelEdit(row);
            return;
        }
        delete user_aliases[key];
        user_aliases[newKey] = {
            url: newUrl,
            search: newUrl.includes('%s'),
            nav: newUrl.includes('%s') ? newUrl.split('%s')[0].replace(/[\?\&][^?&=]+=?$/, '') : newUrl
        };
        saveAliases();
        // Re-render the whole list – the editing row will be destroyed and rebuilt
        renderAliasList();
    };

    // Cancel logic
    const cancel = () => cancelEdit(row);

    keyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    });
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    });

    // Global click‑outside listener
    setTimeout(() => document.addEventListener('click', handleOutsideClick), 0);
}

function cancelEdit(row) {
    if (!row || !row.classList.contains('editing')) return;

    // Remove all input fields in this row
    row.querySelectorAll('.alias-edit-input').forEach(el => el.remove());

    // Show original spans and delete button
    if (row._keySpan) row._keySpan.style.display = '';
    if (row._urlSpan) row._urlSpan.style.display = '';
    if (row._delBtn) row._delBtn.style.display = '';

    row.classList.remove('editing');

    // Clean up stored references
    delete row._keySpan;
    delete row._urlSpan;
    delete row._delBtn;
    delete row._keyInput;
    delete row._urlInput;

    editingRow = null;
    document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(e) {
    if (!editingRow) return;
    // If click is inside the editing row, ignore
    if (editingRow.contains(e.target)) return;
    // Otherwise, cancel
    cancelEdit(editingRow);
}

/* -- Theme Management --------------------------------------- */
const THEME_STORAGE_KEY = 'skb_theme';
const $themeSelect = document.getElementById('theme-select');

/** Returns an array of valid theme values extracted from themes.css */
function getAvailableThemes() {
    const themes = new Set();
    try {
        for (const sheet of document.styleSheets) {
            // Only process themes.css (adjust the href check if needed)
            if (!sheet.href || !sheet.href.includes('themes.css')) continue;

            const rules = sheet.cssRules || sheet.rules; // standard + legacy
            for (const rule of rules) {
                if (rule.selectorText) {
                    // Match [data-theme="something"] inside the selector
                    const match = rule.selectorText.match(/\[data-theme="([^"]+)"\]/);
                    if (match) themes.add(match[1]);
                }
            }
        }
    } catch (e) {
        // Fallback: hardcoded list if stylesheet can't be read (e.g. CORS)
        return ['default-dark', 'nebula', 'mocha', 'twilight', 'nord', 'eighties',
            'rose-pine-moon', 'default-light', 'ocean', 'rose-pine-dawn',
            'sakura', 'cupcake', 'dracula', 'rose-pine'
        ];
    }
    return Array.from(themes);
}

/** Format a theme key into a human‑readable label */
function themeLabel(theme) {
    return theme.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** Build the theme selector with options from the CSS */
function populateThemeSelect() {
    if (!$themeSelect) return;
    const themes = getAvailableThemes();
    $themeSelect.innerHTML = '';
    themes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = themeLabel(t);
        $themeSelect.appendChild(opt);
    });
}

// Call it once on startup (after DOM is ready)
populateThemeSelect();

// Apply a theme and save preference
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if ($themeSelect) $themeSelect.value = theme;
}

// Load saved theme or use default
function loadTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    // Use the dynamically‑populated dropdown to check validity
    const validThemes = $themeSelect ?
        Array.from($themeSelect.options).map(opt => opt.value) : [];
    if (saved && validThemes.includes(saved)) {
        applyTheme(saved);
    } else {
        applyTheme('default-dark'); // fallback
    }
}

// Listen to dropdown changes
if ($themeSelect) {
    $themeSelect.addEventListener('change', () => {
        applyTheme($themeSelect.value);
    });
}

// Call on page load
loadTheme();

function renderAliasList() {
    $aliasList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const customKeys = Object.keys(user_aliases);
    const customLabel = document.createElement('div');
    customLabel.className = 'alias-group-label';
    customLabel.textContent = 'CUSTOM';
    fragment.appendChild(customLabel);

    if (customKeys.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:.7rem;color:var(--muted);padding:.35rem 0 .5rem';
        empty.textContent = 'No custom aliases yet — add one below.';
        fragment.appendChild(empty);
    } else {
        for (const key of customKeys) {
            fragment.appendChild(makeAliasRow(key, user_aliases[key], false));
        }
    }

    const builtinLabel = document.createElement('div');
    builtinLabel.className = 'alias-group-label';
    builtinLabel.textContent = 'BUILT-IN';
    fragment.appendChild(builtinLabel);

    for (const [key, val] of Object.entries(DEFAULT_ALIASES)) {
        fragment.appendChild(makeAliasRow(key, val, true));
    }

    $aliasList.appendChild(fragment); // Push to DOM all at once
}

$aliasSave.addEventListener('click', saveAlias);
[$aliasKey, $aliasUrl].forEach(el => {
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveAlias();
    });
});

function saveAlias() {
    const key = $aliasKey.value.trim().toLowerCase();
    const url = $aliasUrl.value.trim();

    // Validation: no empty key, no spaces in key
    if (!key || key.includes(' ')) {
        logError('Alias key must be a single word without spaces.');
        return;
    }
    if (!url) {
        logError('Alias URL cannot be empty.');
        return;
    }

    // Warn if overriding built-in
    if (DEFAULT_ALIASES[key]) {
        logResult(`Overriding built-in alias "${key}".`);
    }

    const search = url.includes('%s');
    user_aliases[key] = {
        url,
        search,
        nav: search ? url.split('%s')[0].replace(/[\?\&][^?&=]+=?$/, '') : url
    };
    saveAliases();
    $aliasKey.value = '';
    $aliasUrl.value = '';
    renderAliasList();
    $aliasKey.focus();
}

/* -- Ambient weather (cached 30 min) -------------------------- */
(async function fetchWeather() {
    try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.ts < WEATHER_CACHE_TTL) {
            $weather.textContent = cached.text;
            return;
        }

        const r = await fetch('https://wttr.in/?format=j1');
        if (!r.ok) return;
        const d = await r.json();
        const cur = d.current_condition[0];
        const temp = cur.temp_C;
        const desc = cur.weatherDesc[0].value;
        const text = `${temp}°C ${desc}`;
        $weather.textContent = text;
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
            ts: Date.now(),
            text
        }));
    } catch {
        /* silent fail */
    }
})();

/* -- Matrix Rain (high‑DPI, zoom‑proof) -------------------- */
let matrixAnimationId = null;
let lastDrawTime = 0;
const MATRIX_FPS = 50;
let matrixCanvas = null;

function startMatrix() {
    if (!document.getElementById('matrix-canvas')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'matrix-canvas';
        $output.prepend(canvas);
    }

    matrixCanvas = document.getElementById('matrix-canvas');
    if (!matrixCanvas || matrixAnimationId) return;

    const ctx = matrixCanvas.getContext('2d');
    const chars =
        'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let fontSize = 12;
    const colWidth = fontSize * 0.8;
    let cols = 0,
        rows = 0;
    let drops = [];
    let grid = [];
    let ratio = window.devicePixelRatio || 1;

    function getThemeColors() {
        const style = getComputedStyle(document.body);
        return {
            bg: style.getPropertyValue('--base00').trim() || '#000000',
            fg: style.getPropertyValue('--accent').trim() || '#00FF00'
        };
    }

    function resize() {
        // [Keep your existing resize logic here - it is already well written]
        if (!matrixCanvas || !matrixCanvas.isConnected) return;

        const rect = matrixCanvas.getBoundingClientRect();
        ratio = window.devicePixelRatio || 1;
        matrixCanvas.width = rect.width * ratio;
        matrixCanvas.height = rect.height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const logicalW = rect.width;
        const logicalH = rect.height;
        const newCols = Math.ceil(logicalW / colWidth);
        const newRows = Math.ceil(logicalH / fontSize);

        if (newCols !== cols || newRows !== rows) {
            const newGrid = [];
            for (let i = 0; i < newCols; i++) {
                newGrid[i] = [];
                for (let j = 0; j < newRows; j++) {
                    if (i < cols && j < rows && grid[i] && grid[i][j]) {
                        newGrid[i][j] = grid[i][j];
                    } else {
                        newGrid[i][j] = {
                            char: chars.charAt(Math.floor(Math.random() * chars.length)),
                            alpha: 0
                        };
                    }
                }
            }
            grid = newGrid;
            if (drops.length < newCols) {
                for (let i = drops.length; i < newCols; i++) {
                    drops[i] = 0;
                }
            }
            cols = newCols;
            rows = newRows;
        }
    }

    function draw(timestamp) {
        // Throttle the frame rate to match your original 50ms interval
        if (timestamp - lastDrawTime < MATRIX_FPS) {
            matrixAnimationId = requestAnimationFrame(draw);
            return;
        }
        lastDrawTime = timestamp;

        const colors = getThemeColors();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, matrixCanvas.width / ratio, matrixCanvas.height / ratio);
        ctx.fillStyle = colors.fg;
        const fontFamily = getComputedStyle(document.body).fontFamily;
        ctx.font = `${fontSize}px ${fontFamily}`;

        for (let i = 0; i < cols; i++) {
            if (drops[i] >= 0 && drops[i] < rows) {
                grid[i][drops[i]].alpha = 1.0;
                grid[i][drops[i]].char = chars.charAt(Math.floor(Math.random() * chars.length));
            }
            drops[i]++;
            if (drops[i] > rows && Math.random() > 0.95) drops[i] = 0;

            for (let j = 0; j < rows; j++) {
                if (grid[i][j].alpha > 0.01) {
                    grid[i][j].alpha *= 0.90;
                    if (Math.random() > 0.98) {
                        grid[i][j].char = chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    ctx.globalAlpha = grid[i][j].alpha;
                    ctx.fillText(grid[i][j].char, i * colWidth, (j + 1) * fontSize);
                }
            }
        }
        matrixAnimationId = requestAnimationFrame(draw);
    }

    resize();
    matrixAnimationId = requestAnimationFrame(draw); // Kick off the loop

    const observer = new ResizeObserver(resize);
    observer.observe(matrixCanvas);
    matrixCanvas.style.display = 'block';
}

function stopMatrix() {
    if (matrixAnimationId) {
        cancelAnimationFrame(matrixAnimationId);
        matrixAnimationId = null;
    }
    if (matrixCanvas) {
        const ctx = matrixCanvas.getContext('2d');
        ctx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    }
}

function hideMatrix() {
    stopMatrix();
    if (matrixCanvas) matrixCanvas.style.display = 'none';
}

/* -- Init ---------------------------------------------------- */
$cmd.focus();
startMatrix();
showHintBar();