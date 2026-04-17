const API_URL = 'http://localhost:5000';

let products = [];
let orders = [];
let notifications = [];
let cart = [];
let currentCategory = 'all';
let currentSlide = 0;
let selectedPaymentMethod = 'GCash';
let appliedPromo = {
  code: '',
  discount: 0
};

const promoSlides = [
  { image: "img/promo1.png" },
  { image: "img/promo2.png" },
  { image: "img/promo3.png" },
  { image: "img/promo4.png" },
  { image: "img/promo5.png" }
];

const currentUser = JSON.parse(localStorage.getItem('user'));

if (!currentUser || !currentUser.id) {
  window.location.href = 'index.html';
}

function peso(value) {
  return `₱${Number(value).toFixed(2)}`;
}

function getCartKey() {
  return `cart_user_${currentUser.id}`;
}

function saveCart() {
  localStorage.setItem(getCartKey(), JSON.stringify(cart));
}

function loadCartStorage() {
  const saved = localStorage.getItem(getCartKey());
  cart = saved ? JSON.parse(saved) : [];
}

function clearCartStorage() {
  localStorage.removeItem(getCartKey());
}

function isEmployee() {
  return currentUser?.role === 'employee';
}

function getDiscountedPrice(price) {
  return isEmployee() ? Number(price) * 0.90 : Number(price);
}

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}/api/products`);
    const data = await res.json();

    console.log('Loaded products:', data);

    products = Array.isArray(data) ? data : [];
    renderProducts();
  } catch (error) {
    console.error('Failed to load products:', error);
  }
}

async function loadOrders() {
  try {
    const res = await fetch(`${API_URL}/api/orders/${currentUser.id}`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      orders = [];
      renderOrders();
      return;
    }

    orders = data.filter(order => Number(order.userId) === Number(currentUser.id));
    renderOrders();
  } catch (error) {
    console.error('Failed to load orders:', error);
    orders = [];
    renderOrders();
  }
}

async function loadNotifications() {
  try {
    const res = await fetch(`${API_URL}/api/notifications/${currentUser.id}`);
    const data = await res.json();
    notifications = Array.isArray(data) ? data : [];
    renderNotifications();
  } catch (error) {
    console.error('Failed to load notifications:', error);
    notifications = [];
    renderNotifications();
  }
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/api/user/${currentUser.id}`);
    const data = await res.json();

    const fullNameInput = document.getElementById('profileFullName');
    const emailInput = document.getElementById('profileEmail');
    const roleInput = document.getElementById('profileRole');
    const statusInput = document.getElementById('profileStatus');
    const avatar = document.querySelector('.account-avatar');

    if (fullNameInput) fullNameInput.value = data.fullname || '';
    if (emailInput) emailInput.value = data.email || '';
    if (roleInput) roleInput.value = data.role || '';
    if (statusInput) statusInput.value = data.status || '';
    if (avatar) avatar.textContent = getInitials(data.fullname);

  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

function setTopNav(activeLink) {
  document.querySelectorAll('.top-nav-link').forEach(link => link.classList.remove('active'));
  if (activeLink) activeLink.classList.add('active');
}

function showSection(sectionId) {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.add('hidden');
  });

  const target = document.getElementById(sectionId);
  if (target) target.classList.remove('hidden');

  closeDropdowns();
}

function filterProducts(category, btn) {
  currentCategory = String(category || 'all').toLowerCase().trim();

  document.querySelectorAll('.cat-btn').forEach(el => {
    el.classList.remove('active');
  });

  if (btn) btn.classList.add('active');

  renderProducts();
}

function renderProducts() {
  const productSearch = document.getElementById('productSearch');
  const productSearch2 = document.getElementById('productSearch2');

  const search1 = productSearch ? productSearch.value.toLowerCase().trim() : '';
  const search2 = productSearch2 ? productSearch2.value.toLowerCase().trim() : '';
  const search = search1 || search2;

  const filtered = products.filter(product => {
    const productCategory = String(product.category || '').toLowerCase().trim();
    const productName = String(product.name || '').toLowerCase().trim();

    const categoryMatch = currentCategory === 'all' || productCategory === currentCategory;
    const searchMatch = productName.includes(search) || productCategory.includes(search);

    return categoryMatch && searchMatch;
  });

  const html = filtered.map(product => {
    const originalPrice = Number(product.price);
    const finalPrice = getDiscountedPrice(originalPrice);
    const imageSrc = product.image ? product.image : '';

    return `
      <div class="product-card compact-card">
        <div class="product-image compact-image">
          <img src="${imageSrc}" alt="${product.name}" onerror="this.parentElement.innerHTML='<div class=product-placeholder>📦</div>';">
        </div>
        <div class="product-category">${product.category}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-price">
          ${
            isEmployee()
              ? `
                <span style="text-decoration:line-through; color:#999; margin-right:8px;">
                  ${peso(originalPrice)}
                </span>
                <span style="color:#1f7a4d; font-weight:700;">
                  ${peso(finalPrice)}
                </span>
              `
              : `${peso(originalPrice)}`
          }
        </div>
        <button class="order-btn" data-id="${product.id}">Add to Cart</button>
      </div>
    `;
  }).join('');

  const emptyState = `<div class="content-card"><p class="muted">No products found.</p></div>`;

  const grid1 = document.getElementById('productsGrid');
  const grid2 = document.getElementById('productsGrid2');

  if (grid1) grid1.innerHTML = html || emptyState;
  if (grid2) grid2.innerHTML = html || emptyState;

  bindAddToCartButtons();
}

