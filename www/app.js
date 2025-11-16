/********************************************************************
 * GLOBAL CONFIG & STATE
 ********************************************************************/
const API_BASE_URL = "http://10.247.65.243:5000";
let currentUserId = localStorage.getItem("currentUserId");
let currentUsername = localStorage.getItem("currentUsername");
let searchTimeout = null;


/********************************************************************
 * NAVIGATION FUNCTION (matches your HTML screens)
 ********************************************************************/
function navigate(screenId) {
    document.querySelectorAll('.app-screen').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    const showHeaderBtns = (screenId === 'dashboard' || screenId === 'help');
    document.getElementById('logout-button').classList.toggle('hidden', !showHeaderBtns);
    document.getElementById('help-button').classList.toggle('hidden', !showHeaderBtns);

    if (screenId === "dashboard") loadDashboardData();
}


/********************************************************************
 * AUTH: LOGIN
 ********************************************************************/
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const msg = document.getElementById("login-message");

    msg.textContent = "Logging in...";

    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            currentUserId = data.user_id;
            currentUsername = username;

            localStorage.setItem("currentUserId", currentUserId);
            localStorage.setItem("currentUsername", username);

            navigate("dashboard");
        } else {
            msg.textContent = data.error || "Login failed.";
            msg.classList.add("text-error");
        }
    } catch {
        msg.textContent = "Network error.";
    }
}


/********************************************************************
 * AUTH: REGISTER
 ********************************************************************/
async function handleRegister(e) {
    e.preventDefault();

    const msg = document.getElementById("reg-message");
    msg.textContent = "Creating account...";

    const payload = {
        username: document.getElementById("reg-username").value,
        password: document.getElementById("reg-password").value,
        salary: document.getElementById("reg-salary").value,
        age: document.getElementById("reg-age").value,
        gender: document.getElementById("reg-gender").value,
        investment_goal: document.getElementById("reg-goal").value
    };

    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            currentUserId = data.user_id;
            currentUsername = payload.username;

            localStorage.setItem("currentUserId", currentUserId);
            localStorage.setItem("currentUsername", currentUsername);

            navigate("dashboard");
        } else {
            msg.textContent = data.error || "Registration failed";
            msg.classList.add("text-error");
        }
    } catch {
        msg.textContent = "Network error.";
    }
}


/********************************************************************
 * LOAD DASHBOARD DATA
 ********************************************************************/
async function loadDashboardData() {
    if (!currentUserId) return navigate("login");

    document.getElementById("dashboard-username").textContent = currentUsername;

    const profile = await fetchUserProfile(currentUserId);

    if (profile) {
        document.getElementById('profile-summary').textContent =
            `Age: ${profile.age}, Salary: ₹${profile.salary}, Goal: ${profile.investment_goal}`;

        // Prefill update screen fields
        document.getElementById("update-salary").value = profile.salary;
        document.getElementById("update-age").value = profile.age;
        document.getElementById("update-gender").value = profile.gender;
        document.getElementById("update-goal").value = profile.investment_goal;
    }

    performSearch("top");
    displayEnrolledSchemes();
}


/********************************************************************
 * FETCH USER PROFILE
 ********************************************************************/
