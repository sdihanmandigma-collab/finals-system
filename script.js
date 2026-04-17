'use strict';

const API_URL = 'http://localhost:5000';

let PRODUCTS = [];
let ORDERS = [];

const state = {
  user: null,
  cart: [],
  activeFilter: 'all',
  searchQuery: '',
};

const CATEGORY_LABELS = {
  snacks: 'Snacks',
  beverages: 'Beverages',
  drinks: 'Drinks',
  baby: 'Baby Care',
  pantry: 'Pantry',
  'frozen food': 'Frozen Food',
  softdrinks: 'Softdrinks',
  dairy: 'Dairy',
  alcohol: 'Alcohol',
  spreads: 'Spreads',
  hygiene: 'Hygiene',
  cleaning: 'Cleaning'
};

const $ = id => document.getElementById(id);
const fmt = n => '₱' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ── Storage Helpers ───────────────────────────────────────────────────────────
function getCartKey() {
  return state.user ? `cart_user_${state.user.id}` : 'cart_guest';
}

function saveCartToStorage() {
  localStorage.setItem(getCartKey(), JSON.stringify(state.cart));
}

function loadCartFromStorage() {
  const saved = localStorage.getItem(getCartKey());
  state.cart = saved ? JSON.parse(saved) : [];
}

function clearCartStorage() {
  localStorage.removeItem(getCartKey());
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function setMsg(id, msg, type = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'modal-form-msg ' + type;
}

function setFormMsg(id, msg, type = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'form-msg ' + type;
}

// ── Modal Helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('open');
  if (!anyModalOpen()) document.body.style.overflow = '';
}

function closeAllModals() {
  ['signupModal', 'loginModal'].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove('open');
  });
  document.body.style.overflow = '';
}

function anyModalOpen() {
  return ['signupModal', 'loginModal'].some(id => $(id)?.classList.contains('open'));
}

// ── Auth / User ───────────────────────────────────────────────────────────────
function logout() {
  state.user = null;
  state.cart = [];
  ORDERS = [];

  localStorage.removeItem('user');
  clearCartStorage();

  updateCartUI();

  if ($('navLoginBtn')) $('navLoginBtn').style.display = '';
  if ($('navSignupBtn')) $('navSignupBtn').style.display = '';

  renderProducts();
  showToast('You have been logged out.');
}

function updateUIForLoggedInUser() {
  if (!state.user) return;
  window.location.href = 'dashboard.html';
}

// ── Products ──────────────────────────────────────────────────────────────────
async function init() {
  observeReveal();

  try {
    console.log('Fetching products from:', `${API_URL}/api/products`);

    const response = await fetch(`${API_URL}/api/products`);

    console.log('Products response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    PRODUCTS = await response.json();
    console.log('Loaded products:', PRODUCTS);

    renderProducts();
    renderSales(PRODUCTS);

    const mo = new MutationObserver(() => observeReveal());
    mo.observe(document.body, { childList: true, subtree: true });

    console.log('Products loaded successfully!');
  } catch (err) {
    console.error('Error loading products:', err);
    observeReveal();
    showToast('Failed to load products.', 'error');
  }
}

function isEmployee() {
  return state.user?.role === 'employee';
}

function getDiscountedPrice(price) {
  return isEmployee() ? Number(price) * 0.90 : Number(price);
}

function getFilteredProducts() {
  let list = PRODUCTS;

  if (state.activeFilter !== 'all') {
    list = list.filter(p => String(p.category).toLowerCase() === state.activeFilter.toLowerCase());
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p =>
      String(p.name).toLowerCase().includes(q) ||
      String(p.category).toLowerCase().includes(q)
    );
  }

  return list;
}

