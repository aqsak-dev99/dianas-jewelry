jQuery(document).ready(function($) {
  // Define API base URL
  const API_URL = 'https://dianas-jewelry-production.up.railway.app';

  // Helper: Ensure products are loaded before calling loadProduct
  function ensureProductsLoadedThenLoadProduct() {
    // Always try to load from localStorage first
    let stored = localStorage.getItem('products');
    if (stored) {
      try {
        products = JSON.parse(stored);
      } catch (e) {
        products = [];
      }
    }
    if (products && products.length > 0) {
      loadProduct();
    } else {
      // Always fetch from API if not present or empty
      $.ajax({
        url: `${API_URL}/api/products`,
        type: 'GET',
        success: function(data) {
          if (data && Array.isArray(data)) {
            products = data.map(product => ({
              ...product,
              image_url: normalizeImagePath(product.image_url),
              images: JSON.stringify([normalizeImagePath(product.image_url)])
            }));
          } else {
            products = [];
          }
          try {
            localStorage.setItem('products', JSON.stringify(products));
          } catch (e) {}
          loadProduct();
        },
        error: function() {
          $('.product-details').html('<p>Could not load product data. <a href="products.html">Browse all products</a></p>');
        }
      });
    }
  }
  // Test jQuery availability
  if (typeof jQuery === 'undefined') {
    console.log('jQuery is NOT loaded');
  } else {
    console.log('jQuery is loaded, version: ' + jQuery.fn.jquery);
  }

  // Initialize arrays
  let wishlist = [];
  let cart = [];
  let products = [];

  // Get userId from localStorage or default to 1 (temporary until JWT is implemented)
  let userId = localStorage.getItem('userId') || 1;
  function getUserId() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        userId = user.id || 1;
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
    return userId;
  }

  // Category mapping
  const categoryMap = {
    1: "Necklaces",
    2: "Earrings",
    3: "Bracelets",
    4: "Rings"
  };

  // Base URL for images
  const BASE_IMAGE_URL = '/images/';

  // Utility to normalize image paths
  function normalizeImagePath(path) {
    if (!path || typeof path !== 'string') {
      console.warn('Invalid image path, defaulting to /images/1.jpg');
      return '/images/1.jpg';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    path = path.replace(/\/+images\/+images\//g, '/images/')
               .replace(/\/+/g, '/')
               .replace(/^images\//, '/images/');
    if (path.startsWith('/images/')) return path;
    if (path.startsWith('/')) return BASE_IMAGE_URL + path.substring(1);
    return BASE_IMAGE_URL + path;
  }

  // Format price
  function formatPrice(price) {
    return Number(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Confetti animation
  function triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else {
      console.warn('Confetti library not loaded. Please include confetti.js in checkout.html.');
    }
  }

  // Fetch products from DB
  function fetchProducts() {
    $.ajax({
      url: `${API_URL}/api/products`,
      type: 'GET',
      success: function(data) {
        if (data && Array.isArray(data) && data.length > 0 && data.every(p => p.image_url && p.name && !isNaN(p.price))) {
          products = data.map(product => ({
            ...product,
            image_url: normalizeImagePath(product.image_url),
            images: JSON.stringify([normalizeImagePath(product.image_url)]),
            category: categoryMap[product.category_id] || product.category_name || 'Unknown'
          }));
          console.log('Fetched products:', products);
        } else {
          console.warn('Invalid or empty DB products');
          products = [];
        }
        try {
          localStorage.setItem('products', JSON.stringify(products));
        } catch (e) {
          console.error('Error saving products to localStorage:', e);
        }
        if (window.location.pathname.includes('products.html')) {
          filterProducts();
        } else if (window.location.pathname.includes('product.html')) {
          ensureProductsLoadedThenLoadProduct();
        } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
          renderIndexSections();
        }
      },
      error: function(xhr) {
        console.error('Error fetching products from DB:', xhr.status, xhr.responseText);
        products = [];
        try {
          localStorage.removeItem('products');
        } catch (e) {
          console.error('Error removing products from localStorage:', e);
        }
        if (window.location.pathname.includes('products.html')) {
          filterProducts();
        } else if (window.location.pathname.includes('product.html')) {
          ensureProductsLoadedThenLoadProduct();
        } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
          renderIndexSections();
        }
      }
    });
  }

  // Fetch wishlist from DB
  function fetchWishlist() {
    $.ajax({
      url: `${API_URL}/api/wishlist?userId=${getUserId()}`,
      type: 'GET',
      success: function(data) {
        console.log('Wishlist data from API:', data);
        wishlist = data.map(item => ({
          ...item,
          image_url: normalizeImagePath(item.image_url)
        }));
        try {
          localStorage.setItem('wishlist', JSON.stringify(wishlist));
        } catch (e) {
          console.error('Error saving wishlist to localStorage:', e);
        }
        updateCounters();
        if (window.location.pathname.includes('wishlist.html')) {
          renderWishlist();
        }
        updateWishlistButtons();
      },
      error: function(xhr) {
        console.error('Error fetching wishlist:', xhr.status, xhr.responseText);
        wishlist = [];
        try {
          localStorage.removeItem('wishlist');
        } catch (e) {
          console.error('Error removing wishlist from localStorage:', e);
        }
        updateCounters();
        if (window.location.pathname.includes('wishlist.html')) {
          renderWishlist();
        }
      }
    });
  }

  // Fetch cart from DB
  function fetchCart() {
    $.ajax({
      url: `${API_URL}/api/cart?userId=${getUserId()}`,
      type: 'GET',
      success: function(data) {
        console.log('Cart data from API:', data);
        cart = data.map(item => ({
          ...item,
          image_url: normalizeImagePath(item.image_url)
        }));
        try {
          localStorage.setItem('cart', JSON.stringify(cart));
        } catch (e) {
          console.error('Error saving cart to localStorage:', e);
        }
        updateCounters();
        if (window.location.pathname.includes('cart.html')) {
          renderCart();
        } else if (window.location.pathname.includes('checkout.html')) {
          renderCheckout();
        }
      },
      error: function(xhr) {
        console.error('Error fetching cart:', xhr.status, xhr.responseText);
        cart = [];
        try {
          localStorage.removeItem('cart');
        } catch (e) {
          console.error('Error removing cart from localStorage:', e);
        }
        updateCounters();
        if (window.location.pathname.includes('cart.html')) {
          renderCart();
        } else if (window.location.pathname.includes('checkout.html')) {
          renderCheckout();
        }
      }
    });
  }

  // Update wishlist and cart counters
  function updateCounters() {
    const wishlistCount = Array.isArray(wishlist) ? wishlist.length : 0;
    const cartCount = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
    $('#wishlist-counter').text(wishlistCount > 0 ? wishlistCount : '');
    $('#cart-counter').text(cartCount > 0 ? cartCount : '');
    if (window.location.pathname.includes('cart.html')) {
      $('#checkout-btn').text('Proceed to Checkout');
      $('#checkout-btn').attr('aria-label', cartCount > 0 ? `Proceed to checkout with ${cartCount} items` : 'Proceed to checkout');
      $('#clear-cart').text('Clear Cart');
      $('#clear-cart').attr('aria-label', 'Clear cart');
    }
  }

  // Update wishlist buttons state
  function updateWishlistButtons() {
    $('.wishlist-btn').each(function() {
      const productId = $(this).closest('.product-card, .product-details').data('product-id');
      if (!productId) return;
      const isWishlisted = wishlist.some(w => w.product_id === productId);
      $(this).toggleClass('active', isWishlisted)
             .text(isWishlisted ? '❤️' : '♡')
             .attr('aria-label', `${isWishlisted ? 'Remove' : 'Add'} ${productId} ${isWishlisted ? 'from' : 'to'} wishlist`);
    });
  }

  // Render products
  function renderProducts(productsToRender) {
    const container = $("#products-container");
    container.empty();

    if (!productsToRender || !Array.isArray(productsToRender) || productsToRender.length === 0) {
      container.html("<p>No products found.</p>");
      return;
    }

    productsToRender.forEach((product) => {
      if (!product || !product.name || isNaN(product.price)) {
        console.warn(`Skipping invalid product: ${JSON.stringify(product)}`);
        return;
      }
      const imageSrc = normalizeImagePath(product.image_url);
      const productHTML = `
        <div class="product-card" data-product-id="${product.id}">
          <a href="product.html?id=${product.id}" class="product-image-link">
            <img src="${imageSrc}" alt="${product.name}" class="product-image" onerror="console.warn('Image failed to load: ${imageSrc}'); this.src='/images/1.jpg'">
          </a>
          <h3>${product.name}</h3>
          <p>${product.description || 'No description available'}</p>
          <p class="price">$${formatPrice(product.price)}</p>
          <div class="product-actions">
            <button class="add-to-cart" data-id="${product.id}" data-image_url="${imageSrc}" aria-label="Add ${product.name} to cart">Add to Cart</button>
            <button class="wishlist-btn" data-id="${product.id}" data-image_url="${imageSrc}" aria-label="Add ${product.name} to wishlist">♡</button>
          </div>
        </div>
      `;
      container.append(productHTML);
    });

    $('.add-to-cart').off('click').on('click', function(e) {
      e.preventDefault();
      const id = $(this).data('id');
      const image_url = $(this).data('image_url');
      const product = products.find(p => p.id === id);
      if (!product || !product.id || isNaN(product.price)) {
        alert('Invalid product data.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/cart/add`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ product_id: id, quantity: 1, image_url, userId: getUserId() }),
        success: function() {
          fetchCart();
          // alert removed
        },
        error: function(xhr) {
          alert(`Error adding to cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });

    $('.wishlist-btn').off('click').on('click', function(e) {
      e.preventDefault();
      const id = $(this).data('id');
      const image_url = $(this).data('image_url');
      const product = products.find(p => p.id === id);
      if (!product || !product.id || isNaN(product.price)) {
        alert('Invalid product data.');
        return;
      }
      const isWishlisted = wishlist.some(w => w.product_id === id);
      if (isWishlisted) {
        $.ajax({
          url: `${API_URL}/api/wishlist/remove/${id}?userId=${getUserId()}`,
          type: 'DELETE',
          success: function() {
            fetchWishlist();
          },
          error: function(xhr) {
            alert(`Error removing from wishlist: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        $.ajax({
          url: `${API_URL}/api/wishlist/add`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ product_id: id, userId: getUserId() }),
          success: function() {
            fetchWishlist();
          },
          error: function(xhr) {
            alert(`Error adding to wishlist: ${xhr.status} ${xhr.responseText}`);
          }
        });
      }
    });

    $('.product-image-link').off('click').on('click', function(e) {
      e.preventDefault();
      const href = $(this).attr('href');
      window.location.href = href;
    });
  }

  // Render index page sections (Featured Items, Seasonal Picks, Limited Edition)
  function renderIndexSections() {
    const featuredItems = products.filter(p => [1, 2].includes(p.id)); // Pearl Necklace, Black Ear Studs
    const seasonalPicks = products.filter(p => [3, 4].includes(p.id)); // Gold Necklace, Pearl Bracelet Set
    const limitedEdition = products.filter(p => [5, 6].includes(p.id)); // Enchanted Ring, Golden Thread Bracelet Set

    const containers = [
      { id: 'featured-items', products: featuredItems },
      { id: 'seasonal-picks', products: seasonalPicks },
      { id: 'limited-edition', products: limitedEdition }
    ];

    containers.forEach(({ id, products }) => {
      const $container = $(`#${id}`);
      $container.empty();
      if (!products || products.length === 0) {
        $container.html('<p>No products available.</p>');
        return;
      }
      products.forEach(product => {
        if (!product || !product.name || isNaN(product.price) || !product.image_url) {
          console.warn(`Skipping invalid product for ${id}: ${JSON.stringify(product)}`);
          return;
        }
        const imageSrc = normalizeImagePath(product.image_url);
        const productHTML = `
          <div class="product-card" data-product-id="${product.id}" data-price="${product.price}" data-image_url="${imageSrc}" data-product="${product.name}">
            <a href="product.html?id=${product.id}" class="product-image-link">
              <img src="${imageSrc}" alt="${product.name}" class="product-image" onerror="console.warn('Image failed to load: ${imageSrc}'); this.src='/images/1.jpg'">
            </a>
            <h3>${product.name}</h3>
            <p>$${formatPrice(product.price)}</p>
            <div class="product-actions">
              <button class="btn-add" data-product-id="${product.id}" data-image_url="${imageSrc}" aria-label="Add ${product.name} to cart">Add to Cart</button>
              <button class="wishlist-btn" data-product-id="${product.id}" data-image_url="${imageSrc}" aria-label="Add ${product.name} to wishlist">♡</button>
            </div>
          </div>
        `;
        $container.append(productHTML);
      });

      $(`#${id} .btn-add`).off('click').on('click', function(e) {
        e.preventDefault();
        const productId = $(this).data('product-id');
        const image_url = $(this).data('image_url');
        const product = products.find(p => p.id === productId);
        if (!product || !product.id || isNaN(product.price)) {
          alert('Invalid product data.');
          return;
        }
        $.ajax({
          url: `${API_URL}/api/cart/add`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ product_id: productId, quantity: 1, image_url, userId: getUserId() }),
          success: function() {
            fetchCart();
          },
          error: function(xhr) {
            alert(`Error adding to cart: ${xhr.status} ${xhr.responseText}`);
          }
        });
      });

      $(`#${id} .wishlist-btn`).off('click').on('click', function(e) {
        e.preventDefault();
        const productId = $(this).data('product-id');
        const image_url = $(this).data('image_url');
        const product = products.find(p => p.id === productId);
        if (!product || !product.id || isNaN(product.price)) {
          alert('Invalid product data.');
          return;
        }
        const isWishlisted = wishlist.some(w => w.product_id === productId);
        if (isWishlisted) {
          $.ajax({
            url: `${API_URL}/api/wishlist/remove/${productId}?userId=${getUserId()}`,
            type: 'DELETE',
            success: function() {
              fetchWishlist();
            },
            error: function(xhr) {
              alert(`Error removing from wishlist: ${xhr.status} ${xhr.responseText}`);
            }
          });
        } else {
          $.ajax({
            url: `${API_URL}/api/wishlist/add`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ product_id: productId, userId: getUserId() }),
            success: function() {
              fetchWishlist();
            },
            error: function(xhr) {
              alert(`Error adding to wishlist: ${xhr.status} ${xhr.responseText}`);
            }
          });
        }
      });
    });

    updateWishlistButtons();
  }

  // Render wishlist
  function renderWishlist() {
    const $wishlistGrid = $('#wishlist-items');
    const $emptyWishlist = $('#empty-wishlist');
    $wishlistGrid.empty();
    if (wishlist.length === 0) {
      $wishlistGrid.hide();
      $emptyWishlist.show();
    } else {
      $wishlistGrid.show();
      $emptyWishlist.hide();
      wishlist.forEach((item, idx) => {
        const price = parseFloat(item.price) || 0;
        const imgSrc = normalizeImagePath(item.image_url);
        $wishlistGrid.append(`
          <div class="wishlist-item" data-index="${idx}" data-image_url="${imgSrc}">
            <div class="item-container">
              <img src="${imgSrc}" alt="${item.name}" class="item-thumbnail" onerror="console.warn('Wishlist image failed to load: ${imgSrc}'); this.src='/images/1.jpg'">
              <div class="item-details">
                <span class="item-name">${item.name}</span>
                <span class="item-price">$${formatPrice(price)}</span>
              </div>
            </div>
            <div class="item-actions">
              <button class="btn-primary add-to-cart" data-id="${item.product_id}" data-product="${item.name}" data-price="${price}" data-image_url="${imgSrc}" aria-label="Add ${item.name} to cart"><i class="fas fa-cart-plus"></i> Add to Cart</button>
              <button class="btn-remove" data-id="${item.product_id}" aria-label="Remove ${item.name} from wishlist"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `);
      });
    }
    $('.btn-remove').off('click').on('click', function() {
      const product_id = $(this).data('id');
      if (!product_id) {
        alert('Invalid wishlist item.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/wishlist/remove/${product_id}?userId=${getUserId()}`,
        type: 'DELETE',
        success: function() {
          fetchWishlist();
        },
        error: function(xhr) {
          alert(`Error removing from wishlist: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });
    $('.add-to-cart').off('click').on('click', function() {
      const product_id = $(this).data('id');
      const price = parseFloat($(this).data('price'));
      const image_url = $(this).data('image_url');
      if (!product_id || isNaN(price)) {
        alert('Invalid product data.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/cart/add`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ product_id, quantity: 1, image_url, userId: getUserId() }),
        success: function() {
          fetchCart();
          // alert removed
        },
        error: function(xhr) {
          alert(`Error adding to cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });
  }

  // Render cart
  function renderCart() {
    const tbody = $('#cart-items');
    const cartTable = $('#cart-table');
    const emptyCart = $('#empty-cart');
    let subtotal = 0;

    tbody.empty();
    if (!cart.length) {
      cartTable.hide();
      emptyCart.show();
    } else {
      cartTable.show();
      emptyCart.hide();
      cart.forEach((item, index) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 1;
        const total = price * quantity;
        subtotal += total;
        const variantText = item.variant ? ` (${item.variant})` : '';
        const imgSrc = normalizeImagePath(item.image_url);
        const $row = $(`
          <tr data-index="${index}">
            <td class="items flex items-center gap-2">
              <img src="${imgSrc}" alt="${item.name}" class="h-10 w-10 object-cover" loading="lazy" onerror="console.warn('Cart image failed to load: ${imgSrc}'); this.src='/images/1.jpg'">
              ${item.name}${variantText}
            </td>
            <td class="price">$${formatPrice(price)}</td>
            <td class="qnt">
              <div class="quantity-controls">
                <button class="decrease" data-id="${item.product_id}" data-image_url="${imgSrc}" aria-label="Decrease quantity of ${item.name}">-</button>
                <span>${quantity}</span>
                <button class="increase" data-id="${item.product_id}" data-image_url="${imgSrc}" aria-label="Increase quantity of ${item.name}">+</button>
              </div>
            </td>
            <td class="total">$${formatPrice(total)}</td>
          </tr>
        `);
        tbody.append($row);
      });
    }

    const shipping = cart.length > 0 ? 5.00 : 0;
    $('#cart-subtotal').text(formatPrice(subtotal));
    $('#cart-shipping').text(formatPrice(shipping));
    $('#cart-total').text(formatPrice(subtotal + shipping));
    updateCounters();
  }

  // Render checkout
  function renderCheckout() {
    const checkoutTbody = $('#checkout-items tbody');
    const reviewTbody = $('#review-items tbody');
    const cartTable = $('#checkout-items').closest('.cart-summary');
    const emptyMessage = $('#empty-cart-message');
    let subtotal = 0;

    checkoutTbody.empty();
    reviewTbody.empty();

    if (!cart.length) {
      cartTable.hide();
      if (!emptyMessage.length) {
        cartTable.after('<p id="empty-cart-message" class="text-center text-red-500 mt-4">Your cart is empty. <a href="products.html" class="underline">Shop now</a>.</p>');
      }
      $('#checkout-subtotal, #review-subtotal').text(formatPrice(0));
      $('#checkout-shipping, #review-shipping').text('0.00');
      $('#checkout-total, #review-total').text(formatPrice(0));
      updateCounters();
      return;
    } else {
      cartTable.show();
      if (emptyMessage.length) emptyMessage.remove();
    }

    cart.forEach((item, index) => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const total = price * quantity;
      subtotal += total;
      const variantText = item.variant ? ` (${item.variant})` : '';
      const imgSrc = normalizeImagePath(item.image_url);
      const $row = $(`
        <tr data-index="${index}">
          <td class="items flex items-center gap-2">
            <img src="${imgSrc}" alt="${item.name}" class="h-10 w-10 object-cover" loading="lazy" onerror="console.warn('Checkout image failed to load: ${imgSrc}'); this.src='/images/1.jpg'">
            ${item.name}${variantText}
          </td>
          <td class="price">$${formatPrice(price)}</td>
          <td class="qnt">
            <div class="quantity-controls">
              <button class="decrease" data-id="${item.product_id}" data-image_url="${imgSrc}" aria-label="Decrease quantity of ${item.name}">-</button>
              <span>${quantity}</span>
              <button class="increase" data-id="${item.product_id}" data-image_url="${imgSrc}" aria-label="Increase quantity of ${item.name}">+</button>
            </div>
          </td>
          <td class="total">$${formatPrice(total)}</td>
        </tr>
      `);
      checkoutTbody.append($row);

      const $reviewRow = $(`
        <tr data-index="${index}">
          <td class="items flex items-center gap-2">
            <img src="${imgSrc}" alt="${item.name}" class="h-10 w-10 object-cover" loading="lazy" onerror="console.warn('Review image failed to load: ${imgSrc}'); this.src='/images/1.jpg'">
            ${item.name}${variantText}
          </td>
          <td class="price">$${formatPrice(price)}</td>
          <td class="qnt">${quantity}</td>
          <td class="total">$${formatPrice(total)}</td>
        </tr>
      `);
      reviewTbody.append($reviewRow);
    });

    const shipping = 5.00;
    $('#checkout-subtotal, #review-subtotal').text(formatPrice(subtotal));
    $('#checkout-shipping, #review-shipping').text(formatPrice(shipping));
    $('#checkout-total, #review-total').text(formatPrice(subtotal + shipping));
    updateCounters();
  }

  // Render orders
  function renderOrders() {
    $.ajax({
      url: `${API_URL}/api/orders?userId=${getUserId()}`,
      type: 'GET',
      success: function(orders) {
        const container = $('#orders-container');
        container.empty();
        if (!orders || orders.length === 0) {
          container.html('<p>No orders found.</p>');
          return;
        }
        orders.forEach(order => {
          const itemsList = order.items.map(item => `<li>${item.name} (x${item.quantity}) - $${formatPrice(item.price)}</li>`).join('');
          container.append(`
            <div class="order">
              <h3>Order #${order.id}</h3>
              <p>Total: $${formatPrice(order.total)}</p>
              <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
              <ul>${itemsList}</ul>
            </div>
          `);
        });
      },
      error: function(xhr) {
        console.error('Error fetching orders:', xhr.status, xhr.responseText);
        $('#orders-container').html('<p>Error loading orders.</p>');
      }
    });
  }

  // Update header colors for dark mode
  function updateHeaderColors() {
    if ($('body').hasClass('dark')) {
      $('#header a, #header button, #menu a').css('color', '#eee');
    } else {
      $('#header a, #header button, #menu a').css('color', '');
    }
  }

  // Dark mode toggle
  $('.dark-toggle').on('click', function() {
    $('body').toggleClass('dark');
    $(this).html($('body').hasClass('dark')
      ? '<i class="fas fa-sun"></i> <span class="icon-text">Light Mode</span>'
      : '<i class="fas fa-moon"></i> <span class="icon-text">Dark Mode</span>');
    updateHeaderColors();
    localStorage.setItem('darkMode', $('body').hasClass('dark') ? 'enabled' : 'disabled');
  });

  // Persist dark mode
  if (localStorage.getItem('darkMode') === 'enabled') {
    $('body').addClass('dark');
    $('.dark-toggle').html('<i class="fas fa-sun"></i> <span class="icon-text">Light Mode</span>');
    updateHeaderColors();
  }

  // Search functionality
  function initSearch() {
    $('#search-input').on('input', function() {
      const query = $(this).val().trim().toLowerCase();
      const $results = $('#search-results');
      $results.empty();
      if (query.length > 0) {
        const matches = products.filter(p => p.name.toLowerCase().includes(query)).slice(0, 5);
        if (matches.length > 0) {
          matches.forEach(p => {
            $results.append(`<a href="product.html?id=${p.id}">${p.name} - $${formatPrice(p.price)}</a>`);
          });
          $results.show();
        } else {
          $results.hide();
        }
      } else {
        $results.hide();
      }
    });

    $(document).on('click', function(e) {
      if (!$(e.target).closest('.search-bar').length) {
        $('#search-results').hide();
      }
    });

    $('#search-btn').on('click', function() {
      const query = $('#search-input').val().trim();
      if (query) {
        const $results = $('#search-results');
        $results.html('<div>Searching...</div>').show();
        $.ajax({
          url: `${API_URL}/api/ask`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ message: 'Search for: ' + query }),
          success: function(response) {
            const aiResponse = response.answer || 'No results found.';
            $results.html('<div>' + aiResponse + '</div>');
          },
          error: function(xhr) {
            $results.html(`<div style="color:red;">Error: Could not reach AI server (${xhr.status}).</div>`);
          }
        });
      } else {
        alert('Please enter a search term.');
      }
    });

    $('#search-input').on('keypress', function(e) {
      if (e.key === 'Enter') {
        $('#search-btn').click();
      }
    });
  }

  // Newsletter form
  function initNewsletter() {
    $('.newsletter-form button').on('click', function() {
      const name = $('.newsletter-form input[type="text"]').val().trim();
      const email = $('.newsletter-form input[type="email"]').val().trim();
      if (name && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        $.ajax({
          url: `${API_URL}/api/newsletter`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ name, email }),
          success: function() {
            alert(`Thank you, ${name}, for subscribing to our newsletter!`);
            $('.newsletter-form input').val('');
          },
          error: function(xhr) {
            alert(`Error subscribing to newsletter: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        alert('Please enter a valid name and email address.');
      }
    });

    $('.newsletter-form input[type="email"]').on('keypress', function(e) {
      if (e.key === 'Enter') {
        $('.newsletter-form button').click();
      }
    });
  }

  // Scroll to top and chat widget
  function initScrollAndChat() {
    $(window).on('scroll', function() {
      if ($(window).scrollTop() > 400) {
        $('.to-top, .chat-btn').addClass('show');
      } else {
        $('.to-top, .chat-btn').removeClass('show');
      }
    });

    $('.to-top').on('click', function() {
      $('html, body').animate({ scrollTop: 0 }, 'smooth');
    });

    $('.chat-btn').on('click', function() {
      $('#chat-widget').removeClass('hidden');
    });

    $('#close-chat').on('click', function() {
      $('#chat-widget').addClass('hidden');
    });

    $('#send-btn').on('click', function() {
      sendMessage();
    });

    $('#chat-input').on('keypress', function(e) {
      if (e.which === 13) sendMessage();
    });

    function sendMessage() {
      const input = $('#chat-input').val().trim();
      if (!input) {
        console.log('No input provided');
        return;
      }

      appendMessage(input, 'user');
      $('#chat-input').val('');

      $.post({
        url: `${API_URL}/api/chat`,
        contentType: 'application/json',
        data: JSON.stringify({ message: input }),
        success: function(response) {
          appendMessage(response.reply, 'bot');
        },
        error: function(xhr) {
          console.error('Chat API error:', xhr.status, xhr.responseText);
          appendMessage(`Sorry, I encountered an error (${xhr.status}). Try again!`, 'bot');
        }
      });
    }

    function appendMessage(message, sender) {
      const $chatMessages = $('#chat-messages');
      const messageClass = sender === 'user' ? 'user-message' : 'bot-message';
      $chatMessages.append(`<div class="${messageClass}">${message}</div>`);
      $chatMessages.scrollTop($chatMessages[0].scrollHeight);
    }
  }

  // Intersection Observer for animations
  function initAnimations() {
    const $elements = $('.product-card, .entry-content, .wishlist-item');
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          $(entry.target).addClass('visible').css({ opacity: 1, transform: 'translateY(0)' });
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    $elements.each(function() {
      $(this).css({ opacity: 0, transform: 'translateY(20px)', transition: 'opacity .6s ease, transform .6s ease' });
      io.observe(this);
    });
  }

  // Navigation active state
  function setActiveNav() {
    const navLinks = $('#menu ul li a');
    const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';

    navLinks.each(function() {
      const href = $(this).attr('href').split('?')[0];
      $(this).toggleClass('active', href === currentPage);
    });

    navLinks.on('click', function(e) {
      const href = $(this).attr('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = $(href);
        if (target.length) {
          $('html, body').animate(
            { scrollTop: target.offset().top - 50 },
            500
          );
        }
      } else {
        window.location.href = href;
      }
    });
  }

  // Hamburger menu toggle
  $('.hamburger').on('click', function() {
    $('.main-nav').toggleClass('active');
    $(this).html($('.main-nav').hasClass('active')
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-bars"></i>');
  });

  // Dropdown toggle for mobile
  $('.main-nav > li > a').on('click', function(e) {
    if (window.innerWidth <= 768) {
      const $parentLi = $(this).parent();
      const $dropdown = $parentLi.find('.dropdown');
      if ($dropdown.length) {
        e.preventDefault();
        $parentLi.toggleClass('active');
      }
    }
  });

  // Anchor link scrolling
  $('.dropdown a').on('click', function(e) {
    const href = $(this).attr('href');
    if (href.startsWith('#')) {
      e.preventDefault();
      const $section = $(href);
      if ($section.length) {
        $('html, body').animate({ scrollTop: $section.offset().top - 100 }, 600);
        if (window.innerWidth <= 768) {
          $('.main-nav').removeClass('active');
          $('.hamburger').html('<i class="fas fa-bars"></i>');
        }
      }
    }
  });

  // Products page logic
  if (window.location.pathname.includes('products.html')) {
    function filterProducts() {
      const urlParams = new URLSearchParams(window.location.search);
      const category = urlParams.get('category') || 'all';
      const search = urlParams.get('search')?.toLowerCase();
      const $products = $('#products-container');
      $products.empty();
      let filteredProducts = products;
      if (category !== 'all') {
        filteredProducts = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }
      if (search) {
        filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(search));
      }
      renderProducts(filteredProducts);
      $('.category-list a').each(function() {
        const cat = $(this).data('category');
        $(this).toggleClass('active', cat === category);
      });
      $('.category-list .filter-link').off('click').on('click', function(e) {
        e.preventDefault();
        const newCategory = $(this).data('category');
        const url = newCategory === 'all' ? 'products.html' : `products.html?category=${newCategory}`;
        history.pushState({ category: newCategory }, '', url);
        filterProducts();
        initScrollAndChat();
      });
      initAnimations();
      initScrollAndChat();
    }
    window.addEventListener('popstate', function() {
      filterProducts();
    });
    filterProducts();
  }

  // Wishlist page logic
  if (window.location.pathname.includes('wishlist.html')) {
    renderWishlist();
  }

  // Cart page logic
  if (window.location.pathname.includes('cart.html')) {
    renderCart();

    $('#clear-cart').on('click', function() {
      $.ajax({
        url: `${API_URL}/api/cart/clear?userId=${getUserId()}`,
        type: 'DELETE',
        success: function() {
          fetchCart();
        },
        error: function(xhr) {
          alert(`Error clearing cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });

    $('#checkout-btn').on('click', function() {
      if (cart.length === 0) {
        alert('Your cart is empty. Please add items to proceed.');
        return;
      }
      window.location.href = 'checkout.html';
    });

    $(document).on('click', '.increase', function() {
      const product_id = $(this).data('id');
      const item = cart.find(c => c.product_id === product_id);
      const image_url = $(this).data('image_url');
      if (!item || !item.product_id) {
        alert('Invalid cart item.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/cart/update/${product_id}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ quantity: (item.quantity || 1) + 1, variant: item.variant, image_url, userId: getUserId() }),
        success: function() {
          fetchCart();
        },
        error: function(xhr) {
          alert(`Error updating cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });

    $(document).on('click', '.decrease', function() {
      const product_id = $(this).data('id');
      const item = cart.find(c => c.product_id === product_id);
      const image_url = $(this).data('image_url');
      if (!item || !item.product_id) {
        alert('Invalid cart item.');
        return;
      }
      if (item.quantity > 1) {
        $.ajax({
          url: `${API_URL}/api/cart/update/${product_id}`,
          type: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify({ quantity: item.quantity - 1, variant: item.variant, image_url, userId: getUserId() }),
          success: function() {
            fetchCart();
          },
          error: function(xhr) {
            alert(`Error updating cart: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        $.ajax({
          url: `${API_URL}/api/cart/remove/${product_id}?userId=${getUserId()}`,
          type: 'DELETE',
          success: function() {
            fetchCart();
          },
          error: function(xhr) {
            alert(`Error removing from cart: ${xhr.status} ${xhr.responseText}`);
          }
        });
      }
    });
  }

  // Checkout page logic
  if (window.location.pathname.includes('checkout.html')) {
    function validateShipping() {
      let isValid = true;
      console.log('[DEBUG] Validating shipping fields...');
      const fields = [
        { id: 'name', error: 'Please enter your full name.' },
        { id: 'address', error: 'Please enter your address.' },
        { id: 'city', error: 'Please enter your city.' },
        { id: 'phone', error: 'Please enter your phone number.' }
      ];

      fields.forEach(field => {
        const input = $(`#${field.id}`);
        if (!input.val().trim()) {
          showError(field.id, field.error);
          isValid = false;
          console.log(`[DEBUG] Shipping validation failed: ${field.id} is empty`);
        } else {
          $(`#${field.id}-error`).removeClass('active').text('');
          input.removeClass('error');
        }
      });
      if (!isValid) {
        console.log('[DEBUG] Shipping validation failed.');
      } else {
        console.log('[DEBUG] Shipping validation passed.');
      }

      return isValid;
    }

    function validatePayment() {
      let isValid = true;
      const paymentMethod = $('#payment-method').val() || $('input[name="payment-method"]:checked').val() || 'card';
      
      // Clear all error messages
      $('#card-number-error, #expiry-error, #cvv-error, #paypal-email-error, #bank-account-error, #bank-routing-error')
        .removeClass('active').text('');
      $('#card-number, #expiry, #cvv, #paypal-email, #bank-account, #bank-routing').removeClass('error');

      if (paymentMethod === 'card') {
        const cardFields = [
          { id: 'card-number', error: 'Please enter your card number.' },
          { id: 'expiry', error: 'Please enter the expiration date.' },
          { id: 'cvv', error: 'Please enter the CVV.' }
        ];

        cardFields.forEach(field => {
          const input = $(`#${field.id}`);
          if (!input.val().trim()) {
            showError(field.id, field.error);
            isValid = false;
          }
        });

        const cardNumber = $('#card-number').val().trim();
        if (cardNumber && !/^\d{16}$/.test(cardNumber)) {
          showError('card-number', 'Please enter a valid 16-digit card number.');
          isValid = false;
        }

        const expiry = $('#expiry').val().trim();
        if (expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
          showError('expiry', 'Please enter a valid expiration date (MM/YY).');
          isValid = false;
        }

        const cvv = $('#cvv').val().trim();
        if (cvv && !/^\d{3,4}$/.test(cvv)) {
          showError('cvv', 'Please enter a valid CVV.');
          isValid = false;
        }
      } else if (paymentMethod === 'paypal') {
        const paypalEmail = $('#paypal-email').val().trim();
        if (!paypalEmail) {
          showError('paypal-email', 'Please enter your PayPal email.');
          isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
          showError('paypal-email', 'Please enter a valid email address.');
          isValid = false;
        }
      } else if (paymentMethod === 'bank') {
        const bankFields = [
          { id: 'bank-account', error: 'Please enter your bank account number.' },
          { id: 'bank-routing', error: 'Please enter your bank routing number.' }
        ];

        bankFields.forEach(field => {
          const input = $(`#${field.id}`);
          if (!input.val().trim()) {
            showError(field.id, field.error);
            isValid = false;
          }
        });

        const bankAccount = $('#bank-account').val().trim();
        if (bankAccount && !/^\d{8,12}$/.test(bankAccount)) {
          showError('bank-account', 'Please enter a valid bank account number.');
          isValid = false;
        }

        const bankRouting = $('#bank-routing').val().trim();
        if (bankRouting && !/^\d{9}$/.test(bankRouting)) {
          showError('bank-routing', 'Please enter a valid 9-digit routing number.');
          isValid = false;
        }
      }

      return isValid;
    }

    function showError(fieldId, message) {
      $(`#${fieldId}-error`).text(message).addClass('active').show();
      $(`#${fieldId}`).addClass('error');
    }

    window.nextStep = function(step) {
      if (step === 'shipping') {
        if (!validateShipping()) {
          return;
        }
        const shippingData = {
          fullName: $('#name').val().trim(),
          address: $('#address').val().trim(),
          city: $('#city').val().trim(),
          phone: $('#phone').val().trim()
        };
        $('#review-shipping').html(`
          ${shippingData.fullName}<br>
          ${shippingData.address}<br>
          ${shippingData.city}<br>
          ${shippingData.phone}
        `);
        $('#shipping-section').addClass('hidden');
        $('#payment-section').removeClass('hidden').css('display', '');
        $('#step1').removeClass('step-active').addClass('step-inactive').removeAttr('aria-current');
        $('#step2').removeClass('step-inactive').addClass('step-active').attr('aria-current', 'step');
      } else if (step === 'payment') {
        if (!validatePayment()) {
          return;
        }
        const paymentMethod = $('#payment-method').val() || $('input[name="payment-method"]:checked').val() || 'card';
        let paymentDisplay = '';
        if (paymentMethod === 'card') {
          paymentDisplay = `Credit/Debit Card ending in ${$('#card-number').val().slice(-4)}`;
        } else if (paymentMethod === 'paypal') {
          paymentDisplay = `PayPal (${$('#paypal-email').val()})`;
        } else if (paymentMethod === 'bank') {
          paymentDisplay = `Bank Transfer (Account ending in ${$('#bank-account').val().slice(-4)})`;
        }
        $('#review-payment').text(paymentDisplay);
        $('#payment-section').addClass('hidden');
        $('#review-section').removeClass('hidden').css('display', '');
        $('#step2').removeClass('step-active').addClass('step-inactive').removeAttr('aria-current');
        $('#step3').removeClass('step-inactive').addClass('step-active').attr('aria-current', 'step');
      }
    };

    window.prevStep = function(step) {
      if (step === 'payment') {
        $('#payment-section').removeClass('hidden').css('display', '');
        $('#shipping-section').addClass('hidden');
        $('#step2').removeClass('step-active').addClass('step-inactive').removeAttr('aria-current');
        $('#step1').removeClass('step-inactive').addClass('step-active').attr('aria-current', 'step');
      } else if (step === 'review') {
        $('#review-section').addClass('hidden');
        $('#payment-section').removeClass('hidden').css('display', '');
        $('#step3').removeClass('step-active').addClass('step-inactive').removeAttr('aria-current');
        $('#step2').removeClass('step-inactive').addClass('step-active').attr('aria-current', 'step');
      }
    };

    window.placeOrder = function() {
      if (cart.length === 0) {
        alert('Your cart is empty. Please add items to proceed.');
        return;
      }
      const shipping = {
        fullName: $('#name').val().trim(),
        address: $('#address').val().trim(),
        city: $('#city').val().trim(),
        phone: $('#phone').val().trim()
      };
      const paymentMethod = $('#payment-method').val() || $('input[name="payment-method"]:checked').val() || 'card';
      let payment = {};
      if (paymentMethod === 'card') {
        payment = {
          method: 'card',
          cardNumber: $('#card-number').val().slice(-4),
          expiry: $('#expiry').val().trim(),
          cvv: $('#cvv').val().trim()
        };
      } else if (paymentMethod === 'paypal') {
        payment = {
          method: 'paypal',
          email: $('#paypal-email').val().trim()
        };
      } else if (paymentMethod === 'bank') {
        payment = {
          method: 'bank',
          accountNumber: $('#bank-account').val().slice(-4),
          routingNumber: $('#bank-routing').val().trim()
        };
      }
      $.ajax({
        url: `${API_URL}/api/orders`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ 
          userId: getUserId(), 
          cart: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity, variant: item.variant })), 
          shipping, 
          payment 
        }),
        success: function(response) {
          setTimeout(() => { triggerConfetti(); }, 100); // Always trigger confetti on success
          alert(`Order placed successfully! Order ID: ${response.orderId}`);
          fetchCart();
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 2000);
        },
        error: function(xhr) {
          alert(`Error placing order: ${xhr.status} ${xhr.responseText}`);
        }
      });
    };

    $(document).on('click', '.increase', function() {
      const product_id = $(this).data('id');
      const item = cart.find(c => c.product_id === product_id);
      const image_url = $(this).data('image_url');
      if (!item || !item.product_id) {
        alert('Invalid cart item.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/cart/update/${product_id}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ quantity: (item.quantity || 1) + 1, variant: item.variant, image_url, userId: getUserId() }),
        success: function() {
          fetchCart();
        },
        error: function(xhr) {
          alert(`Error updating cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });

    $(document).on('click', '.decrease', function() {
      const product_id = $(this).data('id');
      const item = cart.find(c => c.product_id === product_id);
      const image_url = $(this).data('image_url');
      if (!item || !item.product_id) {
        alert('Invalid cart item.');
        return;
      }
      if (item.quantity > 1) {
        $.ajax({
          url: `${API_URL}/api/cart/update/${product_id}`,
          type: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify({ quantity: item.quantity - 1, variant: item.variant, image_url, userId: getUserId() }),
          success: function() {
            fetchCart();
          },
          error: function(xhr) {
            alert(`Error updating cart: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        $.ajax({
          url: `${API_URL}/api/cart/remove/${product_id}?userId=${getUserId()}`,
          type: 'DELETE',
          success: function() {
            fetchCart();
          },
          error: function(xhr) {
            alert(`Error removing from cart: ${xhr.status} ${xhr.responseText}`);
          }
        });
      }
    });

    // Toggle payment method fields
    function togglePaymentFields() {
      const paymentMethod = $('#payment-method').val() || $('input[name="payment-method"]:checked').val() || 'card';
      $('#card-fields, #paypal-fields, #bank-fields').addClass('hidden');
      if (paymentMethod === 'card') {
        $('#card-fields').removeClass('hidden');
      } else if (paymentMethod === 'paypal') {
        $('#paypal-fields').removeClass('hidden');
      } else if (paymentMethod === 'bank') {
        $('#bank-fields').removeClass('hidden');
      }
    }

    $('#payment-method, input[name="payment-method"]').on('change', togglePaymentFields);
    togglePaymentFields();
    renderCheckout();
  }

  // Orders page logic
  if (window.location.pathname.includes('orders.html')) {
    renderOrders();
  }

  // Product page logic
  if (window.location.pathname.includes('product.html')) {
    let selectedVariant = 'small';
    function loadProduct() {
      const urlParams = new URLSearchParams(window.location.search);
      let productId = urlParams.get('id');
      console.log('[DEBUG] Loaded products:', products);
      console.log('[DEBUG] Requested productId:', productId);
      if (!products || !Array.isArray(products) || products.length === 0) {
        console.error('[DEBUG] No products loaded in product.html!');
      } else {
        console.log('[DEBUG] Product IDs available:', products.map(p => p.id));
      }
      if (!productId) {
        $('.product-details').html('<p>No product specified. <a href="products.html">Browse all products</a></p>');
        loadRelatedProducts([]);
        return;
      }
      // Robust id comparison: match as string or number
      const product = products.find(p => String(p.id) === String(productId));
      if (!product || !product.name || isNaN(product.price)) {
        $('.product-details').html('<p>Product not found or invalid data. <a href="products.html">Browse all products</a></p>');
        loadRelatedProducts([]);
        return;
      }
      $('#product-name').text(product.name);
      $('#product-price').text(`$${formatPrice(product.price)}`);
      const mainImage = normalizeImagePath(product.image_url);
      $('#product-image').attr('src', mainImage).attr('alt', `${product.name} main image`);
      $('#product-image').on('error', function() {
        console.warn('Product image failed to load:', mainImage);
        this.src = '/images/1.jpg';
      });
      $('#product-description').text(product.description || 'No description available.');
      $('#breadcrumb-product').text(product.name);

      const $thumbnails = $('.gallery-thumbnails');
      $thumbnails.empty();
      let availableImages;
      try {
        availableImages = product.images && product.images.length > 0 
          ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images)
          : [mainImage];
      } catch (e) {
        console.error('Error parsing product images:', e);
        availableImages = [mainImage];
      }
      availableImages = availableImages.map(normalizeImagePath);
      for (let i = 0; i < Math.min(3, availableImages.length); i++) {
        const imgSrc = availableImages[i];
        const $thumb = $(`<img src="${imgSrc}" alt="${product.name} Image ${i + 1}" data-src="${imgSrc}" class="thumbnail ${i === 0 ? 'active' : ''}">`);
        $thumb.on('error', function() {
          console.warn('Thumbnail image failed to load:', imgSrc);
          this.src = '/images/1.jpg';
        });
        $thumbnails.append($thumb);
      }

      $('.gallery-thumbnails img').on('click', function() {
        $('.gallery-thumbnails img').removeClass('active');
        $(this).addClass('active');
        const newSrc = $(this).data('src');
        $('#product-image').attr('src', newSrc).attr('alt', `${product.name} image ${$(this).index() + 1}`);
      });

      $('#add-to-cart').attr({
        'data-product-id': product.id,
        'data-price': product.price,
        'data-image_url': mainImage,
        'aria-label': `Add ${product.name} to cart`
      });
      $('#wishlist-btn').attr({
        'data-product-id': product.id,
        'data-price': product.price,
        'data-image_url': mainImage,
        'aria-label': `Add ${product.name} to wishlist`
      });
      if (wishlist.some(item => item.product_id === product.id)) {
        $('#wishlist-btn').addClass('active').text('❤️').attr('aria-label', `Remove ${product.name} from wishlist`);
      }

      const relatedProducts = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 5);
      loadRelatedProducts(relatedProducts);
    }

    function loadRelatedProducts(relatedProducts) {
      const $carousel = $('#related-carousel');
      $carousel.empty();
      if (relatedProducts.length > 0) {
        relatedProducts.forEach(p => {
          const relImg = normalizeImagePath(p.image_url);
          const $item = $(`
            <div class="carousel-item">
              <a href="product.html?id=${p.id}">
                <img src="${relImg}" alt="${p.name}" onerror="console.warn('Related image failed to load: ${relImg}'); this.src='/images/1.jpg'">
                <h4>${p.name}</h4>
                <p>$${formatPrice(p.price)}</p>
              </a>
            </div>
          `);
          $carousel.append($item);
        });
      } else {
        $carousel.html('<p>No related products available.</p>');
      }
    }

    $('.variant-btn').on('click', function() {
      $('.variant-btn').removeClass('active');
      $(this).addClass('active');
      selectedVariant = $(this).data('variant');
    });

    $('#add-to-cart').on('click', function() {
      const product_id = $(this).attr('data-product-id');
      const price = parseFloat($(this).attr('data-price'));
      const image_url = $(this).attr('data-image_url');
      if (!product_id || isNaN(price) || !selectedVariant) {
        alert('Error: Invalid product or variant selected.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/cart/add`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ product_id, quantity: 1, image_url, variant: selectedVariant, userId: getUserId() }),
        success: function() {
          fetchCart();
          // alert removed
        },
        error: function(xhr) {
          alert(`Error adding to cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });

    $('#wishlist-btn').on('click', function() {
      const product_id = $(this).attr('data-product-id');
      const price = parseFloat($(this).attr('data-price'));
      const image_url = $(this).attr('data-image_url');
      if (!product_id || isNaN(price)) {
        alert('Error: Invalid product data.');
        return;
      }
      if ($(this).hasClass('active')) {
        $.ajax({
          url: `${API_URL}/api/wishlist/remove/${product_id}?userId=${getUserId()}`,
          type: 'DELETE',
          success: function() {
            fetchWishlist();
          },
          error: function(xhr) {
            alert(`Error removing from wishlist: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        $.ajax({
          url: `${API_URL}/api/wishlist/add`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ product_id, userId: getUserId() }),
          success: function() {
            fetchWishlist();
          },
          error: function(xhr) {
            alert(`Error adding to wishlist: ${xhr.status} ${xhr.responseText}`);
          }
        });
      }
    });
  }

  // Index page logic
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    const $slides = $('#slider .slide');
    const $dotsContainer = $('.slider-dots');
    let slideIndex = 0;
    let sliderTimer = null;
    $slides.each(function(i) {
      const $btn = $('<button>').addClass(i === 0 ? 'active' : '');
      $btn.on('click', () => goToSlide(i));
      $dotsContainer.append($btn);
    });
    function setActiveSlide(i) {
      $slides.removeClass('active').eq(i).addClass('active');
      $dotsContainer.find('button').removeClass('active').eq(i).addClass('active');
    }
    function goToSlide(i) {
      slideIndex = i;
      setActiveSlide(slideIndex);
      resetTimer();
    }
    function nextSlide() {
      slideIndex = (slideIndex + 1) % $slides.length;
      setActiveSlide(slideIndex);
    }
    function prevSlide() {
      slideIndex = (slideIndex - 1 + $slides.length) % $slides.length;
      setActiveSlide(slideIndex);
    }
    $('.arrow-right').on('click', () => { nextSlide(); resetTimer(); });
    $('.arrow-left').on('click', () => { prevSlide(); resetTimer(); });
    function startTimer() {
      sliderTimer = setInterval(nextSlide, 5000);
    }
    function resetTimer() {
      if (sliderTimer) clearInterval(sliderTimer);
      startTimer();
    }
    startTimer();
    $('.wishlist-btn').on('click', function(e) {
      e.preventDefault();
      const $card = $(this).closest('.product-card');
      const product_id = $card.data('product-id');
      const price = parseFloat($card.data('price'));
      const image_url = normalizeImagePath($card.data('image_url'));
      if (!product_id || isNaN(price)) {
        alert('Invalid product data.');
        return;
      }
      if ($(this).hasClass('active')) {
        $.ajax({
          url: `${API_URL}/api/wishlist/remove/${product_id}?userId=${getUserId()}`,
          type: 'DELETE',
          success: function() {
            fetchWishlist();
          },
          error: function(xhr) {
            alert(`Error removing from wishlist: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        $.ajax({
          url: `${API_URL}/api/wishlist/add`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ product_id, userId: getUserId() }),
          success: function() {
            fetchWishlist();
          },
          error: function(xhr) {
            alert(`Error adding to wishlist: ${xhr.status} ${xhr.responseText}`);
          }
        });
      }
    });
    $('.btn-add').on('click', function(e) {
      e.preventDefault();
      const $card = $(this).closest('.product-card');
      const product_id = $card.data('product-id');
      const price = parseFloat($card.data('price'));
      const image_url = normalizeImagePath($card.data('image_url'));
      if (!product_id || isNaN(price)) {
        alert('Invalid product data.');
        return;
      }
      $.ajax({
        url: `${API_URL}/api/cart/add`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ product_id, quantity: 1, image_url, userId: getUserId() }),
        success: function() {
          fetchCart();
          alert(`${$card.data('product')} added to cart!`);
        },
        error: function(xhr) {
          alert(`Error adding to cart: ${xhr.status} ${xhr.responseText}`);
        }
      });
    });

    $('.slide-image').on('click', function() {
      const $slide = $(this).parent();
      const product = $slide.data('product');
      const price = $slide.data('price');
      const image_url = normalizeImagePath($slide.data('image_url'));
      const description = $slide.data('description');

      $('#modalTitle').text(product);
      $('#modalPrice').text(`$${formatPrice(price)}`);
      $('#modalImage').attr('src', image_url).attr('alt', product);
      $('#modalImage').on('error', function() {
        console.warn('Modal image failed to load:', image_url);
        this.src = '/images/1.jpg';
      });
      $('#modalDescription').text(description);
      $('#productModal').removeClass('hidden');
    });

    if ($('#closeModal').length) {
      $('#closeModal').on('click', function() {
        $('#productModal').addClass('hidden');
        $('#orderForm').addClass('hidden');
      });
    }

    if ($('#addToCart').length) {
      $('#addToCart').on('click', function() {
        const name = $('#modalTitle').text();
        const price = parseFloat($('#modalPrice').text().replace('$', '').replace(',', ''));
        const image_url = $('#modalImage').attr('src');
        const product = products.find(p => p.name === name);
        if (!product || !product.id || isNaN(price)) {
          alert('Invalid product data.');
          return;
        }
        $.ajax({
          url: `${API_URL}/api/cart/add`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ product_id: product.id, quantity: 1, image_url, userId: getUserId() }),
          success: function() {
            fetchCart();
            alert(`${name} added to cart!`);
          },
          error: function(xhr) {
            alert(`Error adding to cart: ${xhr.status} ${xhr.responseText}`);
          }
        });
      });
    }

    if ($('#makeOrder').length) {
      $('#makeOrder').on('click', function() {
        $('#orderForm').toggleClass('hidden');
      });
    }

    if ($('#customOrderForm').length) {
      $('#customOrderForm').on('submit', function(e) {
        e.preventDefault();
        const name = $('#name').val();
        const email = $('#email').val();
        const customRequest = $('#customRequest').val();
        const product = $('#modalTitle').text();
        if (!name || !email || !customRequest || !product) {
          alert('Please fill in all fields.');
          return;
        }
        $.ajax({
          url: `${API_URL}/api/feedback`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            name,
            email,
            feedbackType: 'Custom Order',
            comments: `Custom order for ${product}: ${customRequest}`
          }),
          success: function() {
            alert(`Custom order submitted for ${product}!`);
            $('#customOrderForm')[0].reset();
            $('#orderForm').addClass('hidden');
            $('#productModal').addClass('hidden');
          },
          error: function(xhr) {
            alert(`Error submitting custom order: ${xhr.status} ${xhr.responseText}`);
          }
        });
      });
    }
  }

  // Feedback page logic
  if (window.location.pathname.includes('feedback.html')) {
    $('#feedback-form').on('submit', function(e) {
      e.preventDefault();
      const name = $('#name').val().trim();
      const email = $('#email').val().trim();
      const feedbackType = $('#feedbackType').val();
      const comments = $('#comments').val().trim();
      if (name && email && feedbackType && comments && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        $.ajax({
          url: `${API_URL}/api/feedback`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ name, email, feedbackType, comments }),
          success: function() {
            $('#form-message').show();
            $('#feedback-form')[0].reset();
            setTimeout(() => $('#form-message').hide(), 3000);
          },
          error: function(xhr) {
            alert(`Error submitting feedback: ${xhr.status} ${xhr.responseText}`);
          }
        });
      } else {
        alert('Please fill in all fields with valid information.');
      }
    });
  }

  // Initialize core functions
  fetchProducts();
  fetchWishlist();
  fetchCart();
  initSearch();
  initNewsletter();
  initScrollAndChat();
  setActiveNav();
});