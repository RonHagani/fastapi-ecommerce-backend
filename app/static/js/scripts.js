// ==========================================
//  GLOBAL VARIABLES & INITIALIZATION
// ==========================================

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let productToDeleteId = null;
let searchTimeout = null;

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    checkLoginStatus();
    updateCartUI();

    // Browser Back Button Logic
    window.onpopstate = function(event) {
        if (event.state && event.state.view === 'product') {
            viewProduct(event.state.id, false);
        } else if (event.state && event.state.view === 'profile') {
            openProfile(false);
        } else {
            backToGallery(false);
        }
    };

    // Close search dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!document.querySelector('.search-container').contains(e.target)) {
            document.getElementById('search-results-dropdown').style.display = 'none';
        }
    });
});

// ==========================================
//  SHOPPING CART LOGIC
// ==========================================

function toggleCart() {
    const cartEl = document.getElementById('cartOffcanvas');
    if (typeof bootstrap !== 'undefined') {
        bootstrap.Offcanvas.getOrCreateInstance(cartEl).toggle();
    }
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url,
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();

    // Automatically open cart to show feedback
    const cartEl = document.getElementById('cartOffcanvas');
    if (typeof bootstrap !== 'undefined' && cartEl) {
        bootstrap.Offcanvas.getOrCreateInstance(cartEl).show();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

function changeQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        saveCart();
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

function updateCartUI() {
    const container = document.getElementById("cart-items-container");
    const totalEl = document.getElementById("cart-total");
    const badge = document.getElementById("cart-badge");
    const footer = document.getElementById("cart-footer");

    // Update Badge
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.innerText = totalCount;
        badge.style.display = totalCount > 0 ? "block" : "none";
    }

    // Handle Empty Cart
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center mt-5 text-muted">
                <i class="fas fa-shopping-basket fa-4x mb-4 text-secondary opacity-25"></i>
                <h5 class="fw-bold text-dark">Your cart is empty</h5>
                <p class="small mb-4">Looks like you haven't added anything yet.</p>
                <button class="btn btn-primary rounded-pill px-4 py-2 shadow-sm fw-bold" data-bs-dismiss="offcanvas">
                    Start Shopping
                </button>
            </div>`;
        if (totalEl) totalEl.innerText = "$0.00";
        if (footer) footer.classList.add('opacity-50', 'pe-none');
        return;
    }

    // Render Items
    if (footer) footer.classList.remove('opacity-50', 'pe-none');
    container.innerHTML = "";
    let totalPrice = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        totalPrice += itemTotal;
        const image = item.image || "https://via.placeholder.com/100";

        container.innerHTML += `
            <div class="card mb-3 border-0 shadow-sm">
                <div class="row g-0 align-items-center">
                    <div class="col-3 p-2">
                        <img src="${image}" class="img-fluid rounded" style="object-fit: contain; height: 60px; width: 100%;">
                    </div>
                    <div class="col-9">
                        <div class="card-body p-2">
                            <div class="d-flex justify-content-between mb-1">
                                <h6 class="card-title mb-0 text-truncate" style="max-width: 130px;">${item.name}</h6>
                                <button class="btn btn-link text-danger p-0" onclick="removeFromCart(${item.id})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="btn-group btn-group-sm border rounded">
                                    <button class="btn btn-light px-2" onclick="changeQuantity(${item.id}, -1)">-</button>
                                    <span class="btn btn-light disabled fw-bold text-dark px-2 bg-white">${item.quantity}</span>
                                    <button class="btn btn-light px-2" onclick="changeQuantity(${item.id}, 1)">+</button>
                                </div>
                                <span class="fw-bold text-primary">$${itemTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    if (totalEl) totalEl.innerText = "$" + totalPrice.toFixed(2);
}

async function checkout() {
    const token = localStorage.getItem("token");

    if (!token) {
        bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas')).hide();
        new bootstrap.Modal(document.getElementById('loginModal')).show();
        return;
    }

    if (cart.length === 0) return;

    let productIds = [];
    cart.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            productIds.push(item.id);
        }
    });

    try {
        const response = await fetch("/orders/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ product_ids: productIds })
        });

        if (response.ok) {
            alert("Order placed successfully!");
            cart = [];
            saveCart();
            updateCartUI();
            bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas')).hide();
            openProfile();
        } else {
            alert("Failed to place order.");
        }
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
//  SEARCH & FILTERS
// ==========================================

function handleSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    if (!query || query.trim().length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/products/?search=${encodeURIComponent(query)}`);
            const results = await response.json();
            dropdown.innerHTML = '';

            if (results.length === 0) {
                dropdown.innerHTML = '<div class="p-3 text-muted text-center">No matching products found.</div>';
            } else {
                results.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'search-item';
                    div.onclick = () => {
                        viewProduct(p.id);
                        dropdown.style.display = 'none';
                        document.getElementById('global-search').value = '';
                    };
                    div.innerHTML = `
                        <img src="${p.image_url || 'https://via.placeholder.com/50'}" alt="${p.name}">
                        <div>
                            <div class="fw-bold small">${p.name}</div>
                            <div class="text-primary small">$${p.price}</div>
                        </div>`;
                    dropdown.appendChild(div);
                });
            }
            dropdown.style.display = 'block';
        } catch (e) {
            console.error(e);
        }
    }, 300);
}

async function filterCategory(category, element) {
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    document.getElementById("page-title").innerText = category ? category : "All Products";
    loadProducts(category);
    backToGallery(true);
}

async function loadProducts(category = null) {
    const container = document.getElementById("products-container");
    const token = localStorage.getItem("token");

    let url = "/products/";
    if (category && category !== "All Products") {
        url += `?category=${encodeURIComponent(category)}`;
    }

    try {
        const response = await fetch(url);
        const products = await response.json();
        allProducts = products;
        container.innerHTML = "";

        if (products.length === 0) {
            container.innerHTML = `<div class="col-12 text-center mt-5 text-muted">No products found.</div>`;
            return;
        }

        products.forEach(product => {
            const image = product.image_url || "https://via.placeholder.com/300x300?text=No+Image";
            let adminButtons = "";

            if (token) {
                adminButtons = `
                    <div class="d-flex gap-2" onclick="event.stopPropagation()"> 
                        <button class="btn btn-sm btn-light rounded-circle shadow-sm" onclick="openEditModal(${product.id})">
                            <i class="fas fa-pencil-alt text-warning"></i>
                        </button>
                        <button class="btn btn-sm btn-light rounded-circle shadow-sm" onclick="askDeleteConfirmation(${product.id})">
                            <i class="fas fa-trash-alt text-danger"></i>
                        </button>
                    </div>`;
            }

            const specs = product.specs ? `<small class="text-muted d-block mb-1"><i class="fas fa-info-circle me-1"></i>${product.specs}</small>` : '';

            container.innerHTML += `
                <div class="col-md-3 col-sm-6">
                    <div class="product-card h-100 d-flex flex-column" onclick="viewProduct(${product.id})">
                        <img src="${image}" class="card-img-top">
                        <div class="p-3 flex-grow-1 d-flex flex-column">
                            <div class="mb-1">
                                <span class="badge bg-light text-dark border">${product.category || 'General'}</span>
                            </div>
                            <h6 class="fw-bold mb-1 text-truncate" title="${product.name}">${product.name}</h6>
                            ${specs}
                            <div class="mt-auto pt-3 d-flex justify-content-between align-items-center">
                                <span class="fw-bold text-primary">$${product.price}</span>
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-primary btn-sm rounded-pill px-3 me-2" onclick="event.stopPropagation(); addToCart(${product.id})">
                                        <i class="fas fa-cart-plus"></i>
                                    </button>
                                    ${adminButtons}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
//  VIEWS & NAVIGATION
// ==========================================

function viewProduct(id, pushState = true) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById("view-name").innerText = product.name;
    document.getElementById("breadcrumb-name").innerText = product.name;
    document.getElementById("view-specs").innerText = product.specs || "";
    document.getElementById("view-desc").innerText = product.description || "";
    document.getElementById("view-price").innerText = "$" + product.price;
    document.getElementById("view-stock").innerText = product.stock;
    document.getElementById("view-category").innerText = product.category || "General";
    document.getElementById("view-img").src = product.image_url || "https://via.placeholder.com/400";

    const actions = document.getElementById("single-product-actions");
    if (actions) {
        actions.innerHTML = `
            <button class="btn btn-primary btn-lg px-5 rounded-pill shadow-sm" onclick="addToCart(${product.id})">
                <i class="fas fa-cart-plus me-2"></i> Add to Cart
            </button>
            <button class="btn btn-outline-secondary btn-lg px-4 rounded-pill ms-2" onclick="backToGallery(true)">
                Back
            </button>`;
    }

    document.getElementById("main-view").classList.add("d-none");
    document.getElementById("profile-view").classList.add("d-none");
    document.getElementById("single-product-view").classList.remove("d-none");
    window.scrollTo(0, 0);

    if (pushState) history.pushState({view: 'product', id: id}, '', `#product-${id}`);
}