function bindAddToCartButtons() {
  document.querySelectorAll('.order-btn').forEach(button => {
    button.onclick = function () {
      const productId = Number(this.getAttribute('data-id'));
      addToCart(productId);
    };
  });
}

function addToCart(productId) {
  const product = products.find(p => Number(p.id) === Number(productId));
  if (!product) return;

  const discountedPrice = getDiscountedPrice(product.price);
  const existing = cart.find(item => Number(item.id) === Number(productId));

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: Number(product.id),
      name: product.name,
      price: Number(discountedPrice),
      originalPrice: Number(product.price),
      qty: 1
    });
  }

  saveCart();
  renderCart();
  openCartDrawer();
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
}

function getVat(subtotal) {
  return subtotal * 0.12;
}

function getShippingFee(subtotal) {
  return subtotal >= 300 ? 0 : 30;
}

function getGrandTotal() {
  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee(subtotal);
  return subtotal + vat + shipping - Number(appliedPromo.discount || 0);
}

function renderCart() {
  const cartContainer = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const subtotalEl = document.getElementById('subtotal');
  const vatEl = document.getElementById('vatAmount');
  const shippingEl = document.getElementById('shippingFee');
  const promoEl = document.getElementById('promoDiscount');
  const grandTotalEl = document.getElementById('grandTotal');

  const totalCount = cart.reduce((sum, item) => sum + Number(item.qty), 0);
  if (cartCount) cartCount.textContent = totalCount;

  if (!cartContainer) return;

  if (cart.length === 0) {
    cartContainer.innerHTML = `<p class="muted">No items in cart yet.</p>`;
    if (subtotalEl) subtotalEl.textContent = peso(0);
    if (vatEl) vatEl.textContent = peso(0);
    if (shippingEl) shippingEl.textContent = peso(0);
    if (promoEl) promoEl.textContent = `- ${peso(0)}`;
    if (grandTotalEl) grandTotalEl.textContent = peso(0);
    return;
  }

  cartContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-name">${item.name}</div>
      <div class="cart-item-price">${peso(item.price * item.qty)}</div>

      <div class="qty-row">
        <div class="qty-box">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <div class="qty-number">${item.qty}</div>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeItem(${item.id})">Remove</button>
      </div>
    </div>
  `).join('');

  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee(subtotal);
  const total = getGrandTotal();

  if (subtotalEl) subtotalEl.textContent = peso(subtotal);
  if (vatEl) vatEl.textContent = peso(vat);
  if (shippingEl) shippingEl.textContent = peso(shipping);
  if (promoEl) promoEl.textContent = `- ${peso(appliedPromo.discount || 0)}`;
  if (grandTotalEl) grandTotalEl.textContent = peso(total);
}

function changeQty(id, change) {
  const item = cart.find(i => Number(i.id) === Number(id));
  if (!item) return;

  item.qty += change;

  if (item.qty <= 0) {
    cart = cart.filter(i => Number(i.id) !== Number(id));
  }

  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter(item => Number(item.id) !== Number(id));
  saveCart();
  renderCart();
}

function renderOrders() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No orders yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.order_code}</td>
      <td>${String(order.order_date).slice(0, 10)}</td>
      <td><span class="status ${(order.status || '').toLowerCase()}">${order.status}</span></td>
      <td>${order.items} item(s)</td>
      <td>${peso(order.total)}</td>
      <td><button class="small-btn" onclick="viewOrderDetails(${order.id})">View Details</button></td>
    </tr>
  `).join('');
}