function renderProducts() {
  const grid = $('productGrid');
  const noRes = $('noResults');
  if (!grid || !noRes) return;

  const filtered = getFilteredProducts();
  const isLoggedIn = !!state.user;

  if (!filtered.length) {
    grid.innerHTML = '';
    noRes.style.display = 'block';
    return;
  }

  noRes.style.display = 'none';

  grid.innerHTML = filtered.map((p, i) => {
    const original = Number(p.price);
    const finalPrice = getDiscountedPrice(original);

    return `
      <div class="product-card reveal" style="transition-delay:${i * 60}ms">
        <div class="product-img-wrap">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
          ${p.image
            ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`
            : `<div class="product-img-placeholder"><i class="fas fa-box-open"></i></div>`
          }
        </div>
        <div class="product-card-body">
          <p class="product-category">${CATEGORY_LABELS[String(p.category).toLowerCase()] || p.category}</p>
          <h3>${p.name}</h3>
          <p class="product-price">
            ${
              isEmployee()
                ? `<span style="text-decoration:line-through; color:#999; margin-right:8px;">${fmt(original)}</span>
                   <span style="color:var(--green-dark); font-weight:700;">${fmt(finalPrice)}</span>`
                : `${fmt(original)}`
            }
          </p>
          ${
            isLoggedIn
              ? `<button class="add-cart-btn" onclick="addToCart(${p.id})"><i class="fas fa-cart-plus"></i> Add to Cart</button>`
              : `<button class="add-cart-btn locked" onclick="openModal('loginModal')"><i class="fas fa-lock"></i> Sign in to Order</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    grid.querySelectorAll('.product-card').forEach(el => {
      el.offsetHeight;
      el.classList.add('visible');
    });
  });
}

function renderSales(products) {
  const track = document.getElementById('salesTrack');
  if (!track) return;

  const salesProducts = products.slice(0, 5);

  track.innerHTML = salesProducts.map(p => `
    <div class="sale-card">
      <div class="sale-image-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`
          : `<div class="product-img-placeholder"><i class="fas fa-box-open"></i></div>`
        }
      </div>
      <div class="sale-content">
        <span class="sale-badge">Hot Sale</span>
        <div class="sale-title">${p.name}</div>
        <div class="sale-price">${fmt(p.price)}</div>
      </div>
    </div>
  `).join('');
}

// ── Orders ────────────────────────────────────────────────────────────────────
async function loadOrders() {
  try {
    if (!state.user || !state.user.id) {
      ORDERS = [];
      return;
    }

    const response = await fetch(`${API_URL}/api/orders/${state.user.id}`);
    if (!response.ok) throw new Error('Orders load failed');

    ORDERS = await response.json();
    console.log('User orders loaded successfully!', ORDERS);
  } catch (err) {
    console.error('Error loading orders:', err);
    ORDERS = [];
  }
}

// ── Cart ──────────────────────────────────────────────────────────────────────
function toggleCart() {
  const sidebar = $('cartSidebar');
  const overlay = $('cartOverlay');
  if (!sidebar || !overlay) return;

  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function addToCart(productId) {
  if (!state.user) {
    openModal('loginModal');
    return;
  }

  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const finalPrice = getDiscountedPrice(product.price);
  const existing = state.cart.find(ci => ci.product.id === productId);

  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({
      product: {
        ...product,
        originalPrice: Number(product.price),
        price: Number(finalPrice)
      },
      qty: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`${product.name} added to cart!`);
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(ci => ci.product.id !== productId);
  saveCartToStorage();
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = state.cart.find(ci => ci.product.id === productId);
  if (!item) return;

  item.qty += delta;

  if (item.qty <= 0) {
    removeFromCart(productId);
    return;
  }

  saveCartToStorage();
  updateCartUI();
}

function getCartSubtotal() {
  return state.cart.reduce((sum, ci) => sum + Number(ci.product.price) * ci.qty, 0);
}

function getVat(subtotal) {
  return subtotal * 0.12;
}

function getShippingFee(subtotal) {
  return subtotal >= 300 ? 0 : 30;
}

function updateCartUI() {
  const count = state.cart.reduce((s, ci) => s + ci.qty, 0);
  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee(subtotal);
  const total = subtotal + vat + shipping;

  const countEl = $('cartCount');
  const itemsEl = $('cartItems');
  const footerEl = $('cartFooter');
  const totalEl = $('cartTotal');

  if (countEl) {
    countEl.textContent = count;
    countEl.classList.toggle('visible', count > 0);
  }

  if (!itemsEl) return;

  if (state.cart.length === 0) {
    itemsEl.innerHTML = '<div class="cart-empty"><i class="fas fa-basket-shopping"></i><p>Your cart is empty.</p></div>';
    if (footerEl) footerEl.style.display = 'none';
    if (totalEl) totalEl.textContent = fmt(0);
    return;
  }

  itemsEl.innerHTML = state.cart.map(ci => `
    <div class="cart-item">
      ${ci.product.image
        ? `<img src="${ci.product.image}" alt="${ci.product.name}" onerror="this.style.display='none'">`
        : `<div style="width:52px;height:52px;border-radius:8px;background:var(--green-pale);display:flex;align-items:center;justify-content:center;color:var(--green);font-size:1.2rem;flex-shrink:0"><i class="fas fa-box"></i></div>`
      }
      <div class="ci-info">
        <div class="ci-name">${ci.product.name}</div>
        <div class="ci-price">${fmt(Number(ci.product.price) * ci.qty)}</div>
        <div class="ci-qty">
          <button onclick="changeQty(${ci.product.id}, -1)"><i class="fas fa-minus"></i></button>
          <span>${ci.qty}</span>
          <button onclick="changeQty(${ci.product.id}, 1)"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <button class="ci-remove" onclick="removeFromCart(${ci.product.id})" title="Remove">
        <i class="fas fa-trash-can"></i>
      </button>
    </div>
  `).join('');

  if (footerEl) footerEl.style.display = 'block';
  if (totalEl) totalEl.textContent = fmt(total);
}

// ── Checkout / Save Order ─────────────────────────────────────────────────────
async function placeOrder() {
  if (!state.user) {
    openModal('loginModal');
    return;
  }

  if (state.cart.length === 0) {
    showToast('Your cart is empty.', 'error');
    return;
  }

  const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee(subtotal);
  const total = subtotal + vat + shipping;
  const newOrderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        order_code: newOrderId,
        order_date: today,
        status: 'Pending',
        items: totalItems,
        subtotal: subtotal,
        vat: vat,
        shipping_fee: shipping,
        promo_code: null,
        promo_discount: 0,
        total: total,
        payment_method: 'Cash on Delivery',
        address: 'No address provided',
        cartItems: state.cart.map(ci => ({
          id: ci.product.id,
          name: ci.product.name,
          price: ci.product.price,
          qty: ci.qty
        }))
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to place order');
    }

    showToast(`Order placed successfully! Order ID: ${newOrderId}`, 'success');

    state.cart = [];
    saveCartToStorage();
    updateCartUI();
    await loadOrders();
  } catch (error) {
    console.error('Place order error:', error);
    showToast('Error placing order: ' + error.message, 'error');
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
function buildSearchResults(query) {
  if (!query) return [];

  const q = query.toLowerCase();
  return PRODUCTS.filter(p =>
    String(p.name).toLowerCase().includes(q) ||
    String(p.category).toLowerCase().includes(q)
  ).slice(0, 6);
}

function renderSearchDropdown(query, inputEl, dropdownEl) {
  if (!dropdownEl) return;

  const results = buildSearchResults(query);

  if (!query || !results.length) {
    dropdownEl.innerHTML = query
      ? `<div class="search-no-result"><i class="fas fa-search"></i> No products found</div>`
      : '';
    dropdownEl.classList.toggle('open', !!query);
    return;
  }

  dropdownEl.innerHTML = results.map(p => `
    <div class="search-result-item" data-id="${p.id}">
      ${p.image
        ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`
        : `<div style="width:40px;height:40px;border-radius:6px;background:var(--green-pale);display:flex;align-items:center;justify-content:center;color:var(--green)"><i class="fas fa-box"></i></div>`
      }
      <div>
        <div class="sri-name">${p.name}</div>
        <div class="sri-price">${fmt(getDiscountedPrice(p.price))}</div>
      </div>
    </div>
  `).join('');

  dropdownEl.classList.add('open');

  dropdownEl.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      state.activeFilter = 'all';
      state.searchQuery = '';
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
      renderProducts();

      const shop = document.querySelector('#shop');
      if (shop) shop.scrollIntoView({ behavior: 'smooth' });

      inputEl.value = '';
      dropdownEl.classList.remove('open');

      const targetId = parseInt(item.dataset.id);

      setTimeout(() => {
        const cards = document.querySelectorAll('.product-card');
        const found = Array.from(cards).find(c =>
          c.querySelector('.add-cart-btn')?.getAttribute('onclick')?.includes(targetId)
        );

        if (found) {
          found.scrollIntoView({ behavior: 'smooth', block: 'center' });
          found.style.outline = '3px solid var(--green)';
          found.style.outlineOffset = '4px';
          setTimeout(() => {
            found.style.outline = '';
            found.style.outlineOffset = '';
          }, 2000);
        }
      }, 600);
    });
  });
}