function openProfile(pushState = true) {
    const token = localStorage.getItem("token");
    if (!token) return;

    document.getElementById("main-view").classList.add("d-none");
    document.getElementById("single-product-view").classList.add("d-none");
    document.getElementById("profile-view").classList.remove("d-none");

    if (pushState) history.pushState({view: 'profile'}, '', '#profile');

    fetch("/auth/me", { headers: { "Authorization": `Bearer ${token}` } })
        .then(res => res.json())
        .then(user => {
            document.getElementById("profile-email").innerText = user.email;

            if (user.address) {
                document.getElementById("addrStreet").value = user.address.street || "";
                document.getElementById("addrCity").value = user.address.city || "";
                document.getElementById("addrZip").value = user.address.zip_code || "";
            }

            const tbody = document.getElementById("orders-table-body");
            tbody.innerHTML = "";
            const noOrdersMsg = document.getElementById("no-orders-msg");

            if (user.orders && user.orders.length > 0) {
                noOrdersMsg.classList.add('d-none');
                user.orders.forEach(order => {
                    let statusBadge = `<span class="badge bg-secondary">${order.status}</span>`;
                    let actionBtn = `<button class="btn btn-sm btn-light disabled">None</button>`;

                    if (order.status === 'Processing') {
                        statusBadge = `<span class="badge bg-warning text-dark">Processing</span>`;
                        actionBtn = `<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="cancelOrder(${order.id})">Cancel</button>`;
                    } else if (order.status === 'Cancelled') {
                        statusBadge = `<span class="badge bg-danger">Cancelled</span>`;
                        actionBtn = `<span class="text-muted small">Cancelled</span>`;
                    }

                    tbody.innerHTML += `
                        <tr>
                            <td>#${order.id}</td>
                            <td>${new Date(order.created_at).toLocaleDateString()}</td>
                            <td>${statusBadge}</td>
                            <td>$${order.total_price.toFixed(2)}</td>
                            <td>${actionBtn}</td>
                        </tr>`;
                });
            } else {
                noOrdersMsg.classList.remove('d-none');
            }
        }).catch(e => console.error(e));
}

async function cancelOrder(orderId) {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    const token = localStorage.getItem("token");

    try {
        const response = await fetch(`/orders/${orderId}/cancel`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            alert("Order cancelled successfully.");
            openProfile(false); // Refresh profile
        } else {
            const err = await response.json();
            alert("Error: " + err.detail);
        }
    } catch (e) {
        console.error(e);
    }
}

function backToGallery(pushState = true) {
    document.getElementById("single-product-view").classList.add("d-none");
    document.getElementById("profile-view").classList.add("d-none");
    document.getElementById("main-view").classList.remove("d-none");
    if (pushState) history.pushState({view: 'gallery'}, '', ' ');
}

// ==========================================
//  CRUD OPERATIONS
// ==========================================

function openAddProductModal() {
    new bootstrap.Modal(document.getElementById("addProductModal")).show();
}

async function saveProduct() {
    const token = localStorage.getItem("token");
    if (!token) return handleSessionExpired();

    const category = document.getElementById("prodCategory").value;
    const data = {
        name: document.getElementById("prodName").value,
        description: document.getElementById("prodDesc").value,
        specs: document.getElementById("prodSpecs").value,
        price: parseFloat(document.getElementById("prodPrice").value),
        stock: parseInt(document.getElementById("prodStock").value),
        image_url: document.getElementById("prodImage").value,
        category: category
    };

    const res = await fetch("/products/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        document.getElementById("prodName").value = "";
        document.getElementById("prodDesc").value = "";
        document.getElementById("prodSpecs").value = "";
        document.getElementById("prodPrice").value = "";
        document.getElementById("prodStock").value = "";
        document.getElementById("prodImage").value = "";

        bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
        alert("Added!");
        loadProducts(category === "All Products" ? null : category);
    } else {
        alert("Error adding");
    }
}