async function viewOrderDetails(orderId) {
  const order = orders.find(o => Number(o.id) === Number(orderId));
  if (!order) {
    alert('Order not found.');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/order-items/${order.id}`);

    if (!res.ok) {
      throw new Error('Failed to fetch order items');
    }

    const items = await res.json();

    const itemsText = Array.isArray(items) && items.length
      ? items.map(item => `- ${item.product_name} x${item.qty} (${peso(item.price)})`).join('\n')
      : 'No items found for this order.';

    alert(
      `Order Details\n\n` +
      `Order ID: ${order.order_code}\n` +
      `Date: ${String(order.order_date).slice(0, 10)}\n` +
      `Status: ${order.status}\n` +
      `Payment: ${order.payment_method}\n` +
      `Estimated Delivery: ${order.estimated_delivery || '2-3 days'}\n` +
      `Address: ${order.address || 'N/A'}\n\n` +
      `Items:\n${itemsText}\n\n` +
      `Subtotal: ${peso(order.subtotal || 0)}\n` +
      `VAT: ${peso(order.vat || 0)}\n` +
      `Shipping Fee: ${peso(order.shipping_fee || 0)}\n` +
      `Promo Discount: ${peso(order.promo_discount || 0)}\n` +
      `Total: ${peso(order.total)}`
    );
  } catch (error) {
    console.error('Failed to load order details:', error);
    alert('Failed to load order details.');
  }
}

function renderNotifications() {
  const wrap = document.getElementById('notificationsList');
  const notifCount = document.getElementById('notifCount');

  if (notifCount) {
    notifCount.textContent = notifications.length;
    notifCount.style.display = notifications.length > 0 ? 'flex' : 'none';
  }

  if (wrap) {
    wrap.innerHTML = !notifications.length
      ? `<div class="notification-card"><p class="muted">No notifications yet.</p></div>`
      : notifications.map(n => `
          <div class="notification-card">
            <h4>${n.title}</h4>
            <p class="muted">${n.message}</p>
            <small class="muted">${String(n.created_at).slice(0, 19).replace('T', ' ')}</small>
          </div>
        `).join('');
  }
}

function openCheckout() {
  if (cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.add('show');
}

function closeCheckout() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.remove('show');
}

function selectPayment(element, method) {
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.classList.remove('active');
  });

  element.classList.add('active');
  selectedPaymentMethod = method;
}

async function applyPromo() {
  const promoInput = document.getElementById('promoCode');
  const promoMsg = document.getElementById('promoMsg');

  if (!promoInput) return;

  const code = promoInput.value.trim();
  const subtotal = getCartSubtotal();

  try {
    const res = await fetch(`${API_URL}/api/promos/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    });

    const data = await res.json();

    if (data.valid) {
      appliedPromo.code = code;
      appliedPromo.discount = Number(data.discount || 0);

      if (promoMsg) {
        promoMsg.textContent = data.message;
        promoMsg.style.color = 'green';
      }
    } else {
      appliedPromo.code = '';
      appliedPromo.discount = 0;

      if (promoMsg) {
        promoMsg.textContent = data.message || 'Invalid promo.';
        promoMsg.style.color = 'red';
      }
    }

    renderCart();
  } catch (error) {
    console.error('Promo error:', error);
  }
}

async function placeOrder() {
  if (cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const addressInput = document.getElementById('checkoutAddress');
  const address = addressInput ? addressInput.value.trim() : '';

  if (!address) {
    alert('Please enter your delivery address.');
    return;
  }

  if (!currentUser || !currentUser.id) {
    alert('User session not found. Please log in again.');
    return;
  }

  const totalItems = cart.reduce((sum, item) => sum + Number(item.qty), 0);
  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee(subtotal);
  const total = getGrandTotal();
  const newOrderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    userId: Number(currentUser.id),
    order_code: newOrderId,
    order_date: today,
    status: 'Processing',
    items: totalItems,
    subtotal: Number(subtotal),
    vat: Number(vat),
    shipping_fee: Number(shipping),
    promo_code: appliedPromo.code || null,
    promo_discount: Number(appliedPromo.discount || 0),
    total: Number(total),
    payment_method: selectedPaymentMethod || 'GCash',
    address: address,
    cartItems: cart.map(item => ({
      id: Number(item.id),
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty)
    }))
  };

  try {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to place order');
    }

    showToastNotification(
      'Order Placed',
      `Your order ${newOrderId} has been placed successfully.`
    );

    cart = [];
    appliedPromo = { code: '', discount: 0 };
    clearCartStorage();
    renderCart();
    closeCheckout();
    closeCartDrawer();

    await loadOrders();
    await loadNotifications();

    showSection('ordersSection');

    if (addressInput) addressInput.value = '';
    const promoInput = document.getElementById('promoCode');
    if (promoInput) promoInput.value = '';
    const promoMsg = document.getElementById('promoMsg');
    if (promoMsg) promoMsg.textContent = '';
  } catch (error) {
    console.error('Place order error:', error);
    alert('Error placing order: ' + error.message);
  }
}

