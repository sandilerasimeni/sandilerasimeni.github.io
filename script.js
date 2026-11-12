const GITHUB_USER = 'sandilerasimeni';
const PORTFOLIO_REPO = `${GITHUB_USER}.github.io`;
const PROJECTS_CACHE_KEY = 'sandile-portfolio-projects-v1';
const CACHE_TTL = 10 * 60 * 1000;

const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuButton && navLinks) {
  menuButton.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });

  navLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      navLinks.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
    }
  });
}

const projectGrid = document.querySelector('.project-grid');
const projectSection = document.querySelector('#projects');

function addProjectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .project-controls{display:grid;grid-template-columns:1fr minmax(190px,260px);gap:14px;align-items:center;margin:-12px 0 24px}
    .project-filters{display:flex;flex-wrap:wrap;gap:8px}
    .project-filter,.project-search{font:600 11px var(--body);color:var(--ink);border:1px solid var(--line);border-radius:6px;background:#fff;padding:9px 12px}
    .project-filter{cursor:pointer;transition:background .2s,color .2s,border-color .2s}
    .project-filter:hover,.project-filter[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
    .project-search{width:100%;outline:none}.project-search:focus{border-color:#8caf48;box-shadow:0 0 0 3px #8caf4826}
    .project-status{font-size:11px;color:var(--muted);margin:-12px 0 18px}
    .project-card{animation:project-enter .35s ease both}
    .project-empty{grid-column:1/-1;padding:30px;border:1px dashed var(--line);border-radius:5px;color:var(--muted);text-align:center;font-size:13px}
    @keyframes project-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:600px){.project-controls{grid-template-columns:1fr}.project-filters{gap:6px}}
    @media(prefers-reduced-motion:reduce){.project-card{animation:none}}
  `;
  document.head.append(style);
}

function getCachedProjects() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(PROJECTS_CACHE_KEY));
    if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.projects)) {
      return cached.projects;
    }
  } catch (_) {
    // Ignore unavailable storage or invalid cached data.
  }
  return null;
}

function saveCachedProjects(projects) {
  try {
    sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), projects }));
  } catch (_) {
    // The portfolio still works when browser storage is disabled.
  }
}

function safeRepositoryUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com' ? parsed.href : '#';
  } catch (_) {
    return '#';
  }
}

function createProjectCard(repo, index) {
  const card = document.createElement('article');
  card.className = 'project-card';

  const number = document.createElement('span');
  number.className = 'project-number';
  number.textContent = String(index + 1).padStart(2, '0');

  const topline = document.createElement('div');
  topline.className = 'project-topline';
  const type = document.createElement('span');
  type.className = 'project-type';
  type.textContent = (repo.language || (repo.topics && repo.topics[0]) || 'GITHUB PROJECT').toUpperCase();
  const year = document.createElement('span');
  year.className = 'project-year';
  year.textContent = repo.updated_at ? new Date(repo.updated_at).getFullYear() : '';
  topline.append(type, year);

  const title = document.createElement('h3');
  title.textContent = repo.name.replace(/[-_]/g, ' ');
  const description = document.createElement('p');
  description.textContent = repo.description || 'Explore the source code and details of this project on GitHub.';

  const tags = document.createElement('div');
  tags.className = 'tags';
  const labels = [...new Set([repo.language, ...(repo.topics || []).slice(0, 3)].filter(Boolean))].slice(0, 4);
  labels.forEach((label) => {
    const tag = document.createElement('span');
    tag.textContent = label;
    tags.append(tag);
  });

  const link = document.createElement('a');
  link.className = 'project-link';
  link.href = safeRepositoryUrl(repo.html_url);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'View repository ';
  const arrow = document.createElement('span');
  arrow.textContent = '↗';
  link.append(arrow);

  card.append(number, topline, title, description, tags, link);
  card.dataset.language = repo.language || 'Other';
  card.dataset.search = `${repo.name} ${repo.description || ''} ${repo.language || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  return card;
}

function renderProjects(repositories) {
  if (!projectGrid || !projectSection) return;

  const controls = document.createElement('div');
  controls.className = 'project-controls';
  controls.innerHTML = '<div class="project-filters" aria-label="Filter projects"></div><input class="project-search" type="search" aria-label="Search projects" placeholder="Search my projects…">';
  const filters = controls.querySelector('.project-filters');
  const search = controls.querySelector('.project-search');
  const status = document.createElement('p');
  status.className = 'project-status';
  status.setAttribute('aria-live', 'polite');

  const languages = [...new Set(repositories.map((repo) => repo.language).filter(Boolean))].sort();
  const categories = ['All', ...languages];
  let activeCategory = 'All';

  categories.forEach((category) => {
    const button = document.createElement('button');
    button.className = 'project-filter';
    button.type = 'button';
    button.textContent = category;
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => {
      activeCategory = category;
      filters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      updateVisibleProjects();
    });
    filters.append(button);
  });

  function updateVisibleProjects() {
    const query = search.value.trim().toLowerCase();
    const matching = repositories.filter((repo) => {
      const matchesCategory = activeCategory === 'All' || (repo.language || 'Other') === activeCategory;
      const searchable = `${repo.name} ${repo.description || ''} ${repo.language || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
      return matchesCategory && searchable.includes(query);
    });
    projectGrid.replaceChildren(...matching.map(createProjectCard));
    status.textContent = `${matching.length} ${matching.length === 1 ? 'project' : 'projects'} · synced from GitHub`;
    if (!matching.length) {
      const empty = document.createElement('p');
      empty.className = 'project-empty';
      empty.textContent = 'No projects match that search. Try another filter or search term.';
      projectGrid.append(empty);
    }
  }

  search.addEventListener('input', updateVisibleProjects);
  const heading = projectGrid.closest('.container');
  heading.insertBefore(controls, projectGrid);
  heading.insertBefore(status, projectGrid);
  updateVisibleProjects();
}

async function loadProjects() {
  if (!projectGrid || !projectSection) return;
  addProjectStyles();

  const cached = getCachedProjects();
  if (cached) renderProjects(cached);

  try {
    const response = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?type=owner&sort=updated&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const repos = await response.json();
    const projects = repos
      .filter((repo) => repo.name.toLowerCase() !== PORTFOLIO_REPO.toLowerCase() && !repo.fork && !repo.archived && !repo.private)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    saveCachedProjects(projects);
    renderProjects(projects);
  } catch (error) {
    if (!cached) {
      const status = document.createElement('p');
      status.className = 'project-status';
      status.textContent = 'Showing the featured projects while GitHub projects are unavailable. Please try again later.';
      projectGrid.before(status);
    }
    console.warn('Could not refresh projects from GitHub:', error);
  }
}

const yearElement = document.getElementById('year');
if (yearElement) yearElement.textContent = new Date().getFullYear();
loadProjects();