async function fetchUserProfile(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/user_profile/${userId}`);
        const data = await res.json();
        return res.ok ? data : null;
    } catch {
        return null;
    }
}


/********************************************************************
 * UPDATE PROFILE
 ********************************************************************/
async function handleProfileUpdate(e) {
    e.preventDefault();

    const msg = document.getElementById("update-message");
    msg.textContent = "Saving...";

    const payload = {
        user_id: currentUserId,
        salary: document.getElementById("update-salary").value,
        age: document.getElementById("update-age").value,
        gender: document.getElementById("update-gender").value,
        investment_goal: document.getElementById("update-goal").value
    };

    try {
        const res = await fetch(`${API_BASE_URL}/salary_input`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            msg.textContent = "Saved!";
            msg.classList.add("text-success");
            loadDashboardData();
        } else {
            msg.textContent = data.error;
            msg.classList.add("text-error");
        }
    } catch {
        msg.textContent = "Network error.";
    }
}


/********************************************************************
 * CHANGE PASSWORD
 ********************************************************************/
async function handleChangePassword(e) {
    e.preventDefault();

    const msg = document.getElementById("password-change-message");
    msg.textContent = "Changing...";

    const newPass = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    if (newPass !== confirm) {
        msg.textContent = "Passwords do not match.";
        msg.classList.add("text-error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/change_password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: currentUserId,
                new_password: newPass
            })
        });

        const data = await res.json();

        if (res.ok) {
            msg.textContent = "Password changed! Logging out...";
            msg.classList.add("text-success");
            setTimeout(logout, 2000);
        } else {
            msg.textContent = data.error;
            msg.classList.add("text-error");
        }
    } catch {
        msg.textContent = "Network error.";
    }
}


/********************************************************************
 * LOGOUT
 ********************************************************************/
function logout() {
    localStorage.clear();
    currentUserId = null;
    currentUsername = null;
    navigate("login");
}


/********************************************************************
 * SEARCH (with debounce)
 ********************************************************************/
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(document.getElementById("search-input").value);
    }, 400);
}

async function performSearch(query) {
    const container = document.getElementById("search-results-container");

    if (query === "top") {
        container.innerHTML = `<h3 class="text-lg font-semibold">Popular Schemes:</h3>`;
    } else {
        container.innerHTML = `<h3 class="text-lg font-semibold">Results:</h3>`;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        displaySearchResults(data.results);
    } catch {
        container.innerHTML += `<p class="text-error">Search failed.</p>`;
    }
}
// only the parts that changed compared to your previous app.js (include them in your file)
// Replace displaySearchResults and saveEnrolledScheme and displayEnrolledSchemes sections.

function displaySearchResults(results) {
    const container = document.getElementById("search-results-container");

    if (!results || results.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm mt-4">No schemes found matching your criteria.</p>';
        return;
    }

    let html = '<ul class="space-y-2">';
    results.forEach(scheme => {
        // scheme.scheme_name now contains the name (string)
        const nameEscaped = (scheme.scheme_name || "").replace(/'/g, "\\'");
        html += `
            <li class="p-3 bg-gray-100 border border-gray-200 rounded-lg flex justify-between items-center text-sm">
                <div class="flex-1">
                    <p class="font-semibold text-gray-800">${scheme.scheme_name}</p>
                    <p class="text-xs text-gray-600">${scheme.short_description || ""}</p>
                </div>
                <button onclick="saveEnrolledScheme('${nameEscaped}')" class="ml-4 px-3 py-1 bg-cyan-600 text-white rounded-full text-xs hover:opacity-80 transition duration-150">Save Scheme</button>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

async function saveEnrolledScheme(schemeName) {
    if (!currentUserId) {
        alert('Please login first.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/enroll_scheme`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(currentUserId), scheme_name: schemeName })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Scheme enrolled successfully.');
            displayEnrolledSchemes(); // refresh
        } else {
            alert(data.error || 'Failed to save scheme.');
        }
    } catch (err) {
        console.error('Enroll network error:', err);
        alert('Network error. Could not save scheme.');
    }
}

async function displayEnrolledSchemes() {
    const container = document.getElementById('enrolled-schemes-container');
    container.innerHTML = '<p class="text-gray-500 text-xs">Loading...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/get_enrollments/${currentUserId}`);
        const data = await res.json();

        if (!res.ok) {
            container.innerHTML = '<p class="text-error text-xs">Failed to load.</p>';
            return;
        }

        const enrolled = data.enrolled_schemes || [];
        if (enrolled.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-xs">No schemes saved yet. Use search to save one!</p>';
            return;
        }

        let html = '<ul class="flex flex-wrap gap-2">';
        enrolled.forEach(s => {
            html += `<li class="px-3 py-1 bg-success text-white text-xs rounded-full shadow-sm">${s.scheme_name}</li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Fetch enrolled network error:', err);
        container.innerHTML = '<p class="text-error text-xs">Network error while loading schemes.</p>';
    }
}




/********************************************************************
 * AI RECOMMENDATIONS
 ********************************************************************/
async function getRecommendation() {
    const box = document.getElementById("recommendation-results");

    box.innerHTML = `<p class="text-center text-gray-600">Running AI Analysis...</p>`;

    try {
        const res = await fetch(`${API_BASE_URL}/recommendations/${currentUserId}`);
        const data = await res.json();

        if (res.ok) {
            displayAiResults(data.recommendation_analysis);
        } else {
            box.innerHTML = `<p class="text-error">${data.error}</p>`;
        }
    } catch {
        box.innerHTML = "<p class='text-error'>Network error.</p>";
    }
}

function displayAiResults(analysis) {
    const box = document.getElementById("recommendation-results");

    let html = `
        <h4 class="text-xl font-bold">${analysis.title}</h4>
        <p class="text-gray-700 text-sm">${analysis.summary_advice}</p>
        <ul class="mt-3 space-y-2">
    `;

    analysis.recommended_schemes.forEach((s, i) => {
        html += `
            <li class="p-3 bg-white rounded border">
                <strong>${i + 1}. ${s.scheme_name}</strong>
                <p class="text-xs text-gray-600">${s.relevance_reason}</p>
            </li>
        `;
    });

    html += "</ul>";

    box.innerHTML = html;
}


/********************************************************************
 * APP INITIALIZATION
 ********************************************************************/
function initializeApp() {
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("register-form").addEventListener("submit", handleRegister);
    document.getElementById("update-form").addEventListener("submit", handleProfileUpdate);
    document.getElementById("change-password-form").addEventListener("submit", handleChangePassword);

    if (currentUserId) navigate("dashboard");
    else navigate("login");
}

window.onload = initializeApp;