async function saveProfile() {
  const fullName = document.getElementById('profileFullName')?.value.trim();
  const email = document.getElementById('profileEmail')?.value.trim();

  if (!fullName || !email) {
    alert('Please fill in full name and email.');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/user/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullname: fullName,
        email
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to save profile');
    }

    currentUser.fullname = fullName;
    currentUser.email = email;
    localStorage.setItem('user', JSON.stringify(currentUser));

    showToastNotification('Profile Updated', data.message || 'Profile updated successfully.');
    await loadProfile();
    await loadNotifications();
  } catch (error) {
    console.error('Save profile error:', error);
    alert(error.message);
  }
}

async function changePassword() {
  const currentPassword = document.getElementById('currentPassword')?.value;
  const newPassword = document.getElementById('newPassword')?.value;

  if (!currentPassword || !newPassword) {
    alert('Please fill in current and new password.');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/user/${currentUser.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to update password');
    }

    showToastNotification('Password Updated', data.message || 'Password updated successfully.');

    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');

    if (currentPasswordInput) currentPasswordInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';

    await loadNotifications();
  } catch (error) {
    console.error('Password change error:', error);
    alert(error.message);
  }
}

function updatePromo() {
  const promoBg = document.getElementById('promoBg');
  if (!promoBg) return;

  promoBg.style.backgroundImage = `url('${promoSlides[currentSlide].image}')`;

  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
  });
}

function goToSlide(index) {
  currentSlide = index;
  updatePromo();
}

function autoPromo() {
  currentSlide = (currentSlide + 1) % promoSlides.length;
  updatePromo();
}

function openCartDrawer() {
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');

  if (cartDrawer) cartDrawer.classList.add('show');
  if (cartOverlay) cartOverlay.classList.add('show');
}

function closeCartDrawer() {
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');

  if (cartDrawer) cartDrawer.classList.remove('show');
  if (cartOverlay) cartOverlay.classList.remove('show');
}

function closeDropdowns() {
  const accountDropdown = document.getElementById('accountDropdown');
  if (accountDropdown) accountDropdown.classList.remove('show');
}

function logoutUser() {
  localStorage.removeItem('user');
  alert('Logged out successfully!');
  window.location.href = 'index.html';
}

function scrollToContact() {
  const footer = document.getElementById('contactFooter');
  if (footer) {
    footer.scrollIntoView({ behavior: 'smooth' });
  }
}

function showToastNotification(title, message, duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `
    <div class="toast-icon">🔔</div>
    <div class="toast-content">
      <h4>${title || 'Notification'}</h4>
      <p>${message || ''}</p>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 50);

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
      toast.remove();
    }, 400);
  }, duration);
}

document.addEventListener('DOMContentLoaded', function () {
  const accountToggle = document.getElementById('accountToggle');
  const accountDropdown = document.getElementById('accountDropdown');
  const cartToggle = document.getElementById('cartToggle');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const productSearch = document.getElementById('productSearch');
  const productSearch2 = document.getElementById('productSearch2');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const notifToggle = document.getElementById('notifToggle');

  if (notifToggle) {
    notifToggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showSection('notificationsSection');
      if (accountDropdown) accountDropdown.classList.remove('show');
      closeCartDrawer();
    });
  }

  loadCartStorage();
  renderCart();

  if (accountToggle) {
    accountToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (accountDropdown) accountDropdown.classList.toggle('show');
      closeCartDrawer();
    });
  }

  if (cartToggle) {
    cartToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      openCartDrawer();
      if (accountDropdown) accountDropdown.classList.remove('show');
    });
  }

  document.addEventListener('click', function (e) {
    if (accountDropdown && accountToggle) {
      if (!accountDropdown.contains(e.target) && !accountToggle.contains(e.target)) {
        accountDropdown.classList.remove('show');
      }
    }
  });

  if (cartOverlay) cartOverlay.addEventListener('click', closeCartDrawer);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartDrawer);
  if (productSearch) productSearch.addEventListener('input', renderProducts);
  if (productSearch2) productSearch2.addEventListener('input', renderProducts);
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);
  if (changePasswordBtn) changePasswordBtn.addEventListener('click', changePassword);

  updatePromo();
  setInterval(autoPromo, 4000);

  loadProducts();
  loadOrders();
  loadNotifications();
  loadProfile();
});

window.placeOrder = placeOrder;
window.changeQty = changeQty;
window.removeItem = removeItem;
window.openCheckout = openCheckout;
window.closeCheckout = closeCheckout;
window.selectPayment = selectPayment;
window.goToSlide = goToSlide;
window.showSection = showSection;
window.filterProducts = filterProducts;
window.viewOrderDetails = viewOrderDetails;
window.scrollToContact = scrollToContact;
window.logoutUser = logoutUser;
window.setTopNav = setTopNav;
window.applyPromo = applyPromo;