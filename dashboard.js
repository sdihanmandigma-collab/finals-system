const API_URL = 'http://localhost:5055';

let products = [];
let orders = [];
let notifications = [];
let payments = [];
let addresses = [];
let barangays = [];
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
    currentCategory = 'all';

    const productSearch = document.getElementById('productSearch');
    const productSearch2 = document.getElementById('productSearch2');

    if (productSearch) productSearch.value = '';
    if (productSearch2) productSearch2.value = '';

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
async function markAllNotificationsAsRead() {
  try {
    await fetch(`${API_URL}/api/notifications/${currentUser.id}/read-all`, {
      method: 'PUT'
    });

    notifications = notifications.map(n => ({
      ...n,
      is_read: 1
    }));

    renderNotifications();
  } catch (error) {
    console.error('Failed to mark notifications as read:', error);
  }
}
async function loadPayments() {
  try {
    const res = await fetch(`${API_URL}/api/payments/${currentUser.id}`);
    const data = await res.json();

    payments = Array.isArray(data) ? data : [];
    renderPayments();
  } catch (error) {
    console.error('Failed to load payments:', error);
    payments = [];
    renderPayments();
  }
}

function renderPayments() {
  const wrap = document.getElementById('paymentsList');
  if (!wrap) return;

  if (!payments.length) {
    wrap.innerHTML = `<p class="muted">No payments yet.</p>`;
    return;
  }

  wrap.innerHTML = payments.map(payment => `
    <div class="payment-history-item" style="padding:12px 0; border-bottom:1px solid #eee;">
      <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:700; color:#2f2a24;">${payment.payment_method}</div>
          <div class="muted" style="font-size:.95rem;">
            Ref: ${payment.reference_number || 'N/A'}
          </div>
          <div class="muted" style="font-size:.95rem;">
            Date: ${String(payment.created_at).slice(0, 19).replace('T', ' ')}
          </div>
        </div>

        <div style="text-align:right;">
          <div style="font-weight:700; color:#2f2a24;">${peso(payment.amount)}</div>
          <div class="status ${String(payment.payment_status || '')
            .toLowerCase()
            .replace(/\s+/g, '-')}">
            ${payment.payment_status || 'Pending'}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/api/user/${currentUser.id}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to load profile');
    }

    const fullNameInput = document.getElementById('profileFullName');
    const emailInput = document.getElementById('profileEmail');
    const roleInput = document.getElementById('profileRole');
    const statusInput = document.getElementById('profileStatus');
    const avatar = document.querySelector('.account-avatar');
    const accountName = document.getElementById('accountName');

    if (fullNameInput) fullNameInput.value = data.fullname || '';
    if (emailInput) emailInput.value = data.email || '';
    if (roleInput) roleInput.value = data.role || '';
    if (statusInput) statusInput.value = data.status || '';
    if (avatar) avatar.textContent = getInitials(data.fullname);
    if (accountName) accountName.textContent = data.fullname || 'My Account';

  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

async function loadAddresses() {
  try {
    const res = await fetch(`${API_URL}/api/addresses/${currentUser.id}`);
    const data = await res.json();

    addresses = Array.isArray(data) ? data : [];
    renderAddresses();
    fillCheckoutAddress();
  } catch (error) {
    console.error('Failed to load addresses:', error);
    addresses = [];
    renderAddresses();
    fillCheckoutAddress();
  }
}
async function loadBarangays() {
  try {
    const res = await fetch(`${API_URL}/api/barangays`);
    const data = await res.json();

    barangays = Array.isArray(data) ? data : [];

    const barangaySelect = document.getElementById('addrBarangay');
    if (barangaySelect) {
      barangaySelect.innerHTML = `
        <option value="">Select Barangay</option>
        ${barangays.map(b => `
          <option value="${b.barangay_name}" data-fee="${b.shipping_fee}">
            ${b.barangay_name} - ₱${Number(b.shipping_fee || 0).toFixed(2)}
          </option>
        `).join('')}
      `;
    }
  } catch (error) {
    console.error('Failed to load barangays:', error);
  }
}

function renderAddresses() {
  const list = document.getElementById('addressList');
  if (!list) return;

  if (!addresses.length) {
    list.innerHTML = `<p class="muted">No saved addresses yet.</p>`;
    return;
  }

  list.innerHTML = addresses.map(addr => `
    <div class="address-card ${addr.is_default ? 'default-address' : ''}">
      <div class="address-top">
        <div>
          <h4>
            ${addr.full_name}
            ${addr.is_default ? `<span class="default-badge">Default</span>` : ''}
          </h4>
          <p class="muted">
            ${addr.house_no ? addr.house_no + ', ' : ''}
            ${addr.street ? addr.street + ', ' : ''}
            ${addr.barangay}, ${addr.municipality}, ${addr.province}
            ${addr.postal_code ? ', ' + addr.postal_code : ''}
          </p>
          <p class="muted">${addr.phone}</p>
          ${addr.landmark ? `<p class="muted">Landmark: ${addr.landmark}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function saveAddress(e) {
  e.preventDefault();

  const payload = {
  user_id: currentUser.id,
  full_name: document.getElementById('addrFullName')?.value.trim(),
  phone: document.getElementById('addrPhone')?.value.trim(),
  house_no: document.getElementById('addrHouseNo')?.value.trim(),
  street: document.getElementById('addrStreet')?.value.trim(),
  barangay: document.getElementById('addrBarangay')?.value,
  municipality: 'San Jose',
  province: 'Batangas',
  postal_code: document.getElementById('addrPostalCode')?.value.trim(),
  landmark: document.getElementById('addrLandmark')?.value.trim(),

};

  const msg = document.getElementById('addressMsg');

  if (!payload.full_name || !payload.phone || !payload.barangay) {
    if (msg) {
      msg.textContent = 'Please fill in all required address fields.';
      msg.style.color = 'red';
    }
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to save address');
    }

    if (msg) {
      msg.textContent = data.message || 'Address saved successfully.';
      msg.style.color = 'green';
    }

    const form = document.getElementById('addressForm');
    if (form) form.reset();

    await loadAddresses();
  } catch (error) {
    console.error('Save address error:', error);
    if (msg) {
      msg.textContent = error.message || 'Failed to save address.';
      msg.style.color = 'red';
    }
  }
}

function fillCheckoutAddress() {
  const checkoutAddress = document.getElementById('checkoutAddress');
  if (!checkoutAddress) return;

  const defaultAddress = addresses.find(addr => Number(addr.is_default) === 1) || addresses[0];

  if (!defaultAddress) {
    checkoutAddress.value = '';
    return;
  }

  checkoutAddress.value =
    `${defaultAddress.house_no ? defaultAddress.house_no + ', ' : ''}` +
    `${defaultAddress.street ? defaultAddress.street + ', ' : ''}` +
    `${defaultAddress.barangay}, ${defaultAddress.municipality}, ${defaultAddress.province}` +
    `${defaultAddress.postal_code ? ', ' + defaultAddress.postal_code : ''}`;
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
  if (target) {
    target.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const search = productSearch ? productSearch.value.toLowerCase().trim() : '';

  console.log('products before filter:', products);
  console.log('currentCategory:', currentCategory);
  console.log('search:', search);

  const filtered = products.filter(product => {
    const productCategory = String(product.category || '').toLowerCase().trim();
    const productName = String(product.name || '').toLowerCase().trim();

    const categoryMatch = currentCategory === 'all' || productCategory === currentCategory;
    const searchMatch = productName.includes(search) || productCategory.includes(search);

    return categoryMatch && searchMatch;
  });

  console.log('filtered products:', filtered);

  const html = filtered.map(product => {
    const originalPrice = Number(product.price);
    const finalPrice = getDiscountedPrice(originalPrice);
const imageSrc = product.image ? `img/${product.image}` : '';
    const stock = Number(product.stock || 0);
    const categoryText = product.category || 'General';

    return `
      <div class="product-card premium-card">
        <div class="product-card-top">
          <span class="product-category-badge">${categoryText}</span>
          ${isEmployee() ? `<span class="discount-badge">10% OFF</span>` : ''}
        </div>

        <div class="product-image premium-image">
          ${
            imageSrc
              ? `<img src="${imageSrc}" alt="${product.name}" onerror="this.parentElement.innerHTML='<div class=&quot;product-placeholder&quot;>📦</div>';">`
              : `<div class="product-placeholder">📦</div>`
          }
        </div>

        <div class="product-info">
          <div class="product-name premium-name">${product.name}</div>

          <div class="product-stock ${stock > 0 ? 'in-stock' : 'out-stock'}">
            ${stock > 0 ? `In Stock • ${stock} available` : 'Out of Stock'}
          </div>

          <div class="product-price premium-price">
            ${
              isEmployee()
                ? `
                  <span class="old-price">${peso(originalPrice)}</span>
                  <span class="new-price">${peso(finalPrice)}</span>
                `
                : `<span class="normal-price">${peso(originalPrice)}</span>`
            }
          </div>

          <button class="order-btn premium-btn" data-id="${product.id}" ${stock <= 0 ? 'disabled' : ''}>
            <span>🛒</span>
            <span>${stock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
          </button>
        </div>
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

  const stock = Number(product.stock || 0);

  if (stock <= 0) {
    showToastNotification(
      'Out of Stock',
      `${product.name} is currently unavailable.`
    );
    return;
  }

  const discountedPrice = getDiscountedPrice(product.price);
  const existing = cart.find(item => Number(item.id) === Number(productId));

  if (existing) {
    if (existing.qty >= stock) {
      showToastNotification(
        'Stock Limit Reached',
        `Only ${stock} item(s) available for ${product.name}.`
      );
      return;
    }

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

  showToastNotification(
    'Added to Cart',
    `${product.name} has been added to your cart.`
  );
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
}

function getVat(subtotal) {
  return subtotal * 0.12;
}

function getShippingFee() {
  const defaultAddress = addresses.find(addr => Number(addr.is_default) === 1) || addresses[0];
  if (!defaultAddress) return 0;

  const matchedBarangay = barangays.find(
    b => String(b.barangay_name).toLowerCase() === String(defaultAddress.barangay).toLowerCase()
  );

  return matchedBarangay ? Number(matchedBarangay.shipping_fee || 0) : 0;
}

function getGrandTotal() {
  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
 const shipping = getShippingFee()
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

cartContainer.innerHTML = cart.map(item => {
  const originalPrice = Number(item.originalPrice ?? item.price);
  const discountedPrice = Number(item.price);
  const lineTotal = discountedPrice * item.qty;
  const hasDiscount = originalPrice > discountedPrice;

  return `
    <div class="cart-item">
      <div class="cart-item-name">${item.name}</div>

      <div class="cart-item-price">
        ${
          hasDiscount
            ? `
              <div class="cart-old-price">${peso(originalPrice)}</div>
              <div class="cart-new-price">${peso(discountedPrice)}</div>
              <div class="cart-line-total">Qty: ${item.qty} • Total: ${peso(lineTotal)}</div>
            `
            : `
              <div class="cart-normal-price">${peso(discountedPrice)}</div>
              <div class="cart-line-total">Qty: ${item.qty} • Total: ${peso(lineTotal)}</div>
            `
        }
      </div>

      <div class="qty-row">
        <div class="qty-box">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <div class="qty-number">${item.qty}</div>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeItem(${item.id})">Remove</button>
      </div>
    </div>
  `;
}).join('');

  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee()
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

  const product = products.find(p => Number(p.id) === Number(id));
  const stock = Number(product?.stock || 0);

  const newQty = item.qty + change;

  if (newQty <= 0) {
    cart = cart.filter(i => Number(i.id) !== Number(id));
    saveCart();
    renderCart();
    return;
  }

  if (newQty > stock) {
    showToastNotification(
      'Stock Limit Reached',
      `Only ${stock} item(s) available for ${item.name}.`
    );
    return;
  }

  item.qty = newQty;

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
    showToastNotification('Error', 'Order not found.');
    return;
  }

  try {
    const itemsRes = await fetch(`${API_URL}/api/order-items/${order.id}`);
    if (!itemsRes.ok) {
      throw new Error('Failed to fetch order items');
    }

    const items = await itemsRes.json();

    const historyRes = await fetch(`${API_URL}/api/order-status-history/${order.id}`);
    if (!historyRes.ok) {
      throw new Error('Failed to fetch order status history');
    }

    const history = await historyRes.json();

    const content = document.getElementById('orderDetailsContent');
    const modal = document.getElementById('orderDetailsModal');

    if (!content || !modal) return;

    const itemsHtml = Array.isArray(items) && items.length
  ? items.map(item => `
      <div class="order-item-row clean-row">
        <div>
          <div class="order-item-name">${item.product_name}</div>
          <div class="order-item-meta">Quantity: ${item.qty}</div>
        </div>
        <div class="order-item-price">${peso(item.price)}</div>
      </div>
    `).join('')
  : `<p class="muted">No items found for this order.</p>`;`<p class="muted">No items found for this order.</p>`;

    const historyHtml = Array.isArray(history) && history.length
  ? history.map(entry => `
      <div class="history-card">
        <div class="history-top">
          <span class="history-status">${entry.status}</span>
          <span class="history-date">${String(entry.changed_at).slice(0, 19).replace('T', ' ')}</span>
        </div>
        <div class="history-note">${entry.notes || 'No notes provided.'}</div>
      </div>
    `).join('')
  : `<p class="muted">No status history yet.</p>`;

   content.innerHTML = `
  <div class="order-details-block">
    <h4>Order Information</h4>
    <div class="order-details-grid">
      <p><strong>Order ID:</strong> ${order.order_code}</p>
      <p><strong>Date:</strong> ${String(order.order_date).slice(0, 10)}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <p><strong>Payment:</strong> ${order.payment_method}</p>
      <p><strong>Estimated Delivery:</strong> ${order.estimated_delivery || '2-3 days'}</p>
      <p class="full-width"><strong>Address:</strong> ${order.address || 'N/A'}</p>
    </div>
  </div>

  <div class="order-details-block">
    <h4>Ordered Items</h4>
    <div class="order-items-wrap">
      ${itemsHtml}
    </div>
  </div>

  <div class="order-details-block">
    <h4>Status History</h4>
    <div class="history-wrap">
      ${historyHtml}
    </div>
  </div>

  <div class="order-details-block order-total-box">
    <h4>Payment Summary</h4>
    <div class="order-details-grid">
      <p><strong>Subtotal:</strong> ${peso(order.subtotal || 0)}</p>
      <p><strong>VAT:</strong> ${peso(order.vat || 0)}</p>
      <p><strong>Shipping Fee:</strong> ${peso(order.shipping_fee || 0)}</p>
      <p><strong>Promo Discount:</strong> ${peso(order.promo_discount || 0)}</p>
      <p><strong>Total:</strong> ${peso(order.total || 0)}</p>
    </div>
  </div>
`;

    modal.classList.add('show');
  } catch (error) {
    console.error('Failed to load order details:', error);
    showToastNotification('Error', 'Failed to load order details.');
  }
}

function renderNotifications() {
  const wrap = document.getElementById('notificationsList');
  const notifCount = document.getElementById('notifCount');

if (notifCount) {
  const unreadCount = notifications.filter(n => Number(n.is_read) === 0).length;
  notifCount.textContent = unreadCount;
  notifCount.style.display = unreadCount > 0 ? 'flex' : 'none';
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

  fillCheckoutAddress();

  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.add('show');

  const gcashDetails = document.getElementById('gcashDetails');
  if (gcashDetails) {
    gcashDetails.style.display = selectedPaymentMethod === 'GCash' ? 'block' : 'none';
  }
}

function closeOrderDetailsModal() {
  const modal = document.getElementById('orderDetailsModal');
  if (modal) modal.classList.remove('show');
}

function selectPayment(element, method) {
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.classList.remove('active');
  });

  element.classList.add('active');
  selectedPaymentMethod = method;

  const gcashDetails = document.getElementById('gcashDetails');
  if (gcashDetails) {
    gcashDetails.style.display = method === 'GCash' ? 'block' : 'none';
  }
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

  const gcashSenderName = document.getElementById('gcashSenderName')?.value.trim() || '';
  const gcashReference = document.getElementById('gcashReference')?.value.trim() || '';

  if (selectedPaymentMethod === 'GCash') {
    if (!gcashSenderName || !gcashReference) {
      alert('Please enter your GCash full name and reference number.');
      return;
    }
  }

  const totalItems = cart.reduce((sum, item) => sum + Number(item.qty), 0);
  const subtotal = getCartSubtotal();
  const vat = getVat(subtotal);
  const shipping = getShippingFee();
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
    gcash_sender_name: selectedPaymentMethod === 'GCash' ? gcashSenderName : null,
    gcash_reference: selectedPaymentMethod === 'GCash' ? gcashReference : null,
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
    await loadPayments();
    await loadProducts();

    showSection('ordersSection');

    if (addressInput) addressInput.value = '';

    const promoInput = document.getElementById('promoCode');
    if (promoInput) promoInput.value = '';

    const promoMsg = document.getElementById('promoMsg');
    if (promoMsg) promoMsg.textContent = '';

    const gcashSenderInput = document.getElementById('gcashSenderName');
    const gcashReferenceInput = document.getElementById('gcashReference');
    if (gcashSenderInput) gcashSenderInput.value = '';
    if (gcashReferenceInput) gcashReferenceInput.value = '';
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
function openLogoutModal() {
  const modal = document.getElementById('logoutModal');
  if (modal) modal.classList.add('show');
}

function closeLogoutModal() {
  const modal = document.getElementById('logoutModal');
  if (modal) modal.classList.remove('show');
}

function confirmLogout() {
  localStorage.removeItem('user');

  showToastNotification(
    'Logged Out',
    'You have been logged out successfully.'
  );

  closeLogoutModal();

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1200);
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
  openLogoutModal();
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
    const addressForm = document.getElementById('addressForm');
    
      const orderDetailsModal = document.getElementById('orderDetailsModal');
      currentCategory = 'all';

if (productSearch) productSearch.value = '';
if (productSearch2) productSearch2.value = '';
  if (orderDetailsModal) {
    orderDetailsModal.addEventListener('click', function (e) {
      if (e.target === orderDetailsModal) {
        closeOrderDetailsModal();
      }
    });
  }
    const logoutModal = document.getElementById('logoutModal');

  if (logoutModal) {
    logoutModal.addEventListener('click', function(e) {
      if (e.target === logoutModal) {
        closeLogoutModal();
      }
    });
  }


 if (notifToggle) {
  notifToggle.addEventListener('click', async function (e) {
    e.preventDefault();
    e.stopPropagation();
    showSection('notificationsSection');
    if (accountDropdown) accountDropdown.classList.remove('show');
    closeCartDrawer();
    await markAllNotificationsAsRead();
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
    if (addressForm) addressForm.addEventListener('submit', saveAddress);
   
  updatePromo();
  setInterval(autoPromo, 4000);
  loadProducts();
  loadOrders();
  loadNotifications();
  loadPayments();
  loadProfile();
  loadAddresses();
  loadBarangays();

});
function closeCheckout() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.remove('show');
}


  list.innerHTML = products.map(product => `
    <div class="address-card">
      <div class="address-top">
        <div>
          <h4>${product.name}</h4>
          <p class="muted">Category: ${product.category}</p>
          <p class="muted">Price: ${peso(product.price)}</p>
          <p class="muted">Stock: ${product.stock}</p>
          <p class="muted">Description: ${product.description || 'N/A'}</p>
          <p class="muted">Image: ${product.image || 'N/A'}</p>
        </div>
      </div>
    </div>
  `).join('');

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
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.openLogoutModal = openLogoutModal;
window.closeLogoutModal = closeLogoutModal;
window.confirmLogout = confirmLogout;