function openEditModal(id) {
    const p = allProducts.find(x => x.id === id);
    document.getElementById("editProdId").value = p.id;
    document.getElementById("editProdName").value = p.name;
    document.getElementById("editProdCategory").value = p.category;
    document.getElementById("editProdSpecs").value = p.specs || "";
    document.getElementById("editProdDesc").value = p.description;
    document.getElementById("editProdPrice").value = p.price;
    document.getElementById("editProdStock").value = p.stock;
    document.getElementById("editProdImage").value = p.image_url;

    new bootstrap.Modal(document.getElementById("editProductModal")).show();
}

async function updateProduct() {
    const id = document.getElementById("editProdId").value;
    const token = localStorage.getItem("token");
    const data = {
        name: document.getElementById("editProdName").value,
        category: document.getElementById("editProdCategory").value,
        specs: document.getElementById("editProdSpecs").value,
        description: document.getElementById("editProdDesc").value,
        price: parseFloat(document.getElementById("editProdPrice").value),
        stock: parseInt(document.getElementById("editProdStock").value),
        image_url: document.getElementById("editProdImage").value
    };

    await fetch(`/products/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });

    bootstrap.Modal.getInstance(document.getElementById("editProductModal")).hide();
    loadProducts();
}

function askDeleteConfirmation(id) {
    productToDeleteId = id;
    new bootstrap.Modal(document.getElementById("deleteConfirmModal")).show();
}

async function executeDelete() {
    const token = localStorage.getItem("token");
    await fetch(`/products/${productToDeleteId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });
    bootstrap.Modal.getInstance(document.getElementById("deleteConfirmModal")).hide();
    loadProducts();
}

// ==========================================
//  AUTH & USER
// ==========================================

async function saveAddress() {
    const token = localStorage.getItem("token");
    const street = document.getElementById("addrStreet").value;
    const city = document.getElementById("addrCity").value;
    const zip = document.getElementById("addrZip").value;

    if (!street || !city || !zip) return alert("Fill all fields");

    const res = await fetch("/auth/address", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ street, city, zip_code: zip })
    });

    if (res.ok) alert("Address Saved!");
    else alert("Failed");
}

function checkLoginStatus() {
    const token = localStorage.getItem("token");
    const authBtn = document.getElementById("auth-buttons");
    const addProductBtn = document.getElementById("add-product-btn");

    if (token) {
        if (addProductBtn) addProductBtn.classList.remove("d-none");
        authBtn.innerHTML = `
            <div class="dropdown">
                <a class="nav-link dropdown-toggle text-light" href="#" data-bs-toggle="dropdown">
                    <i class="fas fa-user-circle fa-lg me-1"></i> Account
                </a>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                    <li><button class="dropdown-item" onclick="openProfile()">My Profile</button></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button class="dropdown-item text-danger" onclick="logout()">Logout</button></li>
                </ul>
            </div>`;
    } else {
        if (addProductBtn) addProductBtn.classList.add("d-none");
        authBtn.innerHTML = `
            <a class="nav-link text-light" href="#" onclick="new bootstrap.Modal(document.getElementById('loginModal')).show()">Login</a>
            <span class="text-secondary mx-2">|</span>
            <a class="nav-link text-light" href="#" onclick="new bootstrap.Modal(document.getElementById('registerModal')).show()">Sign Up</a>`;
    }
}

async function login() {
    const e = document.getElementById("loginEmail").value;
    const p = document.getElementById("loginPassword").value;
    const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: e, password: p })
    });

    if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        location.reload();
    } else {
        alert("Invalid");
    }
}

async function registerUser() {
    const e = document.getElementById("regEmail").value;
    const u = document.getElementById("regUsername").value;
    const p = document.getElementById("regPassword").value;
    const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, username: u, password: p })
    });

    if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        new bootstrap.Modal(document.getElementById('loginModal')).show();
    } else {
        alert("Error");
    }
}

function logout() {
    localStorage.removeItem("token");
    location.reload();
}

function handleSessionExpired() {
    alert("Session expired");
    logout();
}