// ── Scroll Reveal ─────────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

function observeReveal() {
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    state.user = JSON.parse(savedUser);
    loadCartFromStorage();
    updateCartUI();
  }

  init();

  ['signupModal', 'loginModal'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('click', e => {
        if (e.target === el) closeAllModals();
      });
    }
  });

  $('closeSignup')?.addEventListener('click', () => closeModal('signupModal'));
  $('closeLogin')?.addEventListener('click', () => closeModal('loginModal'));

  $('goLogin')?.addEventListener('click', () => {
    closeModal('signupModal');
    openModal('loginModal');
  });

  $('goSignup')?.addEventListener('click', () => {
    closeModal('loginModal');
    openModal('signupModal');
  });

  ['navSignupBtn', 'heroSignupBtn', 'shopSignupBtn', 'mobileSignupBtn'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', () => openModal('signupModal'));
  });

  ['navLoginBtn', 'mobileLoginBtn'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', () => openModal('loginModal'));
  });

  $('heroShopBtn')?.addEventListener('click', () => {
    document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' });
  });

  $('closeCart')?.addEventListener('click', toggleCart);
  $('cartOverlay')?.addEventListener('click', toggleCart);
  $('cartBtn')?.addEventListener('click', toggleCart);
  $('checkoutBtn')?.addEventListener('click', placeOrder);

  // SIGNUP
  $('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullname = $('suFullName')?.value.trim();
    const email = $('suEmail')?.value.trim();
    const role = $('suRole')?.value;
    const employee_id = $('suEmpId')?.value.trim();
    const password = $('suPassword')?.value;
    const confirmPassword = $('suConfirm')?.value;
    const termsAccepted = $('suTerms')?.checked;

    if (!fullname || !email || !role || !password || !confirmPassword) {
      setMsg('signupMsg', 'Please fill in all required fields.', 'error');
      return;
    }

    if (!email.includes('@')) {
      setMsg('signupMsg', 'Please enter a valid email.', 'error');
      return;
    }

    if (password.length < 8) {
      setMsg('signupMsg', 'Password must be at least 8 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setMsg('signupMsg', 'Passwords do not match.', 'error');
      return;
    }

    if (!termsAccepted) {
      setMsg('signupMsg', 'You must agree to the Terms & Conditions.', 'error');
      return;
    }

    if (role === 'employee' && !employee_id) {
      setMsg('signupMsg', 'Employee ID is required.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname,
          email,
          role,
          employee_id: role === 'employee' ? employee_id : null,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMsg('signupMsg', data.message || 'Signup failed.', 'error');
        return;
      }

      setMsg('signupMsg', data.message || 'Signup successful!', 'success');
      showToast(data.message || 'Account created successfully!', 'success');
      $('signupForm').reset();
      if ($('empIdField')) $('empIdField').style.display = 'none';

      setTimeout(() => {
        closeModal('signupModal');
        openModal('loginModal');
      }, 1200);

    } catch (error) {
      console.error('Signup error:', error);
      setMsg('signupMsg', 'Server error during signup.', 'error');
    }
  });

  // LOGIN
  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = $('liEmail')?.value.trim();
    const password = $('liPassword')?.value;

    if (!email || !password) {
      setMsg('loginMsg', 'Please enter your email and password.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setMsg('loginMsg', data.message || 'Login failed.', 'error');
        return;
      }

      state.user = data.user;
      localStorage.setItem('user', JSON.stringify(state.user));

      loadCartFromStorage();
      await loadOrders();

      setMsg('loginMsg', data.message || 'Login successful!', 'success');
      showToast(`Welcome, ${state.user.fullname}!`, 'success');

      $('loginForm').reset();
      closeAllModals();

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 300);

    } catch (error) {
      console.error('Login error:', error);
      setMsg('loginMsg', 'Server error during login.', 'error');
    }
  });

  // Password toggles
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      if (!inp) return;
      const isHidden = inp.type === 'password';
      inp.type = isHidden ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
  });

  // Filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.cat;
      renderProducts();
    });
  });

  // Search
  const searchInput = $('searchInput');
  const searchDropdown = $('searchDropdown');

  if (searchInput && searchDropdown) {
    searchInput.addEventListener('input', () => {
      state.searchQuery = searchInput.value.trim();
      renderSearchDropdown(state.searchQuery, searchInput, searchDropdown);
      renderProducts();
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        state.searchQuery = '';
        searchDropdown.classList.remove('open');
        renderProducts();
      }

      if (e.key === 'Enter') {
        document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' });
        searchDropdown.classList.remove('open');
      }
    });
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-bar-wrap')) {
      searchDropdown?.classList.remove('open');
    }
  });

  const mobileSearch = $('mobileSearch');
  if (mobileSearch) {
    mobileSearch.addEventListener('input', () => {
      state.searchQuery = mobileSearch.value.trim();
      renderProducts();
      if (state.searchQuery) {
        document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Role select
  const suRole = $('suRole');
  if (suRole) {
    suRole.addEventListener('change', (e) => {
      const empField = $('empIdField');
      if (!empField) return;

      if (e.target.value === 'employee') {
        empField.style.display = 'block';
      } else {
        empField.style.display = 'none';
        if ($('suEmpId')) $('suEmpId').value = '';
      }
    });
  }

  // Contact form
  const contactForm = $('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();

      const name = $('contactName')?.value.trim();
      const email = $('contactEmail')?.value.trim();
      const message = $('contactMessage')?.value.trim();

      if (!name || !email || !message) {
        setFormMsg('formMsg', 'Please fill in all required fields.', 'error');
        return;
      }

      if (!email.includes('@')) {
        setFormMsg('formMsg', 'Please enter a valid email.', 'error');
        return;
      }

      const subject = $('contactSubject')?.value || 'Message from Website';
      const phone = $('contactPhone')?.value;
      const bodyText = `From: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubject: ${subject}\n\n${message}`;

      window.location.href = `mailto:mcpcooperative@gmail.com?subject=${encodeURIComponent('MCP Website: ' + subject)}&body=${encodeURIComponent(bodyText)}`;
      setFormMsg('formMsg', 'Opening your mail app… Thank you for reaching out!', 'success');
      contactForm.reset();
    });
  }

  // Navbar active link on scroll
  window.addEventListener('scroll', () => {
    const navbar = $('navbar');
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);

    const sections = ['home', 'shop', 'contact'];
    let current = '';

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) current = id;
    });

    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
    });
  }, { passive: true });

  // Mobile menu
  const hamburger = $('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      $('mobileMenu')?.classList.toggle('open');
    });
  }

  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => {
      $('hamburger')?.classList.remove('open');
      $('mobileMenu')?.classList.remove('open');
    });
  });
});

// ── Expose functions ──────────────────────────────────────────────────────────
window.placeOrder = placeOrder;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.openModal = openModal;
window.logout = logout;