// --- CONFIGURATION & STATE ---
const API_BASE_URL = 'http://10.247.65.243:5000/login'; 
let currentUserId = localStorage.getItem('currentUserId');
let currentUsername = localStorage.getItem('currentUsername');
let searchTimeout;

// --- UTILITY FUNCTIONS ---

function navigate(screenId) {
    // ... (rest of the navigate function remains unchanged)
    document.querySelectorAll('.app-screen').forEach(el => el.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
    
    const showHeaderButtons = (screenId === 'dashboard' || screenId === 'help');
    document.getElementById('logout-button').classList.toggle('hidden', !showHeaderButtons);
    document.getElementById('help-button').classList.toggle('hidden', !showHeaderButtons);
    
    if (screenId === 'dashboard') {
        loadDashboardData(); // Load profile and search data on navigation
    }
}

function logout() {
    localStorage.clear(); // Clears ID, Username, and Enrolled Schemes
    currentUserId = null;
    currentUsername = null;
    navigate('login');
    alert('Logged out successfully.');
}

function handleLoginSuccess(userId, username) {
    currentUserId = userId;
    currentUsername = username;
    localStorage.setItem('currentUserId', String(userId));
    localStorage.setItem('currentUsername', username);
    navigate('dashboard');
}

// --- DOM AND EVENT BINDING ---

function initializeApp() {
    // ... (rest of the initializeApp function remains unchanged)
    // 1. Attach form submission handlers (Login/Register/Update)
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('update-profile-form').addEventListener('submit', handleProfileUpdate);
    
    // 2. Attach dashboard toggle
    document.getElementById('toggle-profile-btn').addEventListener('click', toggleProfileForm);
    
    // 3. Attach search input listener (debounced search)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounceSearch);
    }
    
    // 4. Initial navigation
    if (currentUserId && currentUsername) {
        navigate('dashboard');
    } else {
        navigate('login');
    }
}

// --- API HANDLERS (Login/Register - Unchanged) ---

async function handleLogin(e) {
    e.preventDefault();
    const messageEl = document.getElementById('login-message');
    messageEl.textContent = 'Logging in...';

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok) {
            handleLoginSuccess(data.user_id, username);
        } else {
            messageEl.textContent = `Error: ${data.error || 'Login failed'}`;
            messageEl.classList.add('text-error');
        }
    } catch (error) {
        console.error('Login/Network Error:', error);
        messageEl.textContent = 'Network error. Is Flask server running?';
        messageEl.classList.add('text-error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const messageEl = document.getElementById('reg-message');
    messageEl.textContent = 'Registering...';

    const userData = {
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
        salary: parseInt(document.getElementById('reg-salary').value),
        age: parseInt(document.getElementById('reg-age').value),
        gender: document.getElementById('reg-gender').value,
        investment_goal: document.getElementById('reg-goal').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();

        if (response.ok) {
            handleLoginSuccess(data.user_id, userData.username);
        } else {
            messageEl.textContent = `Error: ${data.error || 'Registration failed'}`;
            messageEl.classList.add('text-error');
        }
    } catch (error) {
        console.error('Registration/Network Error:', error);
        messageEl.textContent = 'Network error. Is Flask server running?';
        messageEl.classList.add('text-error');
    }
}

// --- DASHBOARD AND PROFILE UPDATE LOGIC (Unchanged) ---

async function fetchUserProfile(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/user_profile/${userId}`);
        const data = await response.json();
        return response.ok ? data : null;
    } catch (error) {
        console.error('Profile fetch error:', error);
        return null;
    }
}

async function loadDashboardData() {
    if (!currentUserId) return navigate('login');

    document.getElementById('dashboard-username').textContent = currentUsername || 'User!';
    
    // 1. Fetch Profile Data
    const profile = await fetchUserProfile(currentUserId);
    const profileSummaryEl = document.getElementById('profile-summary');

    if (profile) {
        profileSummaryEl.textContent = `Age: ${profile.age || 'N/A'}, Salary: ₹${profile.salary || 'N/A'}, Goal: ${profile.investment_goal || 'N/A'}`;
        
        // Pre-fill the Update Form fields
        document.getElementById('update-salary').value = profile.salary || '';
        document.getElementById('update-age').value = profile.age || '';
        document.getElementById('update-gender').value = profile.gender || 'male';
        document.getElementById('update-goal').value = profile.investment_goal || 'long-term';
    } else {
        profileSummaryEl.textContent = 'Profile data missing. Please update.';
    }

    // 2. Load default quick search results
    performSearch('top'); 
    
    // 3. Load Enrolled Schemes
    displayEnrolledSchemes();
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const messageEl = document.getElementById('update-message');
    messageEl.textContent = 'Saving changes...';

    const updateData = {
        user_id: currentUserId,
        salary: parseInt(document.getElementById('update-salary').value) || null,
        age: parseInt(document.getElementById('update-age').value) || null,
        gender: document.getElementById('update-gender').value,
        investment_goal: document.getElementById('update-goal').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/salary_input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = `Success! Changes saved.`;
            messageEl.classList.add('text-success');
            // Refresh dashboard data to show new summary
            loadDashboardData();
        } else {
            messageEl.textContent = `Error: ${data.error || 'Update failed'}`;
            messageEl.classList.add('text-error');
        }
    } catch (error) {
        console.error('Update/Network Error:', error);
        messageEl.textContent = 'Network error. Is Flask server running?';
        messageEl.classList.add('text-error');
    }
}

function toggleProfileForm() {
    const form = document.getElementById('update-profile-form');
    const button = document.getElementById('toggle-profile-btn');
    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        button.textContent = 'Hide Form';
    } else {
        form.classList.add('hidden');
        button.textContent = 'Show Form';
    }
}
async function handleChangePassword(e) {
    e.preventDefault();
    const messageEl = document.getElementById('password-change-message');
    messageEl.textContent = 'Changing password...';

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Error: Passwords do not match.';
        messageEl.classList.remove('text-success');
        messageEl.classList.add('text-error');
        return;
    }
    
    // Clear the message element class
    messageEl.classList.remove('text-error');
    messageEl.classList.add('text-gray-500');

    try {
        const response = await fetch(`${API_BASE_URL}/change_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(currentUserId), new_password: newPassword }),
        });
        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = 'Success! Password changed. Please log in again with your new password.';
            messageEl.classList.remove('text-error');
            messageEl.classList.add('text-success');
            
            // Clear fields after success
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            
            // Log out the user to force relogin with the new password
            setTimeout(logout, 2000); 
            
        } else {
            messageEl.textContent = `Error: ${data.error || 'Password change failed.'}`;
            messageEl.classList.add('text-error');
        }
    } catch (error) {
        messageEl.textContent = 'Network error. Is Flask server running?';
        messageEl.classList.add('text-error');
    }
}

// --- ENSURE THIS HANDLER IS ATTACHED ---
// (You must ensure this is attached inside your initializeApp or loadDashboardData function)
const changePassForm = document.getElementById('change-password-form');
if (changePassForm) changePassForm.addEventListener('submit', handleChangePassword);
// --- ENROLLED SCHEMES LOGIC ---

async function getEnrolledSchemes() {
    if (!currentUserId) return []; 
    
    try {
        const response = await fetch(`${API_BASE_URL}/get_enrollments/${currentUserId}`);
        const data = await response.json();
        
        // The API returns an array of scheme names (strings)
        return response.ok && data.enrolled_schemes ? data.enrolled_schemes : [];
    } catch (error) {
        console.error("Error fetching enrolled schemes from API:", error);
        return [];
    }
}
// --- ENROLLED SCHEMES LOGIC ---

async function saveEnrolledScheme(schemeName) {
    
    try {
        const response = await fetch(`${API_BASE_URL}/enroll_scheme`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(currentUserId), scheme_name: schemeName }),
        });
        const data = await response.json();

        if (response.ok || response.status === 409) { // 409 is 'already enrolled'
            alert(data.message);
            loadDashboardData(); // Reloads the dashboard data, including the enrolled schemes list
        } else {
            alert(`Failed to save: ${data.error || 'Server error.'}`);
        }

    } catch (error) {
        alert('Network error. Cannot connect to save scheme.');
    }
}

// --- ENROLLED SCHEMES LOGIC ---

async function displayEnrolledSchemes() {
    const container = document.getElementById('enrolled-schemes-container');
    container.innerHTML = '<p class="text-gray-500 text-xs">Loading...</p>';

    const enrolled = await getEnrolledSchemes();
    
    if (enrolled.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-xs">No schemes saved yet. Use search to save one!</p>';
        return;
    }
    
    let html = '<ul class="flex flex-wrap gap-2">';
    enrolled.forEach(scheme => {
        // Uses the correct persistent data fetched from the API
        html += `<li class="px-3 py-1 bg-success text-white text-xs rounded-full shadow-sm">${scheme}</li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// --- AI Recommendation Function (Unchanged) ---
async function getRecommendation() {
    if (!currentUserId) {
        alert("Please login or register first.");
        return;
    }

    const resultsEl = document.getElementById('recommendation-results');
    resultsEl.innerHTML = '<p class="text-primary-light font-semibold flex items-center justify-center py-8"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-light" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Running AI analysis... Please wait. This may take up to 30 seconds.</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/recommendations/${currentUserId}`);
        const data = await response.json();

        if (response.ok && data.recommendation_analysis) {
            displayAiResults(data.recommendation_analysis);
        } else {
            resultsEl.innerHTML = `<p class="text-error font-semibold text-center mt-4">Error: ${data.error || 'Failed to get analysis.'}</p><p class="text-sm text-gray-500 text-center mt-2">Ensure all profile fields are complete.</p>`;
        }
    } catch (error) {
        console.error('AI Request/Network Error:', error);
        resultsEl.innerHTML = '<p class="text-error font-semibold text-center mt-4">Network Error: Could not reach the Flask server.</p>';
    }
}

function displayAiResults(analysis) {
    let html = `<h4 class="text-xl font-bold text-primary mb-2">${analysis.title}</h4>`;
    html += `<p class="text-gray-700 text-sm mb-4">${analysis.summary_advice}</p>`;
    html += `<ul class="space-y-3">`;
    
    analysis.recommended_schemes.forEach((scheme, index) => {
        html += `
            <li class="p-3 bg-white border border-primary-accent rounded-lg shadow-sm">
                <span class="font-bold text-gray-800">${index + 1}. ${scheme.scheme_name}</span>
                <p class="text-xs text-gray-600 mt-1">${scheme.relevance_reason}</p>
            </li>
        `;
    });
    html += '</ul>';
    
    document.getElementById('recommendation-results').innerHTML = html;
}

// --- SEARCH FUNCTIONS (Unchanged) ---
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById('search-input').value;
        performSearch(query);
    }, 500); 
}

async function performSearch(query) {
    const container = document.getElementById('search-results-container');
    if (query.length < 2 && query !== 'top') {
        container.innerHTML = '<p class="text-gray-500 text-sm mt-4">Start typing to search schemes...</p>';
        return;
    }
    
    let displayHeader;
    if (query === 'top') {
        displayHeader = '<h3 class="text-lg font-semibold text-gray-700">Popular Schemes:</h3>';
        query = 'PPF OR NSC OR SCSS';
    } else {
        displayHeader = '<h3 class="text-lg font-semibold text-gray-700">Matching Schemes:</h3>';
    }
    
    const loading = '<p class="text-gray-500 text-sm mt-4 flex items-center justify-center"><svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0014.004 4.195 8 8 0 1020 12h-3"></path></svg>Searching...</p>';
    container.innerHTML = displayHeader + loading; 
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 

        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, { 
            signal: controller.signal 
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            displaySearchResults(data.results, container, displayHeader);
        } else {
            const errorData = await response.json();
            container.innerHTML = displayHeader + `<p class="text-error text-sm mt-4">Search Error: ${errorData.error || 'Failed to fetch search results.'}</p>`;
        }
    } catch (error) {
        console.error('Search/Network Error:', error);
        
        const errorMessage = (error.name === 'AbortError') ?
            'Network Error: Request timed out (10s). Is the Flask server running?' :
            'Network connection error during search. Check console for details.';
            
        container.innerHTML = displayHeader + `<p class="text-error text-sm mt-4">${errorMessage}</p>`;
    }
}

function displaySearchResults(results, container, headerHtml) {
    const finalContainer = document.getElementById('search-results-container'); 
    finalContainer.innerHTML = headerHtml; // Reset container with just the header

    if (results.length === 0) {
        finalContainer.innerHTML += '<p class="text-gray-500 text-sm mt-4">No schemes found matching your criteria.</p>';
        return;
    }

    let html = '<ul class="space-y-2">';
    results.forEach(scheme => {
        // FIX APPLIED HERE: Using bg-cyan-600 which is guaranteed to render, instead of bg-secondary.
        html += `
            <li class="p-3 bg-gray-100 border border-gray-200 rounded-lg flex justify-between items-center text-sm">
                <div class="flex-1">
                    <p class="font-semibold text-gray-800">${scheme.scheme_name}</p>
                    <p class="text-xs text-gray-600">${scheme.short_description}</p>
                </div>
                <button onclick="saveEnrolledScheme('${scheme.scheme_name}')" class="ml-4 px-3 py-1 bg-cyan-600 text-white rounded-full text-xs hover:opacity-80 transition duration-150">Save Scheme</button>
            </li>
        `;
    });
    html += '</ul>';
    finalContainer.innerHTML += html;
}
// -------------------- Global Variables --------------------
let UserId = null;

// -------------------- Login --------------------
async function loginUser() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUserId = data.user_id;
      alert("Login successful!");
      showDashboard();
      fetchUserSchemes(); // Load enrolled schemes immediately
    } else {
      alert(data.message || "Login failed. Please try again.");
    }
  } catch (error) {
    console.error("Error logging in:", error);
    alert("Server error while logging in.");
  }
}

// -------------------- Registration --------------------
async function registerUser() {
  const username = document.getElementById("registerUsername").value;
  const password = document.getElementById("registerPassword").value;

  try {
    const response = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      alert("Registration successful! Please log in.");
      showLogin();
    } else {
      alert(data.message || "Registration failed.");
    }
  } catch (error) {
    console.error("Error registering:", error);
    alert("Server error during registration.");
  }
}

// -------------------- Profile Update --------------------
async function submitSalary() {
  const age = document.getElementById("age").value;
  const salary = document.getElementById("salary").value;
  const goal = document.getElementById("goal").value;

  try {
    const response = await fetch("/salary_input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUserId, age, salary, goal })
    });

    const data = await response.json();
    alert("Profile updated successfully!");
  } catch (error) {
    console.error("Error updating profile:", error);
    alert("Failed to update profile.");
  }
}

// -------------------- Fetch AI Recommendations --------------------
async function getRecommendations() {
  try {
    const response = await fetch(`/recommendations/${currentUserId}`);
    const data = await response.json();

    const recContainer = document.getElementById("aiRecommendations");
    recContainer.innerHTML = "<h3>AI Recommendations:</h3>";

    if (data.recommendations && data.recommendations.length > 0) {
      data.recommendations.forEach(scheme => {
        const schemeCard = document.createElement("div");
        schemeCard.classList.add("scheme-card");
        schemeCard.innerHTML = `
          <strong>${scheme.scheme_name}</strong> (${scheme.category})<br>
          <em>${scheme.description}</em><br>
          <button onclick="saveScheme('${scheme.scheme_name}', '${scheme.category}', '${scheme.description}')">Enroll</button>
        `;
        recContainer.appendChild(schemeCard);
      });
    } else {
      recContainer.innerHTML += "<p>No recommendations found.</p>";
    }
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    alert("Could not fetch AI recommendations.");
  }
}

// -------------------- Save (Enroll) Scheme --------------------
async function saveScheme(name, category, description) {
  try {
    const response = await fetch("/save_scheme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUserId,
        scheme_name: name,
        category: category,
        description: description
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert("Scheme enrolled successfully!");
      fetchUserSchemes(); // Refresh enrolled schemes
    } else {
      alert(data.message || "Failed to save scheme.");
    }
  } catch (error) {
    console.error("Error saving scheme:", error);
    alert("Server error while saving scheme.");
  }
}

// -------------------- Fetch Enrolled Schemes --------------------
async function fetchUserSchemes() {
  const enrolledDiv = document.getElementById("enrolledSchemes");
  enrolledDiv.innerHTML = "<p>Loading enrolled schemes...</p>";

  try {
    const response = await fetch(`/get_schemes/${currentUserId}`);
    const data = await response.json();

    if (data.schemes && data.schemes.length > 0) {
      enrolledDiv.innerHTML = "<h3>My Enrolled Schemes:</h3>";
      data.schemes.forEach(scheme => {
        const div = document.createElement("div");
        div.classList.add("scheme-card");
        div.innerHTML = `
          <strong>${scheme.scheme_name}</strong> (${scheme.category})<br>
          <em>${scheme.description}</em>
        `;
        enrolledDiv.appendChild(div);
      });
    } else {
      enrolledDiv.innerHTML = "<p>No enrolled schemes found.</p>";
    }
  } catch (error) {
    console.error("Error fetching schemes:", error);
    enrolledDiv.innerHTML = "<p>Error loading schemes.</p>";
  }
}

// -------------------- Search Schemes --------------------
async function searchSchemes() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "<p>Searching...</p>";

  try {
    const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    resultsDiv.innerHTML = "<h3>Search Results:</h3>";
    if (data.schemes && data.schemes.length > 0) {
      data.schemes.forEach(scheme => {
        const div = document.createElement("div");
        div.classList.add("scheme-card");
        div.innerHTML = `
          <strong>${scheme.scheme_name}</strong> (${scheme.category})<br>
          <em>${scheme.description}</em><br>
          <button onclick="saveScheme('${scheme.scheme_name}', '${scheme.category}', '${scheme.description}')">Enroll</button>
        `;
        resultsDiv.appendChild(div);
      });
    } else {
      resultsDiv.innerHTML += "<p>No schemes found matching your criteria.</p>";
    }
  } catch (error) {
    console.error("Error searching schemes:", error);
    resultsDiv.innerHTML = "<p>Error performing search.</p>";
  }
}

// -------------------- Helper UI Functions --------------------
function showDashboard() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("registerSection").style.display = "none";
  document.getElementById("dashboardSection").style.display = "block";
}

function showLogin() {
  document.getElementById("registerSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
}

function showRegister() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("registerSection").style.display = "block";
}

// Ensure the app initializes only after the document is fully loaded
window.onload = initializeApp